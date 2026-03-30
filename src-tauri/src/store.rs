use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use tokio::sync::Mutex as AsyncMutex;

use crate::models::AppData;
use crate::subscription::extract_rule_lines;

pub struct Store {
    path: PathBuf,
    pub data: Mutex<AppData>,
    pub sync_lock: AsyncMutex<()>,
}

impl Store {
    pub fn new(app_data_dir: PathBuf) -> Self {
        fs::create_dir_all(&app_data_dir).ok();
        let path = app_data_dir.join("scm_data.json");

        let mut data: AppData = if path.exists() {
            match fs::read_to_string(&path) {
                Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
                Err(_) => AppData::default(),
            }
        } else {
            AppData::default()
        };

        // Re-derive rule_lines from raw_content so existing subscriptions
        // (stored before this field was added) always have up-to-date rules.
        for sub in &mut data.subscriptions {
            sub.rule_lines = extract_rule_lines(&sub.raw_content);
        }

        Store {
            path,
            data: Mutex::new(data),
            sync_lock: AsyncMutex::new(()),
        }
    }

    pub fn save(&self) -> Result<(), String> {
        let data = self.data.lock().map_err(|e| e.to_string())?;
        let json = serde_json::to_string_pretty(&*data).map_err(|e| e.to_string())?;
        fs::write(&self.path, json).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Returns the app data directory (parent of `scm_data.json`).
    pub fn app_data_dir(&self) -> PathBuf {
        self.path
            .parent()
            .expect("store path has no parent")
            .to_path_buf()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn temp_store_dir() -> PathBuf {
        let mut dir = std::env::temp_dir();
        dir.push(format!("scm_test_{}", Uuid::new_v4()));
        dir
    }

    #[test]
    fn test_new_store_defaults_when_no_file() {
        let dir = temp_store_dir();
        let store = Store::new(dir.clone());
        let data = store.data.lock().unwrap();
        assert!(data.subscriptions.is_empty());
        assert!(data.individual_rules.is_empty());
        assert!(data.extra_nodes.is_empty());
        assert!(data.remote_rule_sets.is_empty());
        drop(data);
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_save_creates_json_file() {
        let dir = temp_store_dir();
        let store = Store::new(dir.clone());
        store.save().expect("save should succeed");
        assert!(dir.join("scm_data.json").exists());
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_save_and_reload_roundtrip() {
        use crate::models::HostEntry;
        let dir = temp_store_dir();
        {
            let store = Store::new(dir.clone());
            store.data.lock().unwrap().hosts.push(HostEntry {
                id: Uuid::new_v4(),
                domain: "test.example.com".to_string(),
                ip: "1.2.3.4".to_string(),
                enabled: true,
            });
            store.save().expect("save should succeed");
        }
        {
            let store2 = Store::new(dir.clone());
            let data = store2.data.lock().unwrap();
            assert_eq!(data.hosts.len(), 1);
            assert_eq!(data.hosts[0].domain, "test.example.com");
            assert_eq!(data.hosts[0].ip, "1.2.3.4");
        }
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_corrupted_json_falls_back_to_default() {
        let dir = temp_store_dir();
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("scm_data.json"), b"not valid json").unwrap();
        let store = Store::new(dir.clone());
        let data = store.data.lock().unwrap();
        assert!(data.subscriptions.is_empty());
        drop(data);
        fs::remove_dir_all(&dir).ok();
    }
}
