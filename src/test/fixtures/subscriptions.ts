import type { Subscription } from "@/types";

export const mockSubscription: Subscription = {
  id: "sub-1",
  name: "Test Subscription",
  url: "https://example.com/sub.conf",
  source_type: "url",
  node_count: 5,
  last_refreshed: "2026-03-29T10:00:00Z",
  interval_secs: 86400,
  status: "active",
  usage_used_gb: 10.5,
  usage_total_gb: 100.0,
  expires: null,
  raw_content: "",
  node_names: ["Node HK 01", "Node US 01"],
  proxy_group_lines: [],
  rule_lines: [],
  is_primary: true,
};

export const mockSubscriptionError: Subscription = {
  ...mockSubscription,
  id: "sub-2",
  name: "Error Subscription",
  is_primary: false,
  status: "error",
  node_count: 0,
};

export const mockSubscriptionFile: Subscription = {
  ...mockSubscription,
  id: "sub-3",
  name: "Local Config",
  url: "/Users/user/surge/nodes.conf",
  source_type: "file",
  is_primary: false,
};

export const mockSubscriptions: Subscription[] = [mockSubscription, mockSubscriptionError];
