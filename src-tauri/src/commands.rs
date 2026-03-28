use std::fs;
use std::path::PathBuf;

use tauri::State;
use uuid::Uuid;

use crate::generator;
use crate::models::*;
use crate::store::Store;
use crate::subscription;

#[derive(serde::Serialize)]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    pub body: String,
}

/// Check for a new version via the configured updater endpoint.
/// Returns Some(UpdateInfo) when an update is available, None otherwise.
#[tauri::command]
pub async fn check_for_update(app: tauri::AppHandle) -> Result<Option<UpdateInfo>, String> {
    use tauri_plugin_updater::UpdaterExt;

    let update = app
        .updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;

    Ok(update.map(|u| UpdateInfo {
        version: u.version,
        current_version: u.current_version,
        body: u.body.unwrap_or_default(),
    }))
}

/// Download and install the pending update, then exit so the user can relaunch.
#[tauri::command]
pub async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;

    let Some(update) = app
        .updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?
    else {
        return Err("No update available".to_string());
    };

    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|e| e.to_string())?;

    app.exit(0);
    Ok(())
}

// ── Subscriptions ──

#[tauri::command]
pub async fn add_subscription(
    name: String,
    url: String,
    source_type: String,
    store: State<'_, Store>,
) -> Result<Subscription, String> {
    let st = if source_type == "file" {
        SubSource::File
    } else {
        SubSource::Url
    };

    let content = match st {
        SubSource::File => subscription::read_subscription_file(&url)?,
        SubSource::Url => subscription::fetch_subscription(&url).await?,
    };

    if !subscription::is_valid_subscription_content(&content) {
        return Err("Content is not a valid Surge subscription (no [Proxy] section with nodes found)".to_string());
    }

    let sub = subscription::parse_subscription(&name, &url, st, &content);
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        data.subscriptions.push(sub.clone());
    }
    store.save()?;
    Ok(sub)
}

#[tauri::command]
pub async fn refresh_subscription(id: String, store: State<'_, Store>) -> Result<Subscription, String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let (url, source_type) = {
        let data = store.data.lock().map_err(|e| e.to_string())?;
        let sub = data.subscriptions
            .iter()
            .find(|s| s.id == uuid)
            .ok_or_else(|| "Subscription not found".to_string())?;
        (sub.url.clone(), sub.source_type.clone())
    };

    // Attempt to fetch new content
    let fetch_result = match source_type {
        SubSource::File => subscription::read_subscription_file(&url).ok(),
        SubSource::Url => subscription::try_fetch_subscription(&url).await.ok(),
    };

    let updated = {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        let sub = data
            .subscriptions
            .iter_mut()
            .find(|s| s.id == uuid)
            .ok_or_else(|| "Subscription not found".to_string())?;

        match fetch_result {
            Some(content) => {
                // New content is valid — update everything
                let parsed = subscription::parse_subscription(&sub.name, &url, source_type, &content);
                sub.raw_content = parsed.raw_content;
                sub.node_names = parsed.node_names;
                sub.node_count = parsed.node_count;
                sub.proxy_group_lines = parsed.proxy_group_lines;
                sub.usage_used_gb = parsed.usage_used_gb;
                sub.usage_total_gb = parsed.usage_total_gb;
                sub.expires = parsed.expires;
                sub.last_refreshed = Some(chrono::Utc::now());
                sub.status = SubStatus::Active;
            }
            None => {
                // Fetch failed or content invalid — keep existing content, mark status
                sub.status = SubStatus::Error;
            }
        }
        sub.clone()
    };
    store.save()?;
    Ok(updated)
}

#[tauri::command]
pub fn remove_subscription(id: String, store: State<'_, Store>) -> Result<(), String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        data.subscriptions.retain(|s| s.id != uuid);
    }
    store.save()
}

#[tauri::command]
pub fn get_subscriptions(store: State<'_, Store>) -> Result<Vec<Subscription>, String> {
    let data = store.data.lock().map_err(|e| e.to_string())?;
    Ok(data.subscriptions.clone())
}

// ── Rules ──

#[tauri::command]
pub fn get_remote_rule_sets(store: State<'_, Store>) -> Result<Vec<RemoteRuleSet>, String> {
    let data = store.data.lock().map_err(|e| e.to_string())?;
    Ok(data.remote_rule_sets.clone())
}

#[tauri::command]
pub fn add_remote_rule_set(
    name: String,
    url: String,
    policy: String,
    update_interval: u64,
    store: State<'_, Store>,
) -> Result<RemoteRuleSet, String> {
    let rs = RemoteRuleSet {
        id: Uuid::new_v4(),
        name,
        url,
        policy,
        update_interval,
    };
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        data.remote_rule_sets.push(rs.clone());
    }
    store.save()?;
    Ok(rs)
}

#[tauri::command]
pub fn remove_remote_rule_set(id: String, store: State<'_, Store>) -> Result<(), String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        data.remote_rule_sets.retain(|r| r.id != uuid);
    }
    store.save()
}

#[tauri::command]
pub fn get_individual_rules(store: State<'_, Store>) -> Result<Vec<IndividualRule>, String> {
    let data = store.data.lock().map_err(|e| e.to_string())?;
    Ok(data.individual_rules.clone())
}

#[tauri::command]
pub fn add_individual_rule(
    rule_type: String,
    value: String,
    policy: String,
    comment: Option<String>,
    store: State<'_, Store>,
) -> Result<IndividualRule, String> {
    let rule = IndividualRule {
        id: Uuid::new_v4(),
        rule_type,
        value,
        policy,
        comment,
    };
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        data.individual_rules.push(rule.clone());
    }
    store.save()?;
    Ok(rule)
}

#[tauri::command]
pub fn remove_individual_rule(id: String, store: State<'_, Store>) -> Result<(), String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        data.individual_rules.retain(|r| r.id != uuid);
    }
    store.save()
}

#[tauri::command]
pub fn reorder_individual_rules(ids: Vec<String>, store: State<'_, Store>) -> Result<(), String> {
    let uuids: Vec<Uuid> = ids
        .iter()
        .map(|id| Uuid::parse_str(id).map_err(|e| e.to_string()))
        .collect::<Result<Vec<_>, _>>()?;
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        let mut reordered = Vec::with_capacity(uuids.len());
        for uuid in &uuids {
            if let Some(rule) = data.individual_rules.iter().find(|r| r.id == *uuid) {
                reordered.push(rule.clone());
            }
        }
        data.individual_rules = reordered;
    }
    store.save()
}

// ── Extra Nodes ──

#[tauri::command]
pub fn get_extra_nodes(store: State<'_, Store>) -> Result<Vec<ExtraNode>, String> {
    let data = store.data.lock().map_err(|e| e.to_string())?;
    Ok(data.extra_nodes.clone())
}

#[tauri::command]
pub fn add_extra_node(
    name: String,
    node_type: String,
    server: String,
    port: u16,
    refresh_url: Option<String>,
    store: State<'_, Store>,
) -> Result<ExtraNode, String> {
    let raw_line = format!("{} = {}, {}, {}", name, node_type, server, port);
    let node = ExtraNode {
        id: Uuid::new_v4(),
        name,
        node_type,
        server,
        port,
        refresh_url,
        raw_line,
    };
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        data.extra_nodes.push(node.clone());
    }
    store.save()?;
    Ok(node)
}

#[tauri::command]
pub fn remove_extra_node(id: String, store: State<'_, Store>) -> Result<(), String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        data.extra_nodes.retain(|n| n.id != uuid);
    }
    store.save()
}

// ── Output / Config Generation ──

#[tauri::command]
pub fn get_output_config(store: State<'_, Store>) -> Result<OutputConfig, String> {
    let data = store.data.lock().map_err(|e| e.to_string())?;
    Ok(data.output_config.clone())
}

#[tauri::command]
pub fn update_output_config(config: OutputConfig, store: State<'_, Store>) -> Result<(), String> {
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        data.output_config = config;
    }
    store.save()
}

#[tauri::command]
pub fn generate_config(store: State<'_, Store>) -> Result<BuildRecord, String> {
    let data = store.data.lock().map_err(|e| e.to_string())?;

    let config_content = generator::generate_config(&data);

    // Resolve output path
    let output_dir = shellexpand_tilde(&data.output_config.output_path);
    fs::create_dir_all(&output_dir).map_err(|e| format!("Cannot create output dir: {}", e))?;

    let filename = format!(
        "scm_{}.conf",
        chrono::Utc::now().format("%Y%m%d_%H%M%S")
    );
    let full_path = PathBuf::from(&output_dir).join(&filename);

    let content = if data.output_config.minify {
        minify_config(&config_content)
    } else {
        config_content.clone()
    };

    fs::write(&full_path, &content)
        .map_err(|e| format!("Failed to write config: {}", e))?;

    let rule_count = data.individual_rules.len() + data.remote_rule_sets.len();
    let record = BuildRecord {
        id: Uuid::new_v4(),
        filename: filename.clone(),
        description: format!("Based on {} rules", rule_count),
        time: chrono::Utc::now(),
        status: BuildStatus::Success,
    };

    // We need to drop the current lock before re-acquiring to add build record
    drop(data);

    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        data.build_history.insert(0, record.clone());
        // Keep only last 20 builds
        data.build_history.truncate(20);
    }
    store.save()?;

    Ok(record)
}

#[tauri::command]
pub fn get_build_history(store: State<'_, Store>) -> Result<Vec<BuildRecord>, String> {
    let data = store.data.lock().map_err(|e| e.to_string())?;
    Ok(data.build_history.clone())
}

#[tauri::command]
pub fn clear_build_history(store: State<'_, Store>) -> Result<(), String> {
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        data.build_history.clear();
    }
    store.save()
}

#[tauri::command]
pub fn preview_config(store: State<'_, Store>) -> Result<String, String> {
    let data = store.data.lock().map_err(|e| e.to_string())?;
    Ok(generator::generate_config(&data))
}

fn shellexpand_tilde(path: &str) -> String {
    if path.starts_with("~/") {
        if let Some(home) = std::env::var_os("HOME") {
            return format!("{}{}", home.to_string_lossy(), &path[1..]);
        }
    }
    path.to_string()
}

fn minify_config(content: &str) -> String {
    content
        .lines()
        .filter(|line| {
            let trimmed = line.trim();
            !trimmed.is_empty() && !trimmed.starts_with('#') && !trimmed.starts_with("//")
        })
        .map(|line| {
            // Remove inline comments
            if let Some(pos) = line.find(" //") {
                line[..pos].trim_end()
            } else {
                line
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}
