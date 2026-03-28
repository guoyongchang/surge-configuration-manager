use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SubSource {
    Url,
    File,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subscription {
    pub id: Uuid,
    pub name: String,
    /// The subscription source: a URL or a local file path
    pub url: String,
    /// Whether this subscription is from a URL or a local file
    #[serde(default = "default_sub_source")]
    pub source_type: SubSource,
    pub node_count: usize,
    pub last_refreshed: Option<DateTime<Utc>>,
    pub interval_secs: u64,
    pub status: SubStatus,
    pub usage_used_gb: f64,
    pub usage_total_gb: f64,
    pub expires: Option<String>,
    /// Raw content fetched from the subscription URL or read from file
    pub raw_content: String,
    /// Parsed proxy node names from [Proxy] section
    pub node_names: Vec<String>,
    /// Parsed proxy group lines from [Proxy Group] section
    pub proxy_group_lines: Vec<String>,
    /// Raw rule lines from [Rule] section
    #[serde(default)]
    pub rule_lines: Vec<String>,
    /// Only one subscription can be primary; it contributes Proxy Group and Rules.
    /// Non-primary subscriptions contribute nodes only.
    #[serde(default)]
    pub is_primary: bool,
}

fn default_sub_source() -> SubSource {
    SubSource::Url
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SubStatus {
    Active,
    Standby,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteRuleSet {
    pub id: Uuid,
    pub name: String,
    pub url: String,
    pub policy: String,
    pub update_interval: u64,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndividualRule {
    pub id: Uuid,
    pub rule_type: String,
    pub value: String,
    pub policy: String,
    pub comment: Option<String>,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtraNode {
    pub id: Uuid,
    pub name: String,
    pub node_type: String,
    pub server: String,
    pub port: u16,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    pub refresh_url: Option<String>,
    pub raw_line: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneralSettings {
    pub http_listen: Option<String>,
    pub socks5_listen: Option<String>,
    pub extra_lines: Vec<String>,
}

impl Default for GeneralSettings {
    fn default() -> Self {
        Self {
            http_listen: Some("0.0.0.0:7890".to_string()),
            socks5_listen: Some("0.0.0.0:7891".to_string()),
            extra_lines: vec![
                "internet-test-url = http://google.com/".to_string(),
                "proxy-test-url = http://google.com/".to_string(),
                "test-timeout = 5".to_string(),
                "loglevel = notify".to_string(),
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputConfig {
    pub output_path: String,
    #[serde(default = "default_output_filename")]
    pub output_filename: String,
    pub auto_regenerate: bool,
    pub minify: bool,
    pub auto_upload: bool,
}

fn default_output_filename() -> String {
    "surge.conf".to_string()
}

impl Default for OutputConfig {
    fn default() -> Self {
        Self {
            output_path: "~/Library/Application Support/Surge/Profiles/".to_string(),
            output_filename: default_output_filename(),
            auto_regenerate: true,
            minify: false,
            auto_upload: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildRecord {
    pub id: Uuid,
    pub filename: String,
    pub description: String,
    pub time: DateTime<Utc>,
    pub status: BuildStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum BuildStatus {
    Success,
    Error,
}

/// The entire app state that gets persisted to disk
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppData {
    pub subscriptions: Vec<Subscription>,
    pub remote_rule_sets: Vec<RemoteRuleSet>,
    pub individual_rules: Vec<IndividualRule>,
    pub extra_nodes: Vec<ExtraNode>,
    pub general_settings: GeneralSettings,
    pub output_config: OutputConfig,
    pub build_history: Vec<BuildRecord>,
    /// Extra sections like [Host], [URL Rewrite], [MITM] stored as raw text
    pub host_section: String,
    pub url_rewrite_section: String,
    pub mitm_section: String,
    /// Keys of subscription-sourced rules that the user has disabled
    /// Format: "{subscription_id}:{rule_line}"
    #[serde(default)]
    pub disabled_sub_rule_keys: Vec<String>,
}
