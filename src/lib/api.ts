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
}

export interface RemoteRuleSet {
  id: string;
  name: string;
  url: string;
  policy: string;
  update_interval: number;
}

export interface IndividualRule {
  id: string;
  rule_type: string;
  value: string;
  policy: string;
  comment: string | null;
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
