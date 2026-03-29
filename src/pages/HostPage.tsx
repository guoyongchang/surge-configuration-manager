import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Plus, Trash2, Loader2, CheckSquare, Square, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import type { HostEntry } from "@/types";
import * as api from "@/lib/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseBatchHosts(text: string): { domain: string; ip: string }[] {
  return text.split("\n")
    .map((line) => line.trim())
    .filter((line) => line)
    .map((line) => {
      const [domain, ip] = line.split("=").map((s) => s.trim());
      return { domain, ip };
    })
    .filter(({ domain, ip }) => domain && ip);
}

// ── Add Host Dialog ───────────────────────────────────────────────────────────

function AddHostDialog({ onAdded }: { onAdded: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [mainTab, setMainTab] = useState<"single" | "batch">("single");

  // Single add state
  const [domain, setDomain] = useState("");
  const [ip, setIp] = useState("");

  // Batch add state
  const [batchText, setBatchText] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    setOpen(false);
    setError("");
    setDomain("");
    setIp("");
    setBatchText("");
  };

  const handleSubmitSingle = async () => {
    if (!domain.trim() || !ip.trim()) return;
    setError("");
    setLoading(true);
    try {
      await api.addHost(domain.trim(), ip.trim());
      setOpen(false);
      setDomain("");
      setIp("");
      onAdded();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const batchParsed = useMemo(() => parseBatchHosts(batchText), [batchText]);

  const handleSubmitBatch = async () => {
    if (batchParsed.length === 0) return;
    setError("");
    setLoading(true);
    try {
      const entries: [string, string][] = batchParsed.map((e) => [e.domain, e.ip]);
      await api.batchAddHosts(entries);
      setOpen(false);
      setBatchText("");
      onAdded();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const canSubmitSingle = domain.trim().length > 0 && ip.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button><Plus size={16} />{t("hosts_dialog_trigger")}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t("hosts_dialog_title")}</DialogTitle></DialogHeader>

        {/* Main tab switcher */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <button
            type="button"
            className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${
              mainTab === "single"
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => { setMainTab("single"); setError(""); }}
          >
            {t("hosts_tabs_single")}
          </button>
          <button
            type="button"
            className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${
              mainTab === "batch"
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => { setMainTab("batch"); setError(""); }}
          >
            {t("hosts_tabs_batch")}
          </button>
        </div>

        {mainTab === "single" ? (
          <div className="space-y-3 py-1">
            <div>
              <Label>{t("hosts_single_domain")}</Label>
              <Input
                placeholder="example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("hosts_single_ip")}</Label>
              <Input
                placeholder="1.2.3.4"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
              />
            </div>
            {error && <div className="text-xs text-destructive bg-destructive/10 rounded p-2">{error}</div>}
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>{t("actions.cancel")}</Button>
              <Button onClick={handleSubmitSingle} disabled={loading || !canSubmitSingle}>
                {loading && <Loader2 size={14} className="animate-spin" />}{t("dialog_add")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3 py-1">
            <div>
              <Label>{t("hosts_batch_title")}</Label>
              <p className="text-xs text-muted-foreground mb-1.5">{t("hosts_batch_hint")}</p>
              <textarea
                className="w-full h-36 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                placeholder={"example.com = 1.2.3.4\napi.example.com = 5.6.7.8"}
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
              />
            </div>
            {batchText.trim() && (
              <div className="flex items-center gap-3 text-xs">
                {batchParsed.length > 0 && (
                  <span className="flex items-center gap-1 text-success">
                    {batchParsed.length} {t("hosts_batch_willAdd")}
                  </span>
                )}
              </div>
            )}
            {error && (
              <div className="text-xs text-destructive bg-destructive/10 rounded p-2">{error}</div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>{t("actions.cancel")}</Button>
              <Button
                onClick={handleSubmitBatch}
                disabled={loading || batchParsed.length === 0}
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {batchParsed.length > 0 ? t("batch_addCount", { count: batchParsed.length }) : t("batch_add")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Host Dialog ───────────────────────────────────────────────────────────

function EditHostDialog({
  host,
  onUpdated,
}: {
  host: HostEntry;
  onUpdated: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState(host.domain);
  const [ip, setIp] = useState(host.ip);
  const [enabled, setEnabled] = useState(host.enabled);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    setOpen(false);
    setError("");
    setDomain(host.domain);
    setIp(host.ip);
    setEnabled(host.enabled);
  };

  const handleSubmit = async () => {
    if (!domain.trim() || !ip.trim()) return;
    setError("");
    setLoading(true);
    try {
      await api.updateHost(host.id, domain.trim(), ip.trim(), enabled);
      setOpen(false);
      onUpdated();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = domain.trim().length > 0 && ip.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t("hosts_edit_title")}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <Label>{t("hosts_single_domain")}</Label>
            <Input
              placeholder="example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("hosts_single_ip")}</Label>
            <Input
              placeholder="1.2.3.4"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>{t("hosts_edit_enabled")}</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          {error && <div className="text-xs text-destructive bg-destructive/10 rounded p-2">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>{t("actions.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={loading || !canSubmit}>
            {loading && <Loader2 size={14} className="animate-spin" />}{t("hosts_edit_save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HostPage() {
  const { t } = useTranslation();
  const [hosts, setHosts] = useState<HostEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{
    title: string;
    description?: string;
    onConfirm: () => void;
  } | null>(null);
  const [editingHost, setEditingHost] = useState<HostEntry | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getHosts();
      setHosts(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRemove = async (id: string) => {
    await api.removeHost(id);
    setHosts((prev) => prev.filter((h) => h.id !== id));
  };

  const handleToggle = async (id: string) => {
    setToggling((prev) => new Set(prev).add(id));
    try {
      await api.toggleHost(id);
      setHosts((prev) =>
        prev.map((h) => (h.id === id ? { ...h, enabled: !h.enabled } : h))
      );
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(selected.size === hosts.length ? new Set() : new Set(hosts.map((h) => h.id)));
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      const ids = [...selected];
      await api.batchRemoveHosts(ids);
      setHosts((prev) => prev.filter((h) => !selected.has(h.id)));
      setSelected(new Set());
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs text-muted-foreground mb-1">{t("hosts_page_breadcrumb")}</div>
          <h1 className="text-xl font-bold">{t("hosts_page_title")}</h1>
          <p className="text-xs text-muted-foreground mt-1">{t("hosts_page_subtitle")}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {selected.size > 0 && (
            <>
              <span className="text-xs text-muted-foreground mr-1">
                {t("hosts_page_selectedCount", { count: selected.size })}
              </span>
              <Button
                variant="destructive"
                size="icon"
                title={`Delete ${selected.size} selected hosts`}
                onClick={() =>
                  setConfirm({
                    title: t("hosts_page_deleteTitle", { count: selected.size }),
                    description: t("confirm.cannotUndo"),
                    onConfirm: () => {
                      setConfirm(null);
                      handleBatchDelete();
                    },
                  })
                }
                disabled={deleting}
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </Button>
            </>
          )}
          <AddHostDialog onAdded={load} />
        </div>
      </div>

      {/* Select-all bar */}
      {hosts.length > 0 && !loading && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {selected.size === hosts.length ? (
              <CheckSquare size={14} className="text-primary" />
            ) : (
              <Square size={14} />
            )}
            {selected.size === hosts.length ? t("hosts_page_deselectAll") : t("hosts_page_selectAll")}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={20} className="animate-spin mr-2" />
          {t("status.loading")}
        </div>
      ) : hosts.length === 0 ? (
        <div className="w-full py-10 border border-dashed border-border rounded-lg flex flex-col items-center gap-2 text-muted-foreground">
          <Globe size={24} />
          <div className="text-sm font-medium">{t("hosts_page_empty")}</div>
          <div className="text-xs">{t("hosts_page_emptyHint")}</div>
        </div>
      ) : (
        <div className="space-y-2">
          {hosts.map((host) => {
            const isSelected = selected.has(host.id);
            const isToggling = toggling.has(host.id);
            return (
              <Card
                key={host.id}
                className={`py-0 gap-0 transition-colors cursor-pointer ${
                  isSelected ? "ring-1 ring-primary bg-primary/5" : ""
                }`}
                onClick={() => toggleSelect(host.id)}
              >
                <CardContent className="flex items-center gap-3 px-4 py-3">
                  {/* Checkbox */}
                  <button
                    className="shrink-0 text-muted-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(host.id);
                    }}
                  >
                    {isSelected ? (
                      <CheckSquare size={14} className="text-primary" />
                    ) : (
                      <Square size={14} />
                    )}
                  </button>

                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Globe size={16} className="text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{host.domain}</span>
                      <Badge
                        variant={host.enabled ? "default" : "outline"}
                        className={`text-xs ${!host.enabled ? "opacity-60" : ""}`}
                      >
                        {host.enabled ? t("hosts_status_enabled") : t("hosts_status_disabled")}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      {host.ip}
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    {/* Toggle button */}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title={host.enabled ? t("hosts_actions_disable") : t("hosts_actions_enable")}
                      disabled={isToggling}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(host.id);
                      }}
                    >
                      {isToggling ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Switch
                          checked={host.enabled}
                          onCheckedChange={() => handleToggle(host.id)}
                          className="scale-75"
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </Button>

                    {/* Edit button */}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title={t("hosts_actions_edit")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingHost(host);
                      }}
                    >
                      <Edit size={14} />
                    </Button>

                    {/* Delete button */}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title={t("hosts_actions_delete")}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirm({
                          title: t("hosts_page_removeTitle"),
                          description: t("hosts_page_removeDesc", { domain: host.domain }),
                          onConfirm: () => {
                            setConfirm(null);
                            handleRemove(host.id);
                          },
                        });
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        onConfirm={confirm?.onConfirm ?? (() => {})}
      />

      {editingHost && (
        <EditHostDialog
          host={editingHost}
          onUpdated={() => {
            setEditingHost(null);
            load();
          }}
        />
      )}
    </div>
  );
}
