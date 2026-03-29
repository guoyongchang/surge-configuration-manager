// ── Types matching Rust models ──

export interface Subscription {
  id: string;
  name: string;
  url: string;
  source_type: "url" | "file";
  node_count: number;
  last_refreshed: string | null;
  interval_secs: number;
  status: "active" | "standby" | "error";
  usage_used_gb: number;
  usage_total_gb: number;
  expires: string | null;
  raw_content: string;
  node_names: string[];
  proxy_group_lines: string[];
  rule_lines: string[];
  is_primary: boolean;
}

export interface RemoteRuleSet {
  id: string;
  name: string;
  url: string;
  policy: string;
  update_interval: number;
  enabled: boolean;
}

export interface IndividualRule {
  id: string;
  rule_type: string;
  value: string;
  policy: string;
  comment: string | null;
  enabled: boolean;
}

export interface ExtraNode {
  id: string;
  name: string;
  node_type: string;
  server: string;
  port: number;
  refresh_url: string | null;
  raw_line: string;
}

export interface OutputConfig {
  output_path: string;
  output_filename: string;
  auto_regenerate: boolean;
  minify: boolean;
  auto_upload: boolean;
}

export interface BuildRecord {
  id: string;
  filename: string;
  description: string;
  time: string;
  status: "success" | "error";
}

export interface NodeTestResult {
  id: string;
  latency_ms: number | null;
  ip: string | null;
  country: string | null;
  country_code: string | null;
  city: string | null;
  isp: string | null;
  is_proxy: boolean | null;
  is_hosting: boolean | null;
  error: string | null;
}

export interface BatchNodeInput {
  name: string;
  nodeType: string;
  server: string;
  port: number;
  username?: string;
  password?: string;
  refreshUrl?: string;
}

export interface BatchRuleInput {
  ruleType: string;
  value: string;
  policy: string;
  comment?: string;
}

export interface UpdateInfo {
  version: string;
  current_version: string;
  body: string;
}

export interface GeneralSettings {
  http_listen: string | null;
  socks5_listen: string | null;
  extra_lines: string[];
}

export interface AdvancedSections {
  mitm: string;
  host: string;
  url_rewrite: string;
}
