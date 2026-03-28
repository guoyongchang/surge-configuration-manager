import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  GripVertical,
  Trash2,
  Shield,
  Loader2,
} from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RemoteRuleSet, IndividualRule } from "@/lib/api";
import * as api from "@/lib/api";

const ruleTypeColors: Record<string, string> = {
  DOMAIN: "bg-primary/20 text-primary",
  "DOMAIN-SUFFIX": "bg-info/20 text-info",
  "IP-CIDR": "bg-warning/20 text-warning",
  "PROCESS-NAME": "bg-success/20 text-success",
  FINAL: "bg-danger/20 text-danger",
  GEOIP: "bg-primary/20 text-primary",
  "SRC-IP": "bg-warning/20 text-warning",
  "IN-PORT": "bg-info/20 text-info",
};

const RULE_TYPES = [
  "DOMAIN",
  "DOMAIN-SUFFIX",
  "DOMAIN-KEYWORD",
  "IP-CIDR",
  "IP-CIDR6",
  "GEOIP",
  "SRC-IP",
  "IN-PORT",
  "PROCESS-NAME",
  "FINAL",
];

const POLICIES = ["DIRECT", "REJECT", "Proxies", "AI", "Telegram", "Steam", "Netflix", "YouTube"];

function TypeBadge({ type }: { type: string }) {
  const color = ruleTypeColors[type] || "bg-muted text-muted-foreground";
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded ${color}`}>
      {type}
    </span>
  );
}

function PolicyBadge({ policy }: { policy: string }) {
  const variant =
    policy === "REJECT"
      ? "destructive"
      : policy === "DIRECT"
        ? "secondary"
        : "default";
  return (
    <Badge variant={variant} className="text-xs font-mono">
      {policy}
    </Badge>
  );
}

function AddRuleSetDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [policy, setPolicy] = useState("Proxies");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !url.trim()) return;
    setLoading(true);
    try {
      await api.addRemoteRuleSet(name.trim(), url.trim(), policy, 86400);
      setOpen(false);
      setName("");
      setUrl("");
      onAdded();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-primary">
          <Plus size={14} /> Add Rule Set
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Remote Rule Set</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Name</Label>
            <Input
              placeholder="e.g. AI Services"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label>Rule List URL</Label>
            <Input
              placeholder="https://raw.githubusercontent.com/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div>
            <Label>Policy</Label>
            <Select value={policy} onValueChange={setPolicy}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {POLICIES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddRuleDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [ruleType, setRuleType] = useState("DOMAIN");
  const [value, setValue] = useState("");
  const [policy, setPolicy] = useState("DIRECT");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!value.trim()) return;
    setLoading(true);
    try {
      await api.addIndividualRule(
        ruleType,
        value.trim(),
        policy,
        comment.trim() || undefined
      );
      setOpen(false);
      setValue("");
      setComment("");
      onAdded();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-primary">
          <Plus size={14} /> Add Individual Rule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Individual Rule</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Type</Label>
            <Select value={ruleType} onValueChange={setRuleType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RULE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Value</Label>
            <Input
              placeholder={
                ruleType === "DOMAIN"
                  ? "example.com"
                  : ruleType === "IP-CIDR"
                    ? "192.168.1.0/24"
                    : ruleType === "PROCESS-NAME"
                      ? "/Applications/App.app/Contents/MacOS/App"
                      : "value"
              }
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div>
            <Label>Policy</Label>
            <Select value={policy} onValueChange={setPolicy}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {POLICIES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Comment (optional)</Label>
            <Input
              placeholder="e.g. block tracking"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RulesPage() {
  const [ruleSets, setRuleSets] = useState<RemoteRuleSet[]>([]);
  const [rules, setRules] = useState<IndividualRule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [rs, ir] = await Promise.all([
        api.getRemoteRuleSets(),
        api.getIndividualRules(),
      ]);
      setRuleSets(rs);
      setRules(ir);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRemoveRuleSet = async (id: string) => {
    await api.removeRemoteRuleSet(id);
    setRuleSets((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRemoveRule = async (id: string) => {
    await api.removeIndividualRule(id);
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const totalCount = ruleSets.length + rules.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 size={20} className="animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold">Rules</h1>
        <Badge variant="secondary">{totalCount}</Badge>
      </div>

      {/* Remote Rule Sets */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Remote Rule Sets
          </h2>
          <AddRuleSetDialog onAdded={load} />
        </div>
        <div className="space-y-2">
          {ruleSets.map((rs) => (
            <Card key={rs.id} className="py-0 gap-0">
              <CardContent className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Shield size={16} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{rs.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {rs.url}
                  </div>
                </div>
                <PolicyBadge policy={rs.policy} />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleRemoveRuleSet(rs.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={14} />
                </Button>
              </CardContent>
            </Card>
          ))}
          {ruleSets.length === 0 && (
            <div className="text-xs text-muted-foreground py-4 text-center">
              No remote rule sets yet.
            </div>
          )}
        </div>
      </section>

      {/* Individual Rules */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Individual Rules
          </h2>
          <AddRuleDialog onAdded={load} />
        </div>
        <div className="space-y-1.5">
          {rules.map((rule) => (
            <Card key={rule.id} className="py-0 gap-0">
              <CardContent className="flex items-center gap-3 px-4 py-2.5 group">
                <button className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab">
                  <GripVertical size={14} />
                </button>
                <TypeBadge type={rule.rule_type} />
                <span className="flex-1 text-sm font-mono">{rule.value}</span>
                {rule.comment && (
                  <span className="text-xs text-muted-foreground truncate max-w-32">
                    {rule.comment}
                  </span>
                )}
                <PolicyBadge policy={rule.policy} />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveRule(rule.id)}
                >
                  <Trash2 size={14} />
                </Button>
              </CardContent>
            </Card>
          ))}
          {rules.length === 0 && (
            <div className="text-xs text-muted-foreground py-4 text-center">
              No individual rules yet.
            </div>
          )}
        </div>
      </section>

      {/* Info card */}
      <Card className="overflow-hidden py-0 gap-0">
        <CardContent className="flex gap-4 p-0">
          <div className="flex-1 p-5">
            <h3 className="text-sm font-semibold mb-2">Rule Matching Order</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Surge evaluates rules from top to bottom. Once a match is found,
              the evaluation process stops. Use the drag indicators to reorder
              rules for optimal traffic routing.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" size="sm">
                Read Documentation
              </Button>
            </div>
          </div>
          <div className="w-48 bg-primary/10 flex flex-col items-center justify-center gap-2 text-primary">
            <Shield size={28} />
            <span className="text-xs font-medium">
              {totalCount} Rules Active
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
