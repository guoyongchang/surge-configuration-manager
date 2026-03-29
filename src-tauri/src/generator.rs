use crate::models::AppData;

/// Generate a complete Surge .conf file from the app data
pub fn generate_config(data: &AppData) -> String {
    let mut out = String::new();

    // [General]
    out.push_str("[General]\n");
    if let Some(ref h) = data.general_settings.http_listen {
        out.push_str(&format!("http-listen = {}\n", h));
    }
    if let Some(ref s) = data.general_settings.socks5_listen {
        out.push_str(&format!("socks5-listen = {}\n", s));
    }
    for line in &data.general_settings.extra_lines {
        out.push_str(line);
        out.push('\n');
    }
    out.push('\n');

    // [Proxy]
    out.push_str("[Proxy]\n");
    // Track emitted node names to deduplicate across subscriptions and extra nodes
    let mut seen_names: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Emit subscription proxy nodes directly
    for sub in &data.subscriptions {
        let mut in_proxy = false;
        for line in sub.raw_content.lines() {
            let trimmed = line.trim();
            if trimmed == "[Proxy]" {
                in_proxy = true;
                continue;
            }
            if trimmed.starts_with('[') && trimmed.ends_with(']') {
                in_proxy = false;
                continue;
            }
            if in_proxy && !trimmed.is_empty() && !trimmed.starts_with('#') {
                // Skip info nodes (usage/expiry)
                if let Some(eq_pos) = trimmed.find(" = ") {
                    let name = trimmed[..eq_pos].trim();
                    if name == "DIRECT"
                        || name.contains("当前流量")
                        || name.contains("到期时间")
                        || name.contains("Current Usage")
                        || name.contains("Expire")
                    {
                        continue;
                    }
                    // Deduplicate by node name
                    if seen_names.contains(name) {
                        continue;
                    }
                    seen_names.insert(name.to_string());
                }
                out.push_str(trimmed);
                out.push('\n');
            }
        }
    }
    // Extra nodes — also deduplicated
    for node in &data.extra_nodes {
        if seen_names.contains(&node.name) {
            continue;
        }
        seen_names.insert(node.name.clone());
        out.push_str(&node.raw_line);
        out.push('\n');
    }
    out.push('\n');

    // [Proxy Group]
    out.push_str("[Proxy Group]\n");
    // Only the primary subscription contributes proxy groups
    for sub in &data.subscriptions {
        if !sub.is_primary {
            continue;
        }
        for line in &sub.proxy_group_lines {
            out.push_str(line);
            out.push('\n');
        }
    }
    out.push('\n');

    // [Rule]
    out.push_str("[Rule]\n");
    // Individual rules first (higher priority)
    for rule in &data.individual_rules {
        if !rule.enabled {
            continue;
        }
        if let Some(ref comment) = rule.comment {
            out.push_str(&format!(
                "{},{},{} // {}\n",
                rule.rule_type, rule.value, rule.policy, comment
            ));
        } else {
            out.push_str(&format!(
                "{},{},{}\n",
                rule.rule_type, rule.value, rule.policy
            ));
        }
    }
    // Remote rule sets
    for rs in &data.remote_rule_sets {
        if !rs.enabled {
            continue;
        }
        out.push_str(&format!(
            "RULE-SET,{},{},update-interval={}\n",
            rs.url, rs.policy, rs.update_interval
        ));
    }
    // Subscription-sourced rules — only from the primary subscription
    for sub in &data.subscriptions {
        if !sub.is_primary {
            continue;
        }
        for line in &sub.rule_lines {
            let key = format!("{}:{}", sub.id, line);
            if data.disabled_sub_rule_keys.contains(&key) {
                continue;
            }
            out.push_str(line);
            out.push('\n');
        }
    }
    out.push('\n');

    // [Host]
    if !data.hosts.is_empty() {
        out.push_str("[Host]\n");
        for host in &data.hosts {
            if host.enabled {
                out.push_str(&format!("{} = {}\n", host.domain, host.ip));
            }
        }
        out.push('\n');
    }

    // [URL Rewrite]
    if !data.url_rewrites.is_empty() {
        out.push_str("[URL Rewrite]\n");
        for rewrite in &data.url_rewrites {
            if rewrite.enabled {
                out.push_str(&format!(
                    "{} {} {}\n",
                    rewrite.pattern, rewrite.replacement, rewrite.redirect_type
                ));
            }
        }
        out.push('\n');
    }

    // [MITM]
    if !data.mitm_section.is_empty() {
        out.push_str("[MITM]\n");
        out.push_str(&data.mitm_section);
        out.push('\n');
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::*;
    use uuid::Uuid;

    fn make_subscription(raw_content: &str) -> Subscription {
        Subscription {
            id: Uuid::new_v4(),
            name: "Test Sub".to_string(),
            url: "http://example.com".to_string(),
            source_type: SubSource::Url,
            node_count: 0,
            last_refreshed: None,
            interval_secs: 43200,
            status: SubStatus::Active,
            usage_used_gb: 0.0,
            usage_total_gb: 0.0,
            expires: None,
            raw_content: raw_content.to_string(),
            node_names: vec![],
            proxy_group_lines: vec![],
            rule_lines: vec![],
            is_primary: true,
        }
    }

    // ── Section structure ─────────────────────────────────────────────────

    #[test]
    fn test_empty_appdata_contains_required_sections() {
        let conf = generate_config(&AppData::default());
        assert!(conf.contains("[General]\n"));
        assert!(conf.contains("[Proxy]\n"));
        assert!(conf.contains("[Proxy Group]\n"));
        assert!(conf.contains("[Rule]\n"));
    }

    #[test]
    fn test_optional_sections_absent_when_empty() {
        let conf = generate_config(&AppData::default());
        assert!(!conf.contains("[Host]"));
        assert!(!conf.contains("[URL Rewrite]"));
        assert!(!conf.contains("[MITM]"));
    }

    // ── [General] ─────────────────────────────────────────────────────────

    #[test]
    fn test_general_section_contains_default_listen_ports() {
        let conf = generate_config(&AppData::default());
        assert!(conf.contains("http-listen = 0.0.0.0:7890\n"));
        assert!(conf.contains("socks5-listen = 0.0.0.0:7891\n"));
    }

    #[test]
    fn test_general_section_omits_listen_when_none() {
        let mut data = AppData::default();
        data.general_settings.http_listen = None;
        data.general_settings.socks5_listen = None;
        let conf = generate_config(&data);
        assert!(!conf.contains("http-listen"));
        assert!(!conf.contains("socks5-listen"));
    }

    #[test]
    fn test_general_section_includes_extra_lines() {
        let conf = generate_config(&AppData::default());
        assert!(conf.contains("internet-test-url = http://google.com/\n"));
        assert!(conf.contains("loglevel = notify\n"));
    }

    // ── [Proxy] ───────────────────────────────────────────────────────────

    #[test]
    fn test_subscription_nodes_inlined_in_proxy_section() {
        let mut data = AppData::default();
        data.subscriptions.push(make_subscription(
            "[Proxy]\nHK-01 = ss, 1.2.3.4, 443\nJP-01 = vmess, 5.6.7.8, 8080\n",
        ));
        let conf = generate_config(&data);
        assert!(conf.contains("HK-01 = ss, 1.2.3.4, 443\n"));
        assert!(conf.contains("JP-01 = vmess, 5.6.7.8, 8080\n"));
    }

    #[test]
    fn test_info_nodes_excluded_from_proxy_section() {
        let mut data = AppData::default();
        data.subscriptions.push(make_subscription(
            r#"[Proxy]
当前流量：100G / 500G = direct, server=0.0.0.0, port=0
到期时间：2026-12-27 = direct, server=0.0.0.0, port=0
DIRECT = direct
HK-01 = ss, 1.2.3.4, 443
"#,
        ));
        let conf = generate_config(&data);
        assert!(!conf.contains("当前流量"));
        assert!(!conf.contains("到期时间"));
        assert!(!conf.contains("DIRECT = direct"));
        assert!(conf.contains("HK-01 = ss, 1.2.3.4, 443\n"));
    }

    #[test]
    fn test_current_usage_english_excluded() {
        let mut data = AppData::default();
        data.subscriptions.push(make_subscription(
            "[Proxy]\nCurrent Usage: 50GB / 100GB = direct, server=0.0.0.0, port=0\nnode1 = ss, 1.1.1.1, 443\n",
        ));
        let conf = generate_config(&data);
        assert!(!conf.contains("Current Usage"));
        assert!(conf.contains("node1 = ss, 1.1.1.1, 443\n"));
    }

    #[test]
    fn test_extra_nodes_appended_to_proxy_section() {
        let mut data = AppData::default();
        data.extra_nodes.push(ExtraNode {
            id: Uuid::new_v4(),
            name: "MyProxy".to_string(),
            node_type: "socks5".to_string(),
            server: "127.0.0.1".to_string(),
            port: 1080,
            username: None,
            password: None,
            refresh_url: None,
            raw_line: "MyProxy = socks5, 127.0.0.1, 1080".to_string(),
        });
        let conf = generate_config(&data);
        assert!(conf.contains("MyProxy = socks5, 127.0.0.1, 1080\n"));
    }

    // ── [Proxy Group] ─────────────────────────────────────────────────────

    #[test]
    fn test_proxy_group_lines_from_subscription() {
        let mut data = AppData::default();
        let mut sub = make_subscription("[Proxy]\nnode1 = ss, 1.2.3.4, 443\n");
        sub.proxy_group_lines = vec!["Auto = url-test, node1, url=http://google.com".to_string()];
        data.subscriptions.push(sub);
        let conf = generate_config(&data);
        assert!(conf.contains("Auto = url-test, node1, url=http://google.com\n"));
    }

    // ── [Rule] ────────────────────────────────────────────────────────────

    #[test]
    fn test_individual_rule_without_comment() {
        let mut data = AppData::default();
        data.individual_rules.push(IndividualRule {
            id: Uuid::new_v4(),
            rule_type: "DOMAIN-SUFFIX".to_string(),
            value: "google.com".to_string(),
            policy: "PROXY".to_string(),
            comment: None,
            enabled: true,
        });
        let conf = generate_config(&data);
        assert!(conf.contains("DOMAIN-SUFFIX,google.com,PROXY\n"));
    }

    #[test]
    fn test_individual_rule_with_comment() {
        let mut data = AppData::default();
        data.individual_rules.push(IndividualRule {
            id: Uuid::new_v4(),
            rule_type: "IP-CIDR".to_string(),
            value: "192.168.0.0/16".to_string(),
            policy: "DIRECT".to_string(),
            comment: Some("LAN".to_string()),
            enabled: true,
        });
        let conf = generate_config(&data);
        assert!(conf.contains("IP-CIDR,192.168.0.0/16,DIRECT // LAN\n"));
    }

    #[test]
    fn test_remote_rule_set_format() {
        let mut data = AppData::default();
        data.remote_rule_sets.push(RemoteRuleSet {
            id: Uuid::new_v4(),
            name: "Reject".to_string(),
            url: "https://example.com/reject.list".to_string(),
            policy: "REJECT".to_string(),
            update_interval: 86400,
            enabled: true,
        });
        let conf = generate_config(&data);
        assert!(conf
            .contains("RULE-SET,https://example.com/reject.list,REJECT,update-interval=86400\n"));
    }

    #[test]
    fn test_individual_rules_appear_before_rule_sets() {
        let mut data = AppData::default();
        data.individual_rules.push(IndividualRule {
            id: Uuid::new_v4(),
            rule_type: "DOMAIN".to_string(),
            value: "example.com".to_string(),
            policy: "PROXY".to_string(),
            comment: None,
            enabled: true,
        });
        data.remote_rule_sets.push(RemoteRuleSet {
            id: Uuid::new_v4(),
            name: "Reject".to_string(),
            url: "https://example.com/reject.list".to_string(),
            policy: "REJECT".to_string(),
            update_interval: 86400,
            enabled: true,
        });
        let conf = generate_config(&data);
        let rule_pos = conf.find("DOMAIN,example.com,PROXY").unwrap();
        let ruleset_pos = conf.find("RULE-SET,").unwrap();
        assert!(rule_pos < ruleset_pos);
    }

    // ── Optional sections ─────────────────────────────────────────────────

    #[test]
    fn test_host_section_included_when_set() {
        let mut data = AppData::default();
        data.hosts.push(HostEntry {
            id: Uuid::new_v4(),
            domain: "example.com".to_string(),
            ip: "1.2.3.4".to_string(),
            enabled: true,
        });
        let conf = generate_config(&data);
        assert!(conf.contains("[Host]\n"));
        assert!(conf.contains("example.com = 1.2.3.4\n"));
    }

    #[test]
    fn test_url_rewrite_section_included_when_set() {
        let mut data = AppData::default();
        data.url_rewrites.push(UrlRewriteEntry {
            id: Uuid::new_v4(),
            pattern: "^http://example.com".to_string(),
            replacement: "https://example.com".to_string(),
            redirect_type: "302".to_string(),
            enabled: true,
        });
        let conf = generate_config(&data);
        assert!(conf.contains("[URL Rewrite]\n"));
        assert!(conf.contains("^http://example.com https://example.com 302\n"));
    }

    #[test]
    fn test_mitm_section_included_when_set() {
        let mut data = AppData::default();
        data.mitm_section = "hostname = example.com".to_string();
        let conf = generate_config(&data);
        assert!(conf.contains("[MITM]\n"));
        assert!(conf.contains("hostname = example.com"));
    }
}
