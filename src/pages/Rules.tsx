import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus, Trash2, Shield, Loader2, Upload,
  CheckCircle2, XCircle, CheckSquare, Square, GripVertical, ChevronDown,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import type { RemoteRuleSet, IndividualRule, BatchRuleInput, Subscription } from "@/types";
import * as api from "@/lib/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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

const STATIC_POLICIES = ["DIRECT", "REJECT", "Proxies", "AI", "Telegram", "Steam", "Netflix", "YouTube"];

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

function PolicyPicker({
  value,
  onChange,
  nodeNames,
}: {
  value: string;
  onChange: (v: string) => void;
  nodeNames: string[];
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const allOptions = useMemo(() => {
    const staticSet = new Set(STATIC_POLICIES);
    return [...STATIC_POLICIES, ...nodeNames.filter((n) => !staticSet.has(n))];
  }, [nodeNames]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allOptions;
    const q = search.toLowerCase();
    return allOptions.filter((o) => o.toLowerCase().includes(q));
  }, [allOptions, search]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="w-full flex items-center gap-2 border border-input rounded-md bg-transparent px-3 py-2 text-sm text-left hover:bg-accent/5"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex-1 truncate">{value || t("rules_policyPicker_placeholder")}</span>
        <ChevronDown size={14} className="text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-48 bg-popover border border-border rounded-md shadow-lg">
          <div className="p-2 border-b border-border">
            <Input
              autoFocus
              placeholder={t("rules_policyPicker_searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.map((option) => (
              <button
                key={option}
                type="button"
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors ${value === option ? "bg-accent/40 font-medium" : ""}`}
                onClick={() => { onChange(option); setOpen(false); setSearch(""); }}
              >
                {option}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">{t("rules_policyPicker_noResults")}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type RuleParsedLine =
  | { ok: true; input: BatchRuleInput }
  | { ok: false; lineNum: number; raw: string; reason: string };

function parseRuleLines(text: string, defaultType: string, defaultPolicy: string): RuleParsedLine[] {
  const results: RuleParsedLine[] = [];
  text.split("\n").forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length >= 2 && RULE_TYPES.includes(parts[0])) {
      if (!parts[1]) {
        results.push({ ok: false, lineNum: idx + 1, raw: line, reason: "Empty value after rule type" });
      } else {
        const policy = parts[2] || defaultPolicy;
        results.push({ ok: true, input: { ruleType: parts[0], value: parts[1], policy, comment: parts[3] } });
      }
    } else if (parts.length >= 2 && !RULE_TYPES.includes(parts[0])) {
      results.push({ ok: false, lineNum: idx + 1, raw: line, reason: `Unknown rule type: "${parts[0]}"` });
    } else if (parts.length === 1 && parts[0]) {
      results.push({ ok: true, input: { ruleType: defaultType, value: parts[0], policy: defaultPolicy } });
    } else {
      results.push({ ok: false, lineNum: idx + 1, raw: line, reason: "Invalid format" });
    }
  });
  return results;
}

function BatchAddRulesDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [defaultType, setDefaultType] = useState("DOMAIN");
  const [defaultPolicy, setDefaultPolicy] = useState("DIRECT");
  const [nodeNames, setNodeNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const { t: tc } = useTranslation();

  useEffect(() => {
    if (open) api.getAllNodeNames().then(setNodeNames).catch(() => {});
  }, [open]);

  const lines = useMemo(() => parseRuleLines(text, defaultType, defaultPolicy), [text, defaultType, defaultPolicy]);
  const valid = useMemo(() => lines.filter((l) => l.ok).map((l) => (l as { ok: true; input: BatchRuleInput }).input), [lines]);
  const errors = useMemo(() => lines.filter((l) => !l.ok) as { ok: false; lineNum: number; raw: string; reason: string }[], [lines]);

  const handleSubmit = async () => {
    if (valid.length === 0) return;
    setLoading(true);
    try {
      await api.batchAddIndividualRules(valid);
      setOpen(false);
      setText("");
      onAdded();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-primary">
          <Upload size={14} /> {t("rules_batchImport_trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("rules_batchImport_title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>{t("rules_batchImport_rulesLabel")}</Label>
            <p className="text-xs text-muted-foreground mb-1.5">
              <span className="font-mono bg-muted px-1 rounded">TYPE,value,POLICY</span>
              {" · "}
              <span className="font-mono bg-muted px-1 rounded">TYPE,value</span>
              {" · "}
              <span className="font-mono bg-muted px-1 rounded">value</span>
              {" (uses defaults)"}
            </p>
            <textarea
              className="w-full h-36 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              placeholder={"DOMAIN,example.com,DIRECT\nDOMAIN-SUFFIX,google.com,Proxies\nexample2.com"}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("rules_batchImport_defaultTypeLabel")}</Label>
              <Select value={defaultType} onValueChange={setDefaultType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RULE_TYPES.map((ruleType) => <SelectItem key={ruleType} value={ruleType}>{ruleType}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("rules_batchImport_defaultPolicyLabel")}</Label>
              <PolicyPicker value={defaultPolicy} onChange={setDefaultPolicy} nodeNames={nodeNames} />
            </div>
          </div>

          {/* Validation summary */}
          {text.trim() && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-xs">
                {valid.length > 0 && (
                  <span className="flex items-center gap-1 text-success">
                    <CheckCircle2 size={12} /> {t("rules_batchImport_valid", { count: valid.length })}
                  </span>
                )}
                {errors.length > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <XCircle size={12} /> {t("rules_batchImport_invalid", { count: errors.length })}
                  </span>
                )}
              </div>
              {errors.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 space-y-1 max-h-28 overflow-y-auto">
                  {errors.map((e) => (
                    <div key={e.lineNum} className="text-xs text-destructive font-mono">
                      <span className="opacity-60">Line {e.lineNum}:</span> {e.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{tc("actions_cancel")}</Button>
          <Button onClick={handleSubmit} disabled={loading || valid.length === 0}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            {valid.length > 0 ? t("rules_batchImport_importRules", { count: valid.length }) : t("rules_batchImport_importBtn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddRuleSetDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [policy, setPolicy] = useState("Proxies");
  const [nodeNames, setNodeNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const { t: tc } = useTranslation();

  useEffect(() => {
    if (open) api.getAllNodeNames().then(setNodeNames).catch(() => {});
  }, [open]);

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
          <Plus size={14} /> {t("rules_addRuleSet_trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent style={{ maxWidth: "80vw" }}>
        <DialogHeader>
          <DialogTitle>{t("rules_addRuleSet_title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>{t("rules_addRuleSet_nameLabel")}</Label>
            <Input
              placeholder={t("rules_addRuleSet_namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("rules_addRuleSet_urlLabel")}</Label>
            <Input
              placeholder={t("rules_addRuleSet_urlPlaceholder")}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("rules_addRuleSet_policyLabel")}</Label>
            <PolicyPicker value={policy} onChange={setPolicy} nodeNames={nodeNames} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{tc("actions_cancel")}</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            {tc("actions_add")}
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
  const [nodeNames, setNodeNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const { t: tc } = useTranslation();

  useEffect(() => {
    if (open) api.getAllNodeNames().then(setNodeNames).catch(() => {});
  }, [open]);

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
          <Plus size={14} /> {t("rules_addRule_trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent style={{ maxWidth: "80vw" }}>
        <DialogHeader>
          <DialogTitle>{t("rules_addRule_title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>{t("rules_addRule_typeLabel")}</Label>
            <Select value={ruleType} onValueChange={setRuleType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RULE_TYPES.map((rt) => (
                  <SelectItem key={rt} value={rt}>{rt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("rules_addRule_valueLabel")}</Label>
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
            <Label>{t("rules_addRule_policyLabel")}</Label>
            <PolicyPicker value={policy} onChange={setPolicy} nodeNames={nodeNames} />
          </div>
          <div>
            <Label>{t("rules_addRule_commentLabel")}</Label>
            <Input
              placeholder="e.g. block tracking"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{tc("actions_cancel")}</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            {tc("actions_add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { Switch } from "@/components/ui/switch";

// ── Sortable card: Remote Rule Set ────────────────────────────────────────────

function SortableRuleSetCard({
  rs,
  isSelected,
  onToggleSelect,
  onToggleEnabled,
  onConfirmRemove,
}: {
  rs: RemoteRuleSet;
  isSelected: boolean;
  onToggleSelect: () => void;
  onToggleEnabled: () => void;
  onConfirmRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rs.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <Card className={`py-0 gap-0 transition-colors ${isSelected ? "ring-1 ring-primary bg-primary/5" : ""} ${!rs.enabled ? "opacity-50" : ""}`}>
        <CardContent className="flex items-center gap-3 px-3 py-3">
          <button
            className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground cursor-grab touch-none"
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </button>
          <button className="shrink-0 text-muted-foreground" onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}>
            {isSelected ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />}
          </button>
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Shield size={16} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{rs.name}</div>
            <div className="text-xs text-muted-foreground truncate">{rs.url}</div>
          </div>
          <PolicyBadge policy={rs.policy} />
          <div onClick={(e) => e.stopPropagation()}>
            <Switch checked={rs.enabled} onCheckedChange={onToggleEnabled} />
          </div>
          <Button variant="ghost" size="icon-xs" onClick={(e) => { e.stopPropagation(); onConfirmRemove(); }} className="text-muted-foreground hover:text-destructive">
            <Trash2 size={14} />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sortable card: Individual Rule ────────────────────────────────────────────

function SortableRuleCard({
  rule,
  isSelected,
  onToggleSelect,
  onToggleEnabled,
  onConfirmRemove,
}: {
  rule: IndividualRule;
  isSelected: boolean;
  onToggleSelect: () => void;
  onToggleEnabled: () => void;
  onConfirmRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rule.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <Card className={`py-0 gap-0 transition-colors ${isSelected ? "ring-1 ring-primary bg-primary/5" : ""} ${!rule.enabled ? "opacity-50" : ""}`}>
        <CardContent className="flex items-center gap-3 px-3 py-2.5">
          <button
            className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground cursor-grab touch-none"
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </button>
          <button className="shrink-0 text-muted-foreground" onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}>
            {isSelected ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />}
          </button>
          <TypeBadge type={rule.rule_type} />
          <span className={`flex-1 text-sm font-mono ${!rule.enabled ? "line-through" : ""}`}>{rule.value}</span>
          {rule.comment && <span className="text-xs text-muted-foreground truncate max-w-32">{rule.comment}</span>}
          <PolicyBadge policy={rule.policy} />
          <div onClick={(e) => e.stopPropagation()}>
            <Switch checked={rule.enabled} onCheckedChange={onToggleEnabled} />
          </div>
          <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); onConfirmRemove(); }}>
            <Trash2 size={14} />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RulesPage() {
  const [ruleSets, setRuleSets] = useState<RemoteRuleSet[]>([]);
  const [rules, setRules] = useState<IndividualRule[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [disabledSubRuleKeys, setDisabledSubRuleKeys] = useState<Set<string>>(new Set());  const [loading, setLoading] = useState(true);
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set());
  const [selectedRuleSets, setSelectedRuleSets] = useState<Set<string>>(new Set());
  const [deletingRules, setDeletingRules] = useState(false);
  const [deletingRuleSets, setDeletingRuleSets] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; description?: string; onConfirm: () => void } | null>(null);
  const { t } = useTranslation();
  const { t: tc } = useTranslation();

  const load = useCallback(async () => {
    try {
      const [rs, ir, subs, disabledKeys] = await Promise.all([
        api.getRemoteRuleSets(),
        api.getIndividualRules(),
        api.getSubscriptions(),
        api.getDisabledSubRuleKeys(),
      ]);
      setRuleSets(rs);
      setRules(ir);
      setSubscriptions(subs);
      setDisabledSubRuleKeys(new Set(disabledKeys));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleRuleSetDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRuleSets((prev) => {
      const oldIndex = prev.findIndex((r) => r.id === active.id);
      const newIndex = prev.findIndex((r) => r.id === over.id);
      const next = arrayMove(prev, oldIndex, newIndex);
      api.reorderRemoteRuleSets(next.map((r) => r.id));
      return next;
    });
  };

  const handleRuleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRules((prev) => {
      const oldIndex = prev.findIndex((r) => r.id === active.id);
      const newIndex = prev.findIndex((r) => r.id === over.id);
      const next = arrayMove(prev, oldIndex, newIndex);
      api.reorderIndividualRules(next.map((r) => r.id));
      return next;
    });
  };

  const handleToggleRuleSet = (id: string) => {
    setRuleSets((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
    api.toggleRemoteRuleSet(id);
  };

  const handleToggleRule = (id: string) => {
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
    api.toggleIndividualRule(id);
  };

  const handleToggleSubRule = (key: string) => {
    setDisabledSubRuleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    api.toggleSubscriptionRule(key);
  };

  const handleRemoveRuleSet = async (id: string) => {
    await api.removeRemoteRuleSet(id);
    setRuleSets((prev) => prev.filter((r) => r.id !== id));
    setSelectedRuleSets((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const handleRemoveRule = async (id: string) => {
    await api.removeIndividualRule(id);
    setRules((prev) => prev.filter((r) => r.id !== id));
    setSelectedRules((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const confirmRemoveRuleSet = (rs: RemoteRuleSet) => {
    setConfirm({
      title: t("rules_page.removeRuleSetTitle"),
      description: t("rules_page.removeRuleSetDesc", { name: rs.name }),
      onConfirm: () => { setConfirm(null); handleRemoveRuleSet(rs.id); },
    });
  };

  const confirmRemoveRule = (rule: IndividualRule) => {
    setConfirm({
      title: t("rules_page.removeRuleTitle"),
      description: t("rules_page.removeRuleDesc", { type: rule.rule_type, value: rule.value }),
      onConfirm: () => { setConfirm(null); handleRemoveRule(rule.id); },
    });
  };

  const toggleSelectRule = (id: string) => {
    setSelectedRules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectRuleSet = (id: string) => {
    setSelectedRuleSets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBatchDeleteRules = async () => {
    if (selectedRules.size === 0) return;
    setDeletingRules(true);
    try {
      await api.batchRemoveIndividualRules([...selectedRules]);
      setRules((prev) => prev.filter((r) => !selectedRules.has(r.id)));
      setSelectedRules(new Set());
    } finally {
      setDeletingRules(false);
    }
  };

  const handleBatchDeleteRuleSets = async () => {
    if (selectedRuleSets.size === 0) return;
    setDeletingRuleSets(true);
    try {
      await api.batchRemoveRemoteRuleSets([...selectedRuleSets]);
      setRuleSets((prev) => prev.filter((r) => !selectedRuleSets.has(r.id)));
      setSelectedRuleSets(new Set());
    } finally {
      setDeletingRuleSets(false);
    }
  };

  const confirmBatchDeleteRules = () => {
    setConfirm({
      title: t("rules_page.batchDeleteRulesTitle", { count: selectedRules.size }),
      description: tc("confirm_cannotUndo"),
      onConfirm: () => { setConfirm(null); handleBatchDeleteRules(); },
    });
  };

  const confirmBatchDeleteRuleSets = () => {
    setConfirm({
      title: t("rules_page.batchDeleteRuleSetsTitle", { count: selectedRuleSets.size }),
      description: tc("confirm_cannotUndo"),
      onConfirm: () => { setConfirm(null); handleBatchDeleteRuleSets(); },
    });
  };

  const subRuleSets = useMemo(() =>
    subscriptions.flatMap((sub) =>
      sub.rule_lines
        .filter((line) => line.startsWith("RULE-SET,"))
        .map((line) => ({ sub, line, key: `${sub.id}:${line}` }))
    ), [subscriptions]);

  const subIndividualRules = useMemo(() =>
    subscriptions.flatMap((sub) =>
      sub.rule_lines
        .filter((line) => !line.startsWith("RULE-SET,"))
        .map((line) => ({ sub, line, key: `${sub.id}:${line}` }))
    ), [subscriptions]);

  const totalCount = ruleSets.length + rules.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 size={20} className="animate-spin mr-2" />
        {tc("status_loading")}
      </div>
    );
  }

  return (
    <div className="p-6 w-full">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold">{t("rules_page.title")}</h1>
        <Badge variant="secondary">{totalCount}</Badge>
      </div>

      {/* Remote Rule Sets */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("rules_page.ruleSetsTitle")}
            </h2>
            {selectedRuleSets.size > 0 && (
              <Button variant="destructive" size="icon-xs" title={`Delete ${selectedRuleSets.size} selected`} onClick={confirmBatchDeleteRuleSets} disabled={deletingRuleSets}>
                {deletingRuleSets ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </Button>
            )}
          </div>
          <AddRuleSetDialog onAdded={load} />
        </div>
        <div className="space-y-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRuleSetDragEnd}>
            <SortableContext items={ruleSets.map((r) => r.id)} strategy={verticalListSortingStrategy}>
              {ruleSets.map((rs) => (
                <SortableRuleSetCard
                  key={rs.id}
                  rs={rs}
                  isSelected={selectedRuleSets.has(rs.id)}
                  onToggleSelect={() => toggleSelectRuleSet(rs.id)}
                  onToggleEnabled={() => handleToggleRuleSet(rs.id)}
                  onConfirmRemove={() => confirmRemoveRuleSet(rs)}
                />
              ))}
            </SortableContext>
          </DndContext>
          {ruleSets.length === 0 && subRuleSets.length === 0 && (
            <div className="text-xs text-muted-foreground py-4 text-center">
              {t("rules_page.emptyRuleSets")}
            </div>
          )}
          {subRuleSets.length > 0 && (
            <>
              {ruleSets.length > 0 && (
                <div className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">{t("rules_page.fromSubscriptions")}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              <div className="space-y-2">
                {subRuleSets.map(({ sub, line, key }) => {
                  const parts = line.split(",");
                  const url = parts[1] ?? "";
                  const policy = parts[2] ?? "";
                  const enabled = !disabledSubRuleKeys.has(key);
                  return (
                    <Card key={key} className={`py-0 gap-0 transition-colors ${!enabled ? "opacity-50" : ""}`}>
                      <CardContent className="flex items-center gap-3 px-3 py-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Shield size={16} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/20 text-primary">COPY</span>
                            <span className="text-xs text-muted-foreground">{sub.name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{url}</div>
                        </div>
                        {policy && <PolicyBadge policy={policy} />}
                        <div onClick={(e) => e.stopPropagation()}>
                          <Switch checked={enabled} onCheckedChange={() => handleToggleSubRule(key)} />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Individual Rules */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("rules_page.individualTitle")}
            </h2>
            {selectedRules.size > 0 && (
              <Button variant="destructive" size="icon-xs" title={`Delete ${selectedRules.size} selected`} onClick={confirmBatchDeleteRules} disabled={deletingRules}>
                {deletingRules ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <BatchAddRulesDialog onAdded={load} />
            <AddRuleDialog onAdded={load} />
          </div>
        </div>
        <div className="space-y-1.5">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRuleDragEnd}>
            <SortableContext items={rules.map((r) => r.id)} strategy={verticalListSortingStrategy}>
              {rules.map((rule) => (
                <SortableRuleCard
                  key={rule.id}
                  rule={rule}
                  isSelected={selectedRules.has(rule.id)}
                  onToggleSelect={() => toggleSelectRule(rule.id)}
                  onToggleEnabled={() => handleToggleRule(rule.id)}
                  onConfirmRemove={() => confirmRemoveRule(rule)}
                />
              ))}
            </SortableContext>
          </DndContext>
          {rules.length === 0 && subIndividualRules.length === 0 && (
            <div className="text-xs text-muted-foreground py-4 text-center">
              {t("rules_page.emptyIndividual")}
            </div>
          )}
          {subIndividualRules.length > 0 && (
            <>
              {rules.length > 0 && (
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">{t("rules_page.fromSubscriptions")}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              <div className="space-y-1.5">
                {subIndividualRules.map(({ sub, line, key }) => {
                  const parts = line.split(",");
                  const ruleType = parts[0] ?? "";
                  const value = parts[1] ?? line;
                  const policy = parts[2] ?? "";
                  const enabled = !disabledSubRuleKeys.has(key);
                  return (
                    <Card key={key} className={`py-0 gap-0 transition-colors ${!enabled ? "opacity-50" : ""}`}>
                      <CardContent className="flex items-center gap-3 px-3 py-2.5">
                        <TypeBadge type={ruleType} />
                        <span className={`flex-1 text-sm font-mono ${!enabled ? "line-through" : ""}`}>{value}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/20 text-primary">COPY</span>
                          <span className="text-xs text-muted-foreground truncate max-w-24">{sub.name}</span>
                        </div>
                        {policy && <PolicyBadge policy={policy} />}
                        <div onClick={(e) => e.stopPropagation()}>
                          <Switch checked={enabled} onCheckedChange={() => handleToggleSubRule(key)} />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
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

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => { if (!open) setConfirm(null); }}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        onConfirm={confirm?.onConfirm ?? (() => {})}
      />
    </div>
  );
}
