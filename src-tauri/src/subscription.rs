use crate::models::{SubSource, SubStatus, Subscription};
use uuid::Uuid;

/// Fetch subscription content from URL
pub async fn fetch_subscription(url: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(false)
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(url)
        .header("User-Agent", "Surge/1921 CFNetwork/1568.200.51")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }

    resp.text()
        .await
        .map_err(|e| format!("Failed to read body: {}", e))
}

/// Read subscription content from a local file
pub fn read_subscription_file(path: &str) -> Result<String, String> {
    std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

/// Check if content looks like a valid Surge subscription/config
/// (must contain at least a [Proxy] section with some nodes)
pub fn is_valid_subscription_content(content: &str) -> bool {
    let has_proxy_section = content.contains("[Proxy]");
    if !has_proxy_section {
        return false;
    }
    // Check that there's at least one proxy line (name = protocol, ...)
    let mut in_proxy = false;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == "[Proxy]" {
            in_proxy = true;
            continue;
        }
        if in_proxy {
            if trimmed.starts_with('[') && trimmed.ends_with(']') {
                break;
            }
            if trimmed.contains(" = ") && !trimmed.starts_with('#') {
                return true;
            }
        }
    }
    false
}

/// Try to fetch subscription from URL, returning Ok(content) only if
/// the response is successful AND the content is valid.
/// Returns Err if the URL is expired/invalid or content can't be parsed.
pub async fn try_fetch_subscription(url: &str) -> Result<String, String> {
    let content = fetch_subscription(url).await?;
    if is_valid_subscription_content(&content) {
        Ok(content)
    } else {
        Err("Fetched content is not a valid Surge subscription".to_string())
    }
}

/// Extract rule lines from the [Rule] section of a subscription config.
/// Used to re-derive rule_lines from raw_content on store load.
pub fn extract_rule_lines(content: &str) -> Vec<String> {
    let mut rule_lines = Vec::new();
    let mut in_rule = false;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            in_rule = trimmed == "[Rule]";
            continue;
        }
        if in_rule && !trimmed.is_empty() && !trimmed.starts_with('#') && !trimmed.starts_with("FINAL,") {
            rule_lines.push(trimmed.to_string());
        }
    }
    rule_lines
}

/// Parse a subscription .conf file content into a Subscription struct
pub fn parse_subscription(
    name: &str,
    source: &str,
    source_type: SubSource,
    content: &str,
) -> Subscription {
    let mut node_names: Vec<String> = Vec::new();
    let mut proxy_group_lines: Vec<String> = Vec::new();
    let mut rule_lines: Vec<String> = Vec::new();
    let mut usage_used: f64 = 0.0;
    let mut usage_total: f64 = 0.0;
    let mut expires: Option<String> = None;

    let mut current_section = "";

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            current_section = trimmed;
            continue;
        }

        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        match current_section {
            "[Proxy]" => {
                // Parse proxy lines: "name = protocol, ..."
                if let Some(eq_pos) = trimmed.find(" = ") {
                    let name_part = trimmed[..eq_pos].trim();
                    // Extract usage info from special nodes
                    if name_part.contains("当前流量") || name_part.contains("Current Usage") {
                        if let Some(caps) = parse_usage(name_part) {
                            usage_used = caps.0;
                            usage_total = caps.1;
                        }
                    } else if name_part.contains("到期时间") || name_part.contains("Expire") {
                        expires = parse_expires(name_part);
                    } else if name_part != "DIRECT" {
                        node_names.push(name_part.to_string());
                    }
                }
            }
            "[Proxy Group]" => {
                proxy_group_lines.push(trimmed.to_string());
            }
            "[Rule]" => {
                // Skip FINAL rules — they must be last and user controls final policy
                if !trimmed.starts_with("FINAL,") {
                    rule_lines.push(trimmed.to_string());
                }
            }
            _ => {}
        }
    }

    Subscription {
        id: Uuid::new_v4(),
        name: name.to_string(),
        url: source.to_string(),
        source_type,
        node_count: node_names.len(),
        last_refreshed: Some(chrono::Utc::now()),
        interval_secs: 43200, // 12 hours default
        status: SubStatus::Active,
        usage_used_gb: usage_used,
        usage_total_gb: usage_total,
        expires,
        raw_content: content.to_string(),
        node_names,
        proxy_group_lines,
        rule_lines,
        is_primary: false,
    }
}

fn parse_usage(s: &str) -> Option<(f64, f64)> {
    // "当前流量：366.64G / 1000.00G" or similar
    let s = s.replace("当前流量", "").replace("Current Usage", "");
    let s = s.replace('：', ":").replace(':', "");
    let parts: Vec<&str> = s.split('/').collect();
    if parts.len() == 2 {
        let used = parts[0]
            .trim()
            .trim_end_matches('G')
            .trim_end_matches("GB")
            .trim()
            .parse::<f64>()
            .ok()?;
        let total = parts[1]
            .trim()
            .trim_end_matches('G')
            .trim_end_matches("GB")
            .trim()
            .parse::<f64>()
            .ok()?;
        Some((used, total))
    } else {
        None
    }
}

fn parse_expires(s: &str) -> Option<String> {
    // "到期时间：2026-12-27"
    let s = s.replace("到期时间", "").replace("Expire", "");
    let s = s.replace('：', ":").replace(':', "");
    let s = s.trim().to_string();
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::SubSource;

    const SAMPLE_CONF: &str = r#"[General]
loglevel = notify

[Proxy]
当前流量：366.64G / 1000.00G = direct, server=0.0.0.0, port=0
到期时间：2026-12-27 = direct, server=0.0.0.0, port=0
DIRECT = direct
HK-01 = ss, 1.2.3.4, 443, encrypt-method=aes-256-gcm, password=secret
JP-01 = vmess, 5.6.7.8, 8080, username=abc

[Proxy Group]
Auto = url-test, HK-01, JP-01, url=http://google.com, interval=300
"#;

    // ── is_valid_subscription_content ─────────────────────────────────────

    #[test]
    fn test_valid_content_has_proxy_section_with_node() {
        let content = "[Proxy]\nnode1 = ss, 1.2.3.4, 443\n";
        assert!(is_valid_subscription_content(content));
    }

    #[test]
    fn test_invalid_content_no_proxy_section() {
        let content = "[General]\nloglevel = notify\n";
        assert!(!is_valid_subscription_content(content));
    }

    #[test]
    fn test_invalid_content_empty_proxy_section() {
        let content = "[Proxy]\n[Proxy Group]\ngroup1 = url-test\n";
        assert!(!is_valid_subscription_content(content));
    }

    #[test]
    fn test_invalid_content_only_comments_in_proxy() {
        let content = "[Proxy]\n# just a comment\n[Proxy Group]\n";
        assert!(!is_valid_subscription_content(content));
    }

    #[test]
    fn test_valid_content_stops_checking_after_next_section() {
        let content = "[Proxy]\nnode1 = ss, 1.2.3.4, 443\n[Proxy Group]\ngroup = url-test, node1\n";
        assert!(is_valid_subscription_content(content));
    }

    // ── parse_usage ───────────────────────────────────────────────────────

    #[test]
    fn test_parse_usage_chinese_format() {
        let (used, total) = parse_usage("当前流量：366.64G / 1000.00G").unwrap();
        assert!((used - 366.64).abs() < 0.001);
        assert!((total - 1000.00).abs() < 0.001);
    }

    #[test]
    fn test_parse_usage_english_format_gb() {
        let (used, total) = parse_usage("Current Usage: 100.00GB / 500.00GB").unwrap();
        assert!((used - 100.00).abs() < 0.001);
        assert!((total - 500.00).abs() < 0.001);
    }

    #[test]
    fn test_parse_usage_invalid_no_slash() {
        assert!(parse_usage("当前流量：no slash here").is_none());
    }

    #[test]
    fn test_parse_usage_invalid_non_numeric() {
        assert!(parse_usage("当前流量：abcG / xyzG").is_none());
    }

    // ── parse_expires ─────────────────────────────────────────────────────

    #[test]
    fn test_parse_expires_chinese_format() {
        assert_eq!(
            parse_expires("到期时间：2026-12-27"),
            Some("2026-12-27".to_string())
        );
    }

    #[test]
    fn test_parse_expires_english_format() {
        assert_eq!(
            parse_expires("Expire: 2027-01-01"),
            Some("2027-01-01".to_string())
        );
    }

    #[test]
    fn test_parse_expires_empty_returns_none() {
        assert!(parse_expires("到期时间：").is_none());
    }

    // ── parse_subscription ────────────────────────────────────────────────

    #[test]
    fn test_parse_subscription_node_count() {
        let sub = parse_subscription("Test", "http://example.com", SubSource::Url, SAMPLE_CONF);
        assert_eq!(sub.node_count, 2);
        assert!(sub.node_names.contains(&"HK-01".to_string()));
        assert!(sub.node_names.contains(&"JP-01".to_string()));
    }

    #[test]
    fn test_parse_subscription_excludes_direct_and_info_nodes() {
        let sub = parse_subscription("Test", "http://example.com", SubSource::Url, SAMPLE_CONF);
        assert!(!sub.node_names.contains(&"DIRECT".to_string()));
        assert!(!sub.node_names.iter().any(|n| n.contains("当前流量")));
        assert!(!sub.node_names.iter().any(|n| n.contains("到期时间")));
    }

    #[test]
    fn test_parse_subscription_usage_extracted() {
        let sub = parse_subscription("Test", "http://example.com", SubSource::Url, SAMPLE_CONF);
        assert!((sub.usage_used_gb - 366.64).abs() < 0.001);
        assert!((sub.usage_total_gb - 1000.00).abs() < 0.001);
    }

    #[test]
    fn test_parse_subscription_expires_extracted() {
        let sub = parse_subscription("Test", "http://example.com", SubSource::Url, SAMPLE_CONF);
        assert_eq!(sub.expires, Some("2026-12-27".to_string()));
    }

    #[test]
    fn test_parse_subscription_proxy_group_lines() {
        let sub = parse_subscription("Test", "http://example.com", SubSource::Url, SAMPLE_CONF);
        assert_eq!(sub.proxy_group_lines.len(), 1);
        assert!(sub.proxy_group_lines[0].starts_with("Auto"));
    }

    #[test]
    fn test_parse_subscription_source_type_and_url() {
        let content = "[Proxy]\nnode1 = ss, 1.2.3.4, 443\n";
        let sub = parse_subscription("Local", "/path/to/file.conf", SubSource::File, content);
        assert_eq!(sub.source_type, SubSource::File);
        assert_eq!(sub.url, "/path/to/file.conf");
        assert_eq!(sub.name, "Local");
    }

    #[test]
    fn test_parse_subscription_no_usage_defaults_to_zero() {
        let content = "[Proxy]\nnode1 = ss, 1.2.3.4, 443\n";
        let sub = parse_subscription("Test", "http://example.com", SubSource::Url, content);
        assert_eq!(sub.usage_used_gb, 0.0);
        assert_eq!(sub.usage_total_gb, 0.0);
        assert!(sub.expires.is_none());
    }

    #[test]
    fn test_parse_subscription_raw_content_stored() {
        let content = "[Proxy]\nnode1 = ss, 1.2.3.4, 443\n";
        let sub = parse_subscription("Test", "http://example.com", SubSource::Url, content);
        assert_eq!(sub.raw_content, content);
    }
}
