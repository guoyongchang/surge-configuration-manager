import { invoke } from "@tauri-apps/api/core";

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

// ── Subscriptions ──

export const getSubscriptions = () =>
  invoke<Subscription[]>("get_subscriptions");

export const addSubscription = (name: string, url: string, sourceType: "url" | "file" = "url") =>
  invoke<Subscription>("add_subscription", { name, url, sourceType });

export const refreshSubscription = (id: string) =>
  invoke<Subscription>("refresh_subscription", { id });

export const removeSubscription = (id: string) =>
  invoke<void>("remove_subscription", { id });

// ── Remote Rule Sets ──

export const getRemoteRuleSets = () =>
  invoke<RemoteRuleSet[]>("get_remote_rule_sets");

export const addRemoteRuleSet = (
  name: string,
  url: string,
  policy: string,
  updateInterval: number
) =>
  invoke<RemoteRuleSet>("add_remote_rule_set", {
    name,
    url,
    policy,
    updateInterval,
  });

export const removeRemoteRuleSet = (id: string) =>
  invoke<void>("remove_remote_rule_set", { id });

// ── Individual Rules ──

export const getIndividualRules = () =>
  invoke<IndividualRule[]>("get_individual_rules");

export const addIndividualRule = (
  ruleType: string,
  value: string,
  policy: string,
  comment?: string
) =>
  invoke<IndividualRule>("add_individual_rule", {
    ruleType,
    value,
    policy,
    comment: comment ?? null,
  });

export const removeIndividualRule = (id: string) =>
  invoke<void>("remove_individual_rule", { id });

export const reorderIndividualRules = (ids: string[]) =>
  invoke<void>("reorder_individual_rules", { ids });

export const reorderRemoteRuleSets = (ids: string[]) =>
  invoke<void>("reorder_remote_rule_sets", { ids });

export const toggleIndividualRule = (id: string) =>
  invoke<void>("toggle_individual_rule", { id });

export const toggleRemoteRuleSet = (id: string) =>
  invoke<void>("toggle_remote_rule_set", { id });

export const getAllNodeNames = () =>
  invoke<string[]>("get_all_node_names");

export const toggleSubscriptionRule = (key: string) =>
  invoke<void>("toggle_subscription_rule", { key });

export const getDisabledSubRuleKeys = () =>
  invoke<string[]>("get_disabled_sub_rule_keys");

// ── Extra Nodes ──

export const getExtraNodes = () => invoke<ExtraNode[]>("get_extra_nodes");

export const addExtraNode = (
  name: string,
  nodeType: string,
  server: string,
  port: number,
  refreshUrl?: string
) =>
  invoke<ExtraNode>("add_extra_node", {
    name,
    nodeType,
    server,
    port,
    refreshUrl: refreshUrl ?? null,
  });

export const removeExtraNode = (id: string) =>
  invoke<void>("remove_extra_node", { id });

export const addNodeFromRawLine = (rawLine: string, refreshUrl?: string) =>
  invoke<ExtraNode>("add_node_from_raw_line", {
    rawLine,
    refreshUrl: refreshUrl ?? null,
  });

export const batchRemoveExtraNodes = (ids: string[]) =>
  invoke<void>("batch_remove_extra_nodes", { ids });

export const batchRemoveIndividualRules = (ids: string[]) =>
  invoke<void>("batch_remove_individual_rules", { ids });

export const batchRemoveRemoteRuleSets = (ids: string[]) =>
  invoke<void>("batch_remove_remote_rule_sets", { ids });

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

export const testExtraNode = (id: string) =>
  invoke<NodeTestResult>("test_extra_node", { id });

export const refreshExtraNode = (id: string) =>
  invoke<string>("refresh_extra_node", { id });

export interface BatchNodeInput {
  name: string;
  nodeType: string;
  server: string;
  port: number;
  username?: string;
  password?: string;
  refreshUrl?: string;
}

export const batchAddExtraNodes = (nodes: BatchNodeInput[]) =>
  invoke<ExtraNode[]>("batch_add_extra_nodes", {
    nodes: nodes.map((n) => ({
      name: n.name,
      node_type: n.nodeType,
      server: n.server,
      port: n.port,
      username: n.username ?? null,
      password: n.password ?? null,
      refresh_url: n.refreshUrl ?? null,
    })),
  });

export interface BatchRuleInput {
  ruleType: string;
  value: string;
  policy: string;
  comment?: string;
}

export const batchAddIndividualRules = (rules: BatchRuleInput[]) =>
  invoke<IndividualRule[]>("batch_add_individual_rules", {
    rules: rules.map((r) => ({
      rule_type: r.ruleType,
      value: r.value,
      policy: r.policy,
      comment: r.comment ?? null,
    })),
  });

// ── Output / Config ──

export const getOutputConfig = () =>
  invoke<OutputConfig>("get_output_config");

export const updateOutputConfig = (config: OutputConfig) =>
  invoke<void>("update_output_config", { config });

export const generateConfig = () =>
  invoke<BuildRecord>("generate_config");

export const getBuildHistory = () =>
  invoke<BuildRecord[]>("get_build_history");

export const clearBuildHistory = () =>
  invoke<void>("clear_build_history");

export const previewConfig = () => invoke<string>("preview_config");

// ── Update ──

export interface UpdateInfo {
  version: string;
  current_version: string;
  body: string;
}

/** Returns UpdateInfo when a new version is available, null otherwise. */
export const checkForUpdate = () => invoke<UpdateInfo | null>("check_for_update");

/** Downloads and installs the pending update, then exits the app. */
export const installUpdate = () => invoke<void>("install_update");

// ── General Settings ──

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

export const setPrimarySubscription = (id: string) =>
  invoke<void>("set_primary_subscription", { id });

export const getGeneralSettings = () =>
  invoke<GeneralSettings>("get_general_settings");

export const updateGeneralSettings = (settings: GeneralSettings) =>
  invoke<void>("update_general_settings", { settings });

export const getAdvancedSections = () =>
  invoke<AdvancedSections>("get_advanced_sections");

export const updateAdvancedSections = (sections: AdvancedSections) =>
  invoke<void>("update_advanced_sections", { sections });
