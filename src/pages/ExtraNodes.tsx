import { useEffect, useState, useCallback } from "react";
import { Plus, Server, Trash2, MoreHorizontal, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExtraNode } from "@/lib/api";
import * as api from "@/lib/api";

function StatusDot({ status }: { status: string }) {
  // For now we don't have real status checks, just show a neutral dot
  const color = status === "online" ? "bg-success" : "bg-muted-foreground";
  return <span className={`w-2 h-2 rounded-full ${color} inline-block`} />;
}

function AddNodeDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [server, setServer] = useState("");
  const [port, setPort] = useState("1080");
  const [refreshUrl, setRefreshUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !server.trim()) return;
    setLoading(true);
    try {
      await api.addExtraNode(
        name.trim(),
        "socks5",
        server.trim(),
        parseInt(port) || 1080,
        refreshUrl.trim() || undefined
      );
      setOpen(false);
      setName("");
      setServer("");
      setPort("1080");
      setRefreshUrl("");
      onAdded();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} />
          Add Node
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Extra Node</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Name</Label>
            <Input
              placeholder="e.g. Home SOCKS5"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>Server</Label>
              <Input
                placeholder="192.168.1.100"
                value={server}
                onChange={(e) => setServer(e.target.value)}
              />
            </div>
            <div>
              <Label>Port</Label>
              <Input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Refresh URL (optional)</Label>
            <Input
              placeholder="https://example.com/refresh"
              value={refreshUrl}
              onChange={(e) => setRefreshUrl(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ExtraNodesPage() {
  const [nodes, setNodes] = useState<ExtraNode[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.getExtraNodes();
      setNodes(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRemove = async (id: string) => {
    await api.removeExtraNode(id);
    setNodes((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            Dashboard / Extra Nodes
          </div>
          <h1 className="text-xl font-bold">Extra Nodes</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manually add SOCKS5 or custom proxy nodes that aren't part of a
            subscription.
          </p>
        </div>
        <AddNodeDialog onAdded={load} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={20} className="animate-spin mr-2" />
          Loading...
        </div>
      ) : nodes.length === 0 ? (
        <div className="w-full py-10 border border-dashed border-border rounded-lg flex flex-col items-center gap-2 text-muted-foreground">
          <Server size={24} />
          <div className="text-sm font-medium">No Extra Nodes</div>
          <div className="text-xs">
            Add a custom SOCKS5 proxy node with optional refresh URL.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {nodes.map((node) => (
            <Card key={node.id} className="py-0 gap-0">
              <CardContent className="flex items-center gap-4 px-4 py-3 group">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Server size={16} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{node.name}</span>
                    <Badge
                      variant="secondary"
                      className="font-mono text-xs uppercase"
                    >
                      {node.node_type}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">
                    {node.server}:{node.port}
                    {node.refresh_url && (
                      <span className="ml-2 text-primary">+ refresh URL</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusDot status="online" />
                  <span className="text-xs text-muted-foreground">Ready</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-xs">
                        <MoreHorizontal size={14} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleRemove(node.id)}
                      >
                        <Trash2 size={14} />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
