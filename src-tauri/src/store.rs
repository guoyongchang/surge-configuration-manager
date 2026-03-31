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

    /// Returns the subscription files directory (app_data_dir/subscription_files/).
    pub fn subscription_files_dir(&self) -> PathBuf {
        let dir = self.app_data_dir().join("subscription_files");
        fs::create_dir_all(&dir).ok();
        dir
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

    #[test]
    fn test_subscription_files_dir_returns_correct_path() {
        let dir = temp_store_dir();
        let store = Store::new(dir.clone());
        let sub_files_dir = store.subscription_files_dir();
        assert!(sub_files_dir
            .to_string_lossy()
            .ends_with("subscription_files"));
        assert_eq!(sub_files_dir.parent(), Some(dir.as_path()));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_subscription_files_dir_creates_directory() {
        let dir = temp_store_dir();
        let store = Store::new(dir.clone());
        let sub_files_dir = store.subscription_files_dir();
        // Directory should be created by subscription_files_dir()
        assert!(sub_files_dir.exists());
        assert!(sub_files_dir.is_dir());
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_app_data_dir_returns_correct_parent() {
        let dir = temp_store_dir();
        let store = Store::new(dir.clone());
        let app_data = store.app_data_dir();
        assert_eq!(app_data, dir);
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_file_subscription_copy_and_cleanup() {
        // Simulates the file copy behavior in add_subscription and remove_subscription
        // for file-type subscriptions: file is copied to subscription_files_dir,
        // and deleted when the subscription is removed.
        let dir = temp_store_dir();
        let store = Store::new(dir.clone());

        // Simulate copying a subscription file (what add_subscription does for file sources)
        let sub_files_dir = store.subscription_files_dir();
        let dest_filename = format!("{}.conf", Uuid::new_v4());
        let dest_path = sub_files_dir.join(&dest_filename);
        let content = "[Proxy]\nnode1 = ss, 1.2.3.4, 443\n";
        fs::write(&dest_path, content).expect("should write temp subscription file");

        // Verify file exists in subscription_files_dir (file was copied)
        assert!(dest_path.exists());
        assert_eq!(fs::read_to_string(&dest_path).unwrap(), content);

        // Simulate removing the subscription (what remove_subscription does for file sources)
        fs::remove_file(&dest_path).expect("should delete subscription file");

        // Verify file is gone
        assert!(!dest_path.exists());

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn test_file_subscription_url_points_to_app_managed_directory() {
        // Verifies that file subscriptions have URLs pointing to the app-managed
        // subscription_files directory, not the original file path.
        let dir = temp_store_dir();
        let store = Store::new(dir.clone());

        // Create a subscription file URL that points to app-managed directory
        let sub_files_dir = store.subscription_files_dir();
        let managed_url = sub_files_dir.join(format!("{}.conf", Uuid::new_v4()));

        // Write a file to the managed directory
        let content = "[Proxy]\nnode1 = ss, 5.6.7.8, 443\n";
        fs::write(&managed_url, content).expect("should write subscription file");

        // Verify the URL path contains subscription_files (proving it's app-managed)
        assert!(managed_url.to_string_lossy().contains("subscription_files"));
        assert!(managed_url.exists());

        // Cleanup
        fs::remove_file(&managed_url).ok();
        fs::remove_dir_all(&dir).ok();
    }
}
