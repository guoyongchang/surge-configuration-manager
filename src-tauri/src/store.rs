use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::models::AppData;

pub struct Store {
    path: PathBuf,
    pub data: Mutex<AppData>,
}

impl Store {
    pub fn new(app_data_dir: PathBuf) -> Self {
        fs::create_dir_all(&app_data_dir).ok();
        let path = app_data_dir.join("scm_data.json");

        let data = if path.exists() {
            match fs::read_to_string(&path) {
                Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
                Err(_) => AppData::default(),
            }
        } else {
            AppData::default()
        };

        Store {
            path,
            data: Mutex::new(data),
        }
    }

    pub fn save(&self) -> Result<(), String> {
        let data = self.data.lock().map_err(|e| e.to_string())?;
        let json = serde_json::to_string_pretty(&*data).map_err(|e| e.to_string())?;
        fs::write(&self.path, json).map_err(|e| e.to_string())?;
        Ok(())
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
        let dir = temp_store_dir();
        {
            let store = Store::new(dir.clone());
            store.data.lock().unwrap().host_section = "test.example.com = 1.2.3.4".to_string();
            store.save().expect("save should succeed");
        }
        {
            let store2 = Store::new(dir.clone());
            let data = store2.data.lock().unwrap();
            assert_eq!(data.host_section, "test.example.com = 1.2.3.4");
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
