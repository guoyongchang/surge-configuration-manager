use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::models::{CloudBackupFile, CloudSyncSettings};

const GITHUB_API: &str = "https://api.github.com";

#[derive(Debug, Deserialize)]
struct GithubContentResponse {
    name: String,
    sha: String,
    content: String,
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
        headers.insert("X-GitHub-Api-Version", "2022-11-28".parse().unwrap());
        headers
    }

    /// Get file SHA and last_modified from GitHub (returns None if file doesn't exist)
    pub async fn get_file_info(
        &self,
        path: &str,
    ) -> Result<Option<(String, Option<String>)>, String> {
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

        if resp.status() == 404 {
            return Ok(None);
        }
        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("GitHub API error: {} {}", status, text));
        }

        let content: GithubContentResponse = resp
            .json()
            .await
            .map_err(|e| format!("Parse error: {}", e))?;
        Ok(Some((content.sha, content.last_modified)))
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

    /// Check which files differ between local and cloud
    pub async fn diff(
        &self,
        local_files: &[(&str, Option<DateTime<Utc>>)],
    ) -> Result<Vec<CloudBackupFile>, String> {
        let mut diffs = Vec::new();
        for (path, local_modified) in local_files {
            if let Some((sha, cloud_modified_str)) = self.get_file_info(path).await? {
                let cloud_modified = cloud_modified_str
                    .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
                    .map(|dt| dt.with_timezone(&Utc));

                diffs.push(CloudBackupFile {
                    path: path.to_string(),
                    sha,
                    local_modified: *local_modified,
                    cloud_modified,
                });
            }
        }
        Ok(diffs)
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
