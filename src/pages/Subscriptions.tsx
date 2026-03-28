import { useState } from "react";
import {
  Plus,
  RefreshCw,
  MoreHorizontal,
  CloudDownload,
  ExternalLink,
  Trash2,
} from "lucide-react";

interface Subscription {
  id: string;
  name: string;
  url: string;
  nodeCount: number;
  lastRefreshed: string;
  interval: string;
  status: "active" | "standby" | "error";
  usageUsed: number;
  usageTotal: number;
  expires: string;
}

const mockSubscriptions: Subscription[] = [
  {
    id: "1",
    name: "ImmTelecom",
    url: "https://im.teldfm...cuid=CK98b...",
    nodeCount: 104,
    lastRefreshed: "2h ago",
    interval: "12h",
    status: "active",
    usageUsed: 366.64,
    usageTotal: 1000,
    expires: "2026-12-27",
  },
  {
    id: "2",
    name: "GlobalPass Premium",
    url: "https://global-pre...",
    nodeCount: 47,
    lastRefreshed: "1d ago",
    interval: "24h",
    status: "standby",
    usageUsed: 82.4,
    usageTotal: 500,
    expires: "2026-06-15",
  },
];

function StatusBadge({ status }: { status: Subscription["status"] }) {
  const styles = {
    active: "text-success",
    standby: "text-text-secondary",
    error: "text-danger",
  };
  return (
    <span className={`text-xs font-medium ${styles[status]}`}>
      ● {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function UsageBar({
  used,
  total,
}: {
  used: number;
  total: number;
}) {
  const pct = Math.min((used / total) * 100, 100);
  const color = pct > 80 ? "bg-danger" : pct > 60 ? "bg-warning" : "bg-accent";
  return (
    <div className="w-full">
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-text-secondary">
          {used.toFixed(1)} / {total.toFixed(1)} GB used
        </span>
        <span className="text-xs text-text-secondary">
          Expires {total > 0 ? "" : "N/A"}
        </span>
      </div>
    </div>
  );
}

function SubscriptionCard({ sub }: { sub: Subscription }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="bg-surface rounded-lg border border-border p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center">
            <CloudDownload size={20} className="text-accent" />
          </div>
          <div>
            <div className="text-sm font-semibold text-text-primary">
              {sub.name}
            </div>
            <div className="text-xs text-text-secondary truncate max-w-xs">
              {sub.url}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary bg-white/5 px-2 py-0.5 rounded">
            {sub.nodeCount} nodes
          </span>
          <button className="p-1 text-text-secondary hover:text-text-primary transition-colors">
            <ExternalLink size={14} />
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 text-text-secondary hover:text-text-primary transition-colors"
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 bg-surface border border-border rounded-md shadow-lg py-1 z-10 min-w-[140px]">
                <button className="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-white/5 flex items-center gap-2">
                  <RefreshCw size={14} /> Refresh Now
                </button>
                <button className="w-full text-left px-3 py-1.5 text-sm text-danger hover:bg-white/5 flex items-center gap-2">
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4 text-xs">
        <div>
          <div className="text-text-secondary mb-0.5">Last Refreshed</div>
          <div className="text-text-primary font-medium">{sub.lastRefreshed}</div>
        </div>
        <div>
          <div className="text-text-secondary mb-0.5">Interval</div>
          <div className="text-text-primary font-medium">{sub.interval}</div>
        </div>
        <div>
          <div className="text-text-secondary mb-0.5">Status</div>
          <StatusBadge status={sub.status} />
        </div>
      </div>

      <UsageBar used={sub.usageUsed} total={sub.usageTotal} />
      <div className="text-right mt-0.5">
        <span className="text-xs text-text-secondary">
          Expires {sub.expires}
        </span>
      </div>
    </div>
  );
}

export default function SubscriptionsPage() {
  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs text-text-secondary mb-1">
            Dashboard / Subscriptions
          </div>
          <h1 className="text-xl font-bold text-text-primary">Subscriptions</h1>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-md font-medium transition-colors">
          <Plus size={16} />
          Add Subscription
        </button>
      </div>

      <div className="space-y-4">
        {mockSubscriptions.map((sub) => (
          <SubscriptionCard key={sub.id} sub={sub} />
        ))}
      </div>

      <button className="mt-6 w-full py-10 border border-dashed border-border rounded-lg flex flex-col items-center gap-2 text-text-secondary hover:text-text-primary hover:border-accent/30 transition-colors">
        <CloudDownload size={24} />
        <div className="text-sm font-medium">Add New Source</div>
        <div className="text-xs">
          Connect a new Surge or Shadowrocket subscription URL to manage nodes.
        </div>
      </button>
    </div>
  );
}
