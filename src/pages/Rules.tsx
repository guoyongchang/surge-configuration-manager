import { useState } from "react";
import {
  Plus,
  ExternalLink,
  GripVertical,
  Trash2,
  Shield,
} from "lucide-react";

interface RemoteRuleSet {
  id: string;
  name: string;
  url: string;
  policy: string;
  ruleCount: number;
}

interface IndividualRule {
  id: string;
  type: string;
  value: string;
  policy: string;
}

const mockRuleSets: RemoteRuleSet[] = [
  {
    id: "1",
    name: "AI Services Policy",
    url: "https://proxy.c.kxmn.net/aggregated/ai_services.list",
    policy: "PROXY",
    ruleCount: 156,
  },
  {
    id: "2",
    name: "Global Adblock",
    url: "https://cdn.co/rules/adblock-domains.list",
    policy: "REJECT",
    ruleCount: 12504,
  },
];

const mockRules: IndividualRule[] = [
  { id: "1", type: "DOMAIN", value: "apple.com", policy: "DIRECT" },
  { id: "2", type: "DOMAIN-SUFFIX", value: "openai.com", policy: "DIRECT" },
  { id: "3", type: "IP-CIDR", value: "192.168.1.0/24", policy: "DIRECT" },
  { id: "4", type: "PROCESS-NAME", value: "Telegram", policy: "REJECT" },
  { id: "5", type: "FINAL", value: "CN", policy: "DIRECT" },
];

const ruleTypeColors: Record<string, string> = {
  DOMAIN: "bg-accent/20 text-accent",
  "DOMAIN-SUFFIX": "bg-info/20 text-info",
  "IP-CIDR": "bg-warning/20 text-warning",
  "PROCESS-NAME": "bg-success/20 text-success",
  FINAL: "bg-danger/20 text-danger",
  GEOIP: "bg-accent/20 text-accent",
  "SRC-IP": "bg-warning/20 text-warning",
  "IN-PORT": "bg-info/20 text-info",
};

function TypeBadge({ type }: { type: string }) {
  const color = ruleTypeColors[type] || "bg-white/10 text-text-secondary";
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded ${color}`}>
      {type}
    </span>
  );
}

function PolicyBadge({ policy }: { policy: string }) {
  const color =
    policy === "REJECT"
      ? "text-danger"
      : policy === "PROXY"
        ? "text-accent"
        : "text-success";
  return <span className={`text-xs font-medium ${color}`}>{policy}</span>;
}

export default function RulesPage() {
  const [ruleCount] = useState(mockRuleSets.length + mockRules.length);

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold text-text-primary">Rules</h1>
        <span className="text-xs bg-white/10 text-text-secondary px-2 py-0.5 rounded-full">
          {ruleCount}
        </span>
      </div>

      {/* Remote Rule Sets */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            Remote Rule Sets
          </h2>
          <button className="text-xs text-accent hover:text-accent-hover transition-colors flex items-center gap-1">
            <Plus size={14} /> Add Rule Set
          </button>
        </div>
        <div className="space-y-2">
          {mockRuleSets.map((rs) => (
            <div
              key={rs.id}
              className="flex items-center gap-3 bg-surface border border-border rounded-lg px-4 py-3"
            >
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Shield size={16} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary">
                  {rs.name}
                </div>
                <div className="text-xs text-text-secondary truncate">
                  {rs.url}
                </div>
              </div>
              <PolicyBadge policy={rs.policy} />
              <span className="text-xs text-text-secondary">
                {rs.ruleCount.toLocaleString()} Rules
              </span>
              <button className="p-1 text-text-secondary hover:text-text-primary transition-colors">
                <ExternalLink size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Individual Rules */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            Individual Rules
          </h2>
          <button className="text-xs text-accent hover:text-accent-hover transition-colors flex items-center gap-1">
            <Plus size={14} /> Add Individual Rule
          </button>
        </div>
        <div className="space-y-1.5">
          {mockRules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center gap-3 bg-surface border border-border rounded-lg px-4 py-2.5 group"
            >
              <button className="text-text-secondary/40 hover:text-text-secondary cursor-grab">
                <GripVertical size={14} />
              </button>
              <TypeBadge type={rule.type} />
              <span className="flex-1 text-sm text-text-primary font-mono">
                {rule.value}
              </span>
              <PolicyBadge policy={rule.policy} />
              <button className="p-1 text-transparent group-hover:text-text-secondary hover:!text-danger transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Info card */}
      <div className="flex gap-4 bg-surface border border-border rounded-lg overflow-hidden">
        <div className="flex-1 p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-2">
            Rule Matching Order
          </h3>
          <p className="text-xs text-text-secondary leading-relaxed mb-4">
            Surge evaluates rules from top to bottom. Once a match is found, the
            evaluation process stops. Use the drag indicators to reorder rules
            for optimal traffic routing.
          </p>
          <div className="flex gap-3">
            <button className="text-xs text-text-secondary hover:text-text-primary bg-white/5 px-3 py-1.5 rounded transition-colors">
              Read Documentation
            </button>
            <button className="text-xs text-text-secondary hover:text-text-primary bg-white/5 px-3 py-1.5 rounded transition-colors">
              Import from File
            </button>
          </div>
        </div>
        <div className="w-48 bg-accent/10 flex flex-col items-center justify-center gap-2 text-accent">
          <Shield size={28} />
          <span className="text-xs font-medium">Config Validated</span>
        </div>
      </div>
    </div>
  );
}
