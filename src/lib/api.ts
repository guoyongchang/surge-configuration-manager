import { invoke } from "@tauri-apps/api/core";
import { open as openFilePickerDialog } from "@tauri-apps/plugin-dialog";
import type {
  Subscription,
  RemoteRuleSet,
  IndividualRule,
  ExtraNode,
  OutputConfig,
  BuildRecord,
  NodeTestResult,
  BatchNodeInput,
  BatchRuleInput,
  UpdateInfo,
  GeneralSettings,
  AdvancedSections,
  BackupInfo,
  CloudSyncSettings,
  CloudSyncState,
  SyncConflictInfo,
  HostEntry,
  UrlRewriteEntry,
} from "@/types";

export type {
  Subscription,
  RemoteRuleSet,
  IndividualRule,
  ExtraNode,
  OutputConfig,
  BuildRecord,
  NodeTestResult,
  BatchNodeInput,
  BatchRuleInput,
  UpdateInfo,
  GeneralSettings,
  AdvancedSections,
  BackupInfo,
  CloudSyncSettings,
  CloudSyncState,
  SyncConflictInfo,
  HostEntry,
  UrlRewriteEntry,
} from "@/types";

// ── File / Folder Dialog ──

export const pickFile = (options: {
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}) => openFilePickerDialog(options);

export const pickFolder = (options: { title?: string }) =>
  openFilePickerDialog({ ...options, directory: true });

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

export const testExtraNode = (id: string) =>
  invoke<NodeTestResult>("test_extra_node", { id });

export const refreshExtraNode = (id: string) =>
  invoke<string>("refresh_extra_node", { id });

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

/** Returns UpdateInfo when a new version is available, null otherwise. */
export const checkForUpdate = () => invoke<UpdateInfo | null>("check_for_update");

/** Downloads and installs the pending update, then exits the app. */
export const installUpdate = () => invoke<void>("install_update");

// ── General Settings ──

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

// ── Backup / Version Rollback ──

export const getBackups = () => invoke<BackupInfo[]>("get_backups");

export const getBackupContent = (filename: string) =>
  invoke<string>("get_backup_content", { filename });

export const rollbackToBackup = (filename: string) =>
  invoke<void>("rollback_to_backup", { filename });

// ── Cloud Sync ──

export const getCloudSyncSettings = () =>
  invoke<CloudSyncSettings>("get_cloud_sync_settings");

export const updateCloudSyncSettings = (settings: CloudSyncSettings) =>
  invoke<void>("update_cloud_sync_settings", { settings });

export const syncToCloud = () =>
  invoke<CloudSyncState>("sync_to_cloud");

export const syncFromCloud = () =>
  invoke<void>("sync_from_cloud");

export const checkSyncConflict = () =>
  invoke<SyncConflictInfo | null>("check_sync_conflict");

// ── Host Entries ──

export const getHosts = () => invoke<HostEntry[]>("get_hosts");

export const addHost = (domain: string, ip: string) =>
  invoke<HostEntry>("add_host", { domain, ip });

export const updateHost = (id: string, domain: string, ip: string, enabled: boolean) =>
  invoke<HostEntry>("update_host", { id, domain, ip, enabled });

export const removeHost = (id: string) =>
  invoke<void>("remove_host", { id });

export const toggleHost = (id: string) =>
  invoke<void>("toggle_host", { id });

export const batchAddHosts = (entries: [string, string][]) =>
  invoke<HostEntry[]>("batch_add_hosts", { entries });

export const batchRemoveHosts = (ids: string[]) =>
  invoke<void>("batch_remove_hosts", { ids });

// ── URL Rewrite Entries ──

export const getUrlRewrites = () => invoke<UrlRewriteEntry[]>("get_url_rewrites");

export const addUrlRewrite = (pattern: string, replacement: string, redirectType: string) =>
  invoke<UrlRewriteEntry>("add_url_rewrite", { pattern, replacement, redirect_type: redirectType });

export const updateUrlRewrite = (
  id: string,
  pattern: string,
  replacement: string,
  redirectType: string,
  enabled: boolean
) =>
  invoke<UrlRewriteEntry>("update_url_rewrite", {
    id,
    pattern,
    replacement,
    redirect_type: redirectType,
    enabled,
  });

export const removeUrlRewrite = (id: string) =>
  invoke<void>("remove_url_rewrite", { id });

export const toggleUrlRewrite = (id: string) =>
  invoke<void>("toggle_url_rewrite", { id });

export const batchAddUrlRewrites = (entries: [string, string, string][]) =>
  invoke<UrlRewriteEntry[]>("batch_add_url_rewrites", { entries });

export const batchRemoveUrlRewrites = (ids: string[]) =>
  invoke<void>("batch_remove_url_rewrites", { ids });
