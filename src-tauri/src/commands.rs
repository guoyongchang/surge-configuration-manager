use chrono::{DateTime, Utc};
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
        return Err(
            "Content is not a valid Surge subscription (no [Proxy] section with nodes found)"
                .to_string(),
        );
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
pub async fn refresh_subscription(
    id: String,
    store: State<'_, Store>,
) -> Result<Subscription, String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let (url, source_type) = {
        let data = store.data.lock().map_err(|e| e.to_string())?;
        let sub = data
            .subscriptions
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
                let parsed =
                    subscription::parse_subscription(&sub.name, &url, source_type, &content);
                sub.raw_content = parsed.raw_content;
                sub.node_names = parsed.node_names;
                sub.node_count = parsed.node_count;
                sub.proxy_group_lines = parsed.proxy_group_lines;
                sub.rule_lines = parsed.rule_lines;
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
        enabled: true,
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
        enabled: true,
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

#[tauri::command]
pub fn reorder_remote_rule_sets(ids: Vec<String>, store: State<'_, Store>) -> Result<(), String> {
    let uuids: Vec<Uuid> = ids
        .iter()
        .map(|id| Uuid::parse_str(id).map_err(|e| e.to_string()))
        .collect::<Result<Vec<_>, _>>()?;
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        let mut reordered = Vec::with_capacity(uuids.len());
        for uuid in &uuids {
            if let Some(rs) = data.remote_rule_sets.iter().find(|r| r.id == *uuid) {
                reordered.push(rs.clone());
            }
        }
        data.remote_rule_sets = reordered;
    }
    store.save()
}

// ── Extra Nodes ──

#[derive(serde::Deserialize)]
pub struct BatchNodeInput {
    pub name: String,
    pub node_type: String,
    pub server: String,
    pub port: u16,
    pub username: Option<String>,
    pub password: Option<String>,
    pub refresh_url: Option<String>,
}

#[tauri::command]
pub fn batch_add_extra_nodes(
    nodes: Vec<BatchNodeInput>,
    store: State<'_, Store>,
) -> Result<Vec<ExtraNode>, String> {
    let mut added = Vec::new();
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        for input in nodes {
            let raw_line = match (&input.username, &input.password) {
                (Some(u), Some(p)) => format!(
                    "{} = {}, {}, {}, {}, {}",
                    input.name, input.node_type, input.server, input.port, u, p
                ),
                _ => format!(
                    "{} = {}, {}, {}",
                    input.name, input.node_type, input.server, input.port
                ),
            };
            let node = ExtraNode {
                id: Uuid::new_v4(),
                name: input.name,
                node_type: input.node_type,
                server: input.server,
                port: input.port,
                username: input.username,
                password: input.password,
                refresh_url: input.refresh_url,
                raw_line,
            };
            added.push(node.clone());
            data.extra_nodes.push(node);
        }
    }
    store.save()?;
    Ok(added)
}

#[derive(serde::Deserialize)]
pub struct BatchRuleInput {
    pub rule_type: String,
    pub value: String,
    pub policy: String,
    pub comment: Option<String>,
}

#[tauri::command]
pub fn batch_add_individual_rules(
    rules: Vec<BatchRuleInput>,
    store: State<'_, Store>,
) -> Result<Vec<IndividualRule>, String> {
    let mut added = Vec::new();
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        for input in rules {
            let rule = IndividualRule {
                id: Uuid::new_v4(),
                rule_type: input.rule_type,
                value: input.value,
                policy: input.policy,
                comment: input.comment,
                enabled: true,
            };
            added.push(rule.clone());
            data.individual_rules.push(rule);
        }
    }
    store.save()?;
    Ok(added)
}

#[derive(serde::Serialize)]
pub struct NodeTestResult {
    pub id: String,
    pub latency_ms: Option<u64>,
    pub ip: Option<String>,
    pub country: Option<String>,
    pub country_code: Option<String>,
    pub city: Option<String>,
    pub isp: Option<String>,
    /// true = IP detected as proxy/VPN/hosting (low purity)
    pub is_proxy: Option<bool>,
    pub is_hosting: Option<bool>,
    pub error: Option<String>,
}

#[derive(serde::Deserialize)]
struct IpApiResponse {
    status: String,
    #[serde(default)]
    country: String,
    #[serde(rename = "countryCode", default)]
    country_code: String,
    #[serde(default)]
    city: String,
    #[serde(default)]
    isp: String,
    #[serde(default)]
    proxy: bool,
    #[serde(default)]
    hosting: bool,
    #[serde(default)]
    query: String,
}

#[tauri::command]
pub async fn test_extra_node(
    id: String,
    store: State<'_, Store>,
) -> Result<NodeTestResult, String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let (server, port, username, password) = {
        let data = store.data.lock().map_err(|e| e.to_string())?;
        let node = data
            .extra_nodes
            .iter()
            .find(|n| n.id == uuid)
            .ok_or_else(|| "Node not found".to_string())?;
        (
            node.server.clone(),
            node.port,
            node.username.clone(),
            node.password.clone(),
        )
    };

    let proxy_url = match (&username, &password) {
        (Some(u), Some(p)) => format!("socks5://{}:{}@{}:{}", u, p, server, port),
        _ => format!("socks5://{}:{}", server, port),
    };

    let client = reqwest::Client::builder()
        .proxy(reqwest::Proxy::all(&proxy_url).map_err(|e| e.to_string())?)
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let start = std::time::Instant::now();
    let resp = match tokio::time::timeout(
        std::time::Duration::from_secs(12),
        client.get("http://ip-api.com/json?fields=status,country,countryCode,city,isp,proxy,hosting,query")
              .send(),
    )
    .await
    {
        Ok(Ok(r)) => r,
        Ok(Err(e)) => {
            return Ok(NodeTestResult {
                id, latency_ms: None, ip: None, country: None, country_code: None,
                city: None, isp: None, is_proxy: None, is_hosting: None,
                error: Some(e.to_string()),
            });
        }
        Err(_) => {
            return Ok(NodeTestResult {
                id, latency_ms: None, ip: None, country: None, country_code: None,
                city: None, isp: None, is_proxy: None, is_hosting: None,
                error: Some("Timeout".to_string()),
            });
        }
    };

    let latency_ms = start.elapsed().as_millis() as u64;

    match resp.json::<IpApiResponse>().await {
        Ok(info) if info.status == "success" => Ok(NodeTestResult {
            id,
            latency_ms: Some(latency_ms),
            ip: Some(info.query),
            country: Some(info.country),
            country_code: Some(info.country_code),
            city: Some(info.city),
            isp: Some(info.isp),
            is_proxy: Some(info.proxy),
            is_hosting: Some(info.hosting),
            error: None,
        }),
        Ok(_) => Ok(NodeTestResult {
            id,
            latency_ms: Some(latency_ms),
            ip: None,
            country: None,
            country_code: None,
            city: None,
            isp: None,
            is_proxy: None,
            is_hosting: None,
            error: Some("IP lookup failed".to_string()),
        }),
        Err(e) => Ok(NodeTestResult {
            id,
            latency_ms: Some(latency_ms),
            ip: None,
            country: None,
            country_code: None,
            city: None,
            isp: None,
            is_proxy: None,
            is_hosting: None,
            error: Some(format!("Parse error: {}", e)),
        }),
    }
}

#[tauri::command]
pub async fn refresh_extra_node(id: String, store: State<'_, Store>) -> Result<String, String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let refresh_url = {
        let data = store.data.lock().map_err(|e| e.to_string())?;
        let node = data
            .extra_nodes
            .iter()
            .find(|n| n.id == uuid)
            .ok_or_else(|| "Node not found".to_string())?;
        node.refresh_url
            .clone()
            .ok_or_else(|| "No refresh URL configured".to_string())?
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    match tokio::time::timeout(
        std::time::Duration::from_secs(12),
        client.get(&refresh_url).send(),
    )
    .await
    {
        Ok(Ok(resp)) => Ok(format!("OK ({})", resp.status())),
        Ok(Err(e)) => Err(e.to_string()),
        Err(_) => Err("Timeout".to_string()),
    }
}

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
        username: None,
        password: None,
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
pub fn add_node_from_raw_line(
    raw_line: String,
    refresh_url: Option<String>,
    store: State<'_, Store>,
) -> Result<ExtraNode, String> {
    // Parse: "name = type, server, port[, ...]"
    let (name_part, rest) = raw_line
        .split_once('=')
        .ok_or("Invalid format: missing '='")?;
    let name = name_part.trim().to_string();
    if name.is_empty() {
        return Err("Name cannot be empty".to_string());
    }
    let params: Vec<&str> = rest.splitn(4, ',').collect();
    if params.len() < 3 {
        return Err("Invalid format: expected type, server, port".to_string());
    }
    let node_type = params[0].trim().to_string();
    let server = params[1].trim().to_string();
    let port: u16 = params[2]
        .trim()
        .parse()
        .map_err(|_| format!("Invalid port: '{}'", params[2].trim()))?;

    let node = ExtraNode {
        id: Uuid::new_v4(),
        name,
        node_type,
        server,
        port,
        username: None,
        password: None,
        refresh_url,
        raw_line: raw_line.trim().to_string(),
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

#[tauri::command]
pub fn batch_remove_extra_nodes(ids: Vec<String>, store: State<'_, Store>) -> Result<(), String> {
    let uuids: Vec<Uuid> = ids
        .iter()
        .map(|id| Uuid::parse_str(id).map_err(|e| e.to_string()))
        .collect::<Result<Vec<_>, _>>()?;
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        data.extra_nodes.retain(|n| !uuids.contains(&n.id));
    }
    store.save()
}

#[tauri::command]
pub fn batch_remove_individual_rules(
    ids: Vec<String>,
    store: State<'_, Store>,
) -> Result<(), String> {
    let uuids: Vec<Uuid> = ids
        .iter()
        .map(|id| Uuid::parse_str(id).map_err(|e| e.to_string()))
        .collect::<Result<Vec<_>, _>>()?;
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        data.individual_rules.retain(|r| !uuids.contains(&r.id));
    }
    store.save()
}

#[tauri::command]
pub fn batch_remove_remote_rule_sets(
    ids: Vec<String>,
    store: State<'_, Store>,
) -> Result<(), String> {
    let uuids: Vec<Uuid> = ids
        .iter()
        .map(|id| Uuid::parse_str(id).map_err(|e| e.to_string()))
        .collect::<Result<Vec<_>, _>>()?;
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        data.remote_rule_sets.retain(|r| !uuids.contains(&r.id));
    }
    store.save()
}

#[tauri::command]
pub fn toggle_individual_rule(id: String, store: State<'_, Store>) -> Result<(), String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        if let Some(rule) = data.individual_rules.iter_mut().find(|r| r.id == uuid) {
            rule.enabled = !rule.enabled;
        }
    }
    store.save()
}

#[tauri::command]
pub fn toggle_remote_rule_set(id: String, store: State<'_, Store>) -> Result<(), String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        if let Some(rs) = data.remote_rule_sets.iter_mut().find(|r| r.id == uuid) {
            rs.enabled = !rs.enabled;
        }
    }
    store.save()
}

#[tauri::command]
pub fn get_all_node_names(store: State<'_, Store>) -> Result<Vec<String>, String> {
    let data = store.data.lock().map_err(|e| e.to_string())?;
    let mut names: Vec<String> = Vec::new();
    for sub in &data.subscriptions {
        for name in &sub.node_names {
            if !names.contains(name) {
                names.push(name.clone());
            }
        }
    }
    for node in &data.extra_nodes {
        if !names.contains(&node.name) {
            names.push(node.name.clone());
        }
    }
    Ok(names)
}

#[tauri::command]
pub fn toggle_subscription_rule(key: String, store: State<'_, Store>) -> Result<(), String> {
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        if let Some(pos) = data.disabled_sub_rule_keys.iter().position(|k| k == &key) {
            data.disabled_sub_rule_keys.remove(pos);
        } else {
            data.disabled_sub_rule_keys.push(key);
        }
    }
    store.save()
}

#[tauri::command]
pub fn get_disabled_sub_rule_keys(store: State<'_, Store>) -> Result<Vec<String>, String> {
    let data = store.data.lock().map_err(|e| e.to_string())?;
    Ok(data.disabled_sub_rule_keys.clone())
}

#[tauri::command]
pub fn set_primary_subscription(id: String, store: State<'_, Store>) -> Result<(), String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        for sub in &mut data.subscriptions {
            sub.is_primary = sub.id == uuid;
        }
    }
    store.save()
}

#[tauri::command]
pub fn get_general_settings(store: State<'_, Store>) -> Result<GeneralSettings, String> {
    let data = store.data.lock().map_err(|e| e.to_string())?;
    Ok(data.general_settings.clone())
}

#[tauri::command]
pub fn update_general_settings(
    settings: GeneralSettings,
    store: State<'_, Store>,
) -> Result<(), String> {
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        data.general_settings = settings;
    }
    store.save()
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct AdvancedSections {
    pub mitm: String,
    pub host: String,
    pub url_rewrite: String,
}

#[tauri::command]
pub fn get_advanced_sections(store: State<'_, Store>) -> Result<AdvancedSections, String> {
    let data = store.data.lock().map_err(|e| e.to_string())?;
    Ok(AdvancedSections {
        mitm: data.mitm_section.clone(),
        host: data.host_section.clone(),
        url_rewrite: data.url_rewrite_section.clone(),
    })
}

#[tauri::command]
pub fn update_advanced_sections(
    sections: AdvancedSections,
    store: State<'_, Store>,
) -> Result<(), String> {
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        data.mitm_section = sections.mitm;
        data.host_section = sections.host;
        data.url_rewrite_section = sections.url_rewrite;
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

    // Resolve output path and write fixed-name file
    let output_dir = shellexpand_tilde(&data.output_config.output_path);
    fs::create_dir_all(&output_dir).map_err(|e| format!("Cannot create output dir: {}", e))?;

    let output_filename = if data.output_config.output_filename.is_empty() {
        "surge.conf".to_string()
    } else {
        data.output_config.output_filename.clone()
    };

    let content = if data.output_config.minify {
        minify_config(&config_content)
    } else {
        config_content.clone()
    };

    let full_path = PathBuf::from(&output_dir).join(&output_filename);
    fs::write(&full_path, &content).map_err(|e| format!("Failed to write config: {}", e))?;

    // Backup dir lives inside the app data directory
    let backup_dir = store.app_data_dir().join("backups");
    fs::create_dir_all(&backup_dir).map_err(|e| format!("Cannot create backup dir: {}", e))?;

    // Check if content changed compared to the most recent backup
    let last_backup_content = fs::read_dir(&backup_dir)
        .ok()
        .and_then(|entries| {
            let mut files: Vec<_> = entries
                .filter_map(|e| e.ok())
                .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("conf"))
                .collect();
            files.sort_by_key(|e| std::cmp::Reverse(e.file_name()));
            files.into_iter().next()
        })
        .and_then(|entry| fs::read_to_string(entry.path()).ok());

    let content_changed = last_backup_content.as_deref() != Some(content.as_str());

    let backup_filename = if content_changed {
        let name = format!("scm_{}.conf", chrono::Utc::now().format("%Y%m%d_%H%M%S"));
        let backup_path = backup_dir.join(&name);
        fs::write(&backup_path, &content).map_err(|e| format!("Failed to write backup: {}", e))?;
        name
    } else {
        String::new()
    };

    let rule_count = data.individual_rules.len() + data.remote_rule_sets.len();
    let description = if content_changed {
        format!("Based on {} rules", rule_count)
    } else {
        format!("No change · {} rules", rule_count)
    };

    let record = BuildRecord {
        id: Uuid::new_v4(),
        filename: backup_filename,
        description,
        time: chrono::Utc::now(),
        status: BuildStatus::Success,
    };

    // Drop lock before re-acquiring to push build record
    drop(data);

    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        data.build_history.insert(0, record.clone());
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

// ── Backup / Version Rollback ──

#[tauri::command]
pub fn get_backups(store: State<'_, Store>) -> Result<Vec<BackupInfo>, String> {
    let backup_dir = store.app_data_dir().join("backups");
    let entries =
        fs::read_dir(&backup_dir).map_err(|e| format!("Cannot read backup dir: {}", e))?;

    let mut backups: Vec<BackupInfo> = entries
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("conf"))
        .filter_map(|entry| {
            let path = entry.path();
            let metadata = entry.metadata().ok()?;
            let filename = path.file_name()?.to_str()?.to_string();
            let created = metadata.created().ok()?;
            let created: DateTime<Utc> = created.into();
            Some(BackupInfo {
                filename,
                size_bytes: metadata.len(),
                created,
            })
        })
        .collect();

    backups.sort_by_key(|b| std::cmp::Reverse(b.created));
    Ok(backups)
}

#[tauri::command]
pub fn get_backup_content(filename: String, store: State<'_, Store>) -> Result<String, String> {
    let backup_path = store.app_data_dir().join("backups").join(&filename);
    fs::read_to_string(&backup_path)
        .map_err(|e| format!("Cannot read backup file '{}': {}", filename, e))
}

#[tauri::command]
pub fn rollback_to_backup(filename: String, store: State<'_, Store>) -> Result<(), String> {
    let data = store.data.lock().map_err(|e| e.to_string())?;
    let backup_path = store.app_data_dir().join("backups").join(&filename);
    let content = fs::read_to_string(&backup_path)
        .map_err(|e| format!("Cannot read backup file '{}': {}", filename, e))?;

    let output_dir = shellexpand_tilde(&data.output_config.output_path);
    fs::create_dir_all(&output_dir).map_err(|e| format!("Cannot create output dir: {}", e))?;

    let output_filename = if data.output_config.output_filename.is_empty() {
        "surge.conf".to_string()
    } else {
        data.output_config.output_filename.clone()
    };

    let full_path = PathBuf::from(&output_dir).join(&output_filename);
    fs::write(&full_path, &content).map_err(|e| format!("Failed to write config: {}", e))?;
    Ok(())
}

// ── Cloud Sync ──

#[derive(serde::Serialize)]
pub struct CloudSyncState {
    pub is_configured: bool,
    pub last_synced_at: Option<DateTime<Utc>>,
    pub status: String,
}

#[tauri::command]
pub fn get_cloud_sync_settings(
    store: State<'_, Store>,
) -> Result<CloudSyncSettings, String> {
    let data = store.data.lock().map_err(|e| e.to_string())?;
    Ok(data.cloud_sync_settings.clone())
}

#[tauri::command]
pub fn update_cloud_sync_settings(
    settings: CloudSyncSettings,
    store: State<'_, Store>,
) -> Result<(), String> {
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        data.cloud_sync_settings = settings;
    }
    store.save()
}

#[tauri::command]
pub async fn sync_to_cloud(
    store: State<'_, Store>,
) -> Result<CloudSyncState, String> {
    let settings = {
        let data = store.data.lock().map_err(|e| e.to_string())?;
        data.cloud_sync_settings.clone()
    };

    if !settings.enabled || settings.github_pat.is_none() || settings.repo_url.is_none() {
        return Err("Cloud sync not configured".to_string());
    }

    let client = crate::cloud_sync::CloudSyncClient::new(&settings)
        .map_err(|e| e.to_string())?;

    // Serialize all app data as JSON
    let app_data_json = {
        let data = store.data.lock().map_err(|e| e.to_string())?;
        serde_json::to_string(&*data).map_err(|e| e.to_string())?
    };

    // Check if file exists and get SHA
    let existing = client.get_file_info("scm_data.json").await
        .map_err(|e| e.to_string())?;
    let sha = existing.map(|(s, _)| s);

    // Push to GitHub
    client.put_file("scm_data.json", &app_data_json, sha).await
        .map_err(|e| e.to_string())?;

    // Update last_synced_at
    let now = chrono::Utc::now();
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        data.cloud_sync_settings.last_synced_at = Some(now);
    }
    store.save()?;

    Ok(CloudSyncState {
        is_configured: true,
        last_synced_at: Some(now),
        status: "idle".to_string(),
    })
}

#[tauri::command]
pub async fn sync_from_cloud(
    store: State<'_, Store>,
) -> Result<(), String> {
    let settings = {
        let data = store.data.lock().map_err(|e| e.to_string())?;
        data.cloud_sync_settings.clone()
    };

    if !settings.enabled || settings.github_pat.is_none() || settings.repo_url.is_none() {
        return Err("Cloud sync not configured".to_string());
    }

    let client = crate::cloud_sync::CloudSyncClient::new(&settings)
        .map_err(|e| e.to_string())?;
    let content = client.get_file_content("scm_data.json").await
        .map_err(|e| e.to_string())?;
    let cloud_data: AppData = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid cloud data format: {}", e))?;

    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        *data = cloud_data;
    }
    store.save()?;

    Ok(())
}

#[derive(serde::Serialize)]
pub struct SyncConflictInfo {
    pub local_sha: Option<String>,
    pub cloud_sha: String,
    pub local_content: String,
    pub cloud_content: String,
}

#[tauri::command]
pub async fn check_sync_conflict(
    store: State<'_, Store>,
) -> Result<Option<SyncConflictInfo>, String> {
    let settings = {
        let data = store.data.lock().map_err(|e| e.to_string())?;
        data.cloud_sync_settings.clone()
    };

    if !settings.enabled || settings.github_pat.is_none() || settings.repo_url.is_none() {
        return Ok(None);
    }

    let client = crate::cloud_sync::CloudSyncClient::new(&settings)
        .map_err(|e| e.to_string())?;
    let existing = client.get_file_info("scm_data.json").await
        .map_err(|e| e.to_string())?;

    let Some((cloud_sha, _)) = existing else {
        return Ok(None);
    };

    let local_content = {
        let data = store.data.lock().map_err(|e| e.to_string())?;
        serde_json::to_string(&*data).map_err(|e| e.to_string())?
    };

    // Compute local SHA (simple hash-based approximation)
    let local_sha = Some(sha256_string(&local_content));

    if local_sha.as_ref() != Some(&cloud_sha) {
        let cloud_content = client.get_file_content("scm_data.json").await
            .map_err(|e| e.to_string())?;
        Ok(Some(SyncConflictInfo {
            local_sha,
            cloud_sha,
            local_content,
            cloud_content,
        }))
    } else {
        Ok(None)
    }
}

fn sha256_string(input: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    input.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
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
