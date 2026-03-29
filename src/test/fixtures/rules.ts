import type { RemoteRuleSet, IndividualRule } from "@/types";

export const mockRuleSet: RemoteRuleSet = {
  id: "rs-1",
  name: "China Direct",
  url: "https://cdn.example.com/china.list",
  policy: "DIRECT",
  update_interval: 86400,
  enabled: true,
};

export const mockRuleSetDisabled: RemoteRuleSet = {
  ...mockRuleSet,
  id: "rs-2",
  name: "Streaming",
  policy: "Proxies",
  enabled: false,
};

export const mockRuleSets: RemoteRuleSet[] = [mockRuleSet, mockRuleSetDisabled];

export const mockRule: IndividualRule = {
  id: "rule-1",
  rule_type: "DOMAIN",
  value: "example.com",
  policy: "DIRECT",
  comment: null,
  enabled: true,
};

export const mockRuleDisabled: IndividualRule = {
  ...mockRule,
  id: "rule-2",
  value: "blocked.com",
  policy: "REJECT",
  enabled: false,
};

export const mockRules: IndividualRule[] = [mockRule, mockRuleDisabled];
