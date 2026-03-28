import { useState } from "react";
import { Plus, Server, Trash2, RefreshCw, MoreHorizontal } from "lucide-react";

interface ExtraNode {
  id: string;
  name: string;
  type: string;
  server: string;
  port: number;
  refreshUrl?: string;
  status: "online" | "offline" | "unknown";
}

const mockNodes: ExtraNode[] = [
  {
    id: "1",
    name: "Home SOCKS5",
    type: "socks5",
    server: "192.168.1.100",
    port: 1080,
    status: "online",
  },
  {
    id: "2",
    name: "Office Proxy",
    type: "socks5",
    server: "10.0.0.50",
    port: 7890,
    refreshUrl: "https://example.com/refresh-token",
    status: "online",
  },
  {
    id: "3",
    name: "VPS Tokyo",
    type: "socks5",
    server: "203.0.113.45",
    port: 1080,
    status: "offline",
  },
];

function StatusDot({ status }: { status: ExtraNode["status"] }) {
  const color =
    status === "online"
      ? "bg-success"
      : status === "offline"
        ? "bg-danger"
        : "bg-text-secondary";
  return <span className={`w-2 h-2 rounded-full ${color} inline-block`} />;
}

export default function ExtraNodesPage() {
  const [nodes] = useState(mockNodes);

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs text-text-secondary mb-1">
            Dashboard / Extra Nodes
          </div>
          <h1 className="text-xl font-bold text-text-primary">Extra Nodes</h1>
          <p className="text-xs text-text-secondary mt-1">
            Manually add SOCKS5 or custom proxy nodes that aren't part of a
            subscription.
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-md font-medium transition-colors">
          <Plus size={16} />
          Add Node
        </button>
      </div>

      <div className="space-y-2">
        {nodes.map((node) => (
          <div
            key={node.id}
            className="flex items-center gap-4 bg-surface border border-border rounded-lg px-4 py-3 group"
          >
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <Server size={16} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">
                  {node.name}
                </span>
                <span className="text-xs font-mono bg-white/5 px-1.5 py-0.5 rounded text-text-secondary uppercase">
                  {node.type}
                </span>
              </div>
              <div className="text-xs text-text-secondary font-mono mt-0.5">
                {node.server}:{node.port}
                {node.refreshUrl && (
                  <span className="ml-2 text-accent">+ refresh URL</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot status={node.status} />
              <span className="text-xs text-text-secondary capitalize">
                {node.status}
              </span>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-1.5 text-text-secondary hover:text-text-primary transition-colors">
                <RefreshCw size={14} />
              </button>
              <button className="p-1.5 text-text-secondary hover:text-danger transition-colors">
                <Trash2 size={14} />
              </button>
              <button className="p-1.5 text-text-secondary hover:text-text-primary transition-colors">
                <MoreHorizontal size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {nodes.length === 0 && (
        <button className="mt-4 w-full py-10 border border-dashed border-border rounded-lg flex flex-col items-center gap-2 text-text-secondary hover:text-text-primary hover:border-accent/30 transition-colors">
          <Server size={24} />
          <div className="text-sm font-medium">Add Your First Node</div>
          <div className="text-xs">
            Add a custom SOCKS5 proxy node with optional refresh URL.
          </div>
        </button>
      )}
    </div>
  );
}
