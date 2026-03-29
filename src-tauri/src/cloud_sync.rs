use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

use crate::models::CloudSyncSettings;

const GITHUB_API: &str = "https://api.github.com";

#[derive(Debug, Deserialize)]
struct GithubContentResponse {
    #[allow(dead_code)]
    name: String,
    #[allow(dead_code)]
    sha: String,
    content: String,
    #[allow(dead_code)]
    #[serde(rename = "last_modified")]
    last_modified: Option<String>,
}

#[derive(Debug, Serialize)]
struct GithubCreateFile {
    message: String,
    content: String,
    sha: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GithubCreateResponse {
    commit: GithubCommit,
}

#[derive(Debug, Deserialize)]
struct GithubCommit {
    sha: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSyncManifest {
    pub version: u32,
    pub files: HashMap<String, ManifestFileEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestFileEntry {
    pub sha: String,
}

impl CloudSyncManifest {
    pub fn new() -> Self {
        Self {
            version: 1,
            files: HashMap::new(),
        }
    }

    /// Compute SHA-256 hex of a JSON string
    pub fn compute_sha(content: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}

impl Default for CloudSyncManifest {
    fn default() -> Self {
        Self::new()
    }
}

pub struct CloudSyncClient {
    client: Client,
    pat: String,
    repo_owner: String,
    repo_name: String,
}

impl CloudSyncClient {
    pub fn new(settings: &CloudSyncSettings) -> Result<Self, String> {
        let pat = settings
            .github_pat
            .clone()
            .ok_or("GitHub PAT not configured")?;
        let repo_url = settings.repo_url.clone().ok_or("Repo URL not configured")?;
        let parts: Vec<&str> = repo_url.split('/').collect();
        if parts.len() != 2 {
            return Err("Repo URL must be in format 'owner/repo'".to_string());
        }
        Ok(Self {
            client: Client::new(),
            pat,
            repo_owner: parts[0].to_string(),
            repo_name: parts[1].to_string(),
        })
    }

    fn headers(&self) -> reqwest::header::HeaderMap {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            reqwest::header::AUTHORIZATION,
            format!("Bearer {}", self.pat).parse().unwrap(),
        );
        headers.insert(
            reqwest::header::ACCEPT,
            "application/vnd.github+json".parse().unwrap(),
        );
        headers.insert(
            reqwest::header::USER_AGENT,
            "Surge-Configuration-Manager/1.0".parse().unwrap(),
        );
        headers.insert("X-GitHub-Api-Version", "2022-11-28".parse().unwrap());
        headers
    }

    /// Push a single file to GitHub using PUT (creates or updates)
    pub async fn put_file(
        &self,
        path: &str,
        content: &str,
        sha: Option<String>,
    ) -> Result<String, String> {
        let url = format!(
            "{}/repos/{}/{}/contents/{}",
            GITHUB_API, self.repo_owner, self.repo_name, path
        );
        let body = GithubCreateFile {
            message: format!("SCM sync: {}", path),
            content: base64_encode(content),
            sha,
        };
        let resp = self
            .client
            .put(&url)
            .headers(self.headers())
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Push failed: {} - {}", status, text));
        }

        let result: GithubCreateResponse = resp
            .json()
            .await
            .map_err(|e| format!("Parse response: {}", e))?;
        Ok(result.commit.sha)
    }

    /// Fetch a file's raw content from GitHub
    pub async fn get_file_content(&self, path: &str) -> Result<String, String> {
        let url = format!(
            "{}/repos/{}/{}/contents/{}",
            GITHUB_API, self.repo_owner, self.repo_name, path
        );
        let resp = self
            .client
            .get(&url)
            .headers(self.headers())
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            return Err(format!(
                "Failed to fetch {}: {}",
                path,
                resp.status().as_u16()
            ));
        }

        let content: GithubContentResponse = resp
            .json()
            .await
            .map_err(|e| format!("Parse error: {}", e))?;
        base64_decode(&content.content)
    }

    /// Build local manifest from current AppData sections
    pub fn build_local_manifest(
        &self,
        subscriptions_json: &str,
        rules_remote_json: &str,
        rules_individual_json: &str,
        nodes_json: &str,
        output_config_json: &str,
    ) -> CloudSyncManifest {
        let mut manifest = CloudSyncManifest::new();
        manifest.files.insert(
            "subscriptions/data.json".to_string(),
            ManifestFileEntry {
                sha: CloudSyncManifest::compute_sha(subscriptions_json),
            },
        );
        manifest.files.insert(
            "rules/remote.json".to_string(),
            ManifestFileEntry {
                sha: CloudSyncManifest::compute_sha(rules_remote_json),
            },
        );
        manifest.files.insert(
            "rules/individual.json".to_string(),
            ManifestFileEntry {
                sha: CloudSyncManifest::compute_sha(rules_individual_json),
            },
        );
        manifest.files.insert(
            "nodes/data.json".to_string(),
            ManifestFileEntry {
                sha: CloudSyncManifest::compute_sha(nodes_json),
            },
        );
        manifest.files.insert(
            "output/config.json".to_string(),
            ManifestFileEntry {
                sha: CloudSyncManifest::compute_sha(output_config_json),
            },
        );
        manifest
    }

    /// Find which files differ between local and cloud manifests
    pub fn diff_manifests(
        &self,
        local: &CloudSyncManifest,
        cloud: Option<&CloudSyncManifest>,
    ) -> Vec<String> {
        let mut changed = Vec::new();
        let cloud_ref = cloud.unwrap_or(local);

        for (path, local_entry) in &local.files {
            if let Some(cloud_entry) = cloud_ref.files.get(path) {
                if local_entry.sha != cloud_entry.sha {
                    changed.push(path.clone());
                }
            } else {
                changed.push(path.clone());
            }
        }

        // Also check for files in cloud but not in local
        for path in cloud_ref.files.keys() {
            if !local.files.contains_key(path) {
                changed.push(path.clone());
            }
        }

        changed
    }
}

fn base64_encode(input: &str) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(input)
}

fn base64_decode(input: &str) -> Result<String, String> {
    use base64::Engine;
    let trimmed = input.trim();
    base64::engine::general_purpose::STANDARD
        .decode(trimmed)
        .map_err(|e| format!("Base64 decode error: {}", e))
        .and_then(|bytes| {
            String::from_utf8(bytes).map_err(|e| format!("UTF-8 decode error: {}", e))
        })
}
