import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BookMarked, Plus, Trash2, Loader2, CheckSquare, Square, Edit } from "lucide-react";
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
import type { UrlRewriteEntry } from "@/types";
import * as api from "@/lib/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseBatchRewrites(text: string): { pattern: string; replacement: string; redirect_type: string }[] {
  return text.split("\n")
    .map((line) => line.trim())
    .filter((line) => line)
    .map((line) => {
      const parts = line.split(/\s+/);
      return {
        pattern: parts[0] || "",
        replacement: parts[1] || "",
        redirect_type: parts[2] || "302",
      };
    })
    .filter(({ pattern, replacement }) => pattern && replacement);
}

// ── Add UrlRewrite Dialog ────────────────────────────────────────────────────

function AddUrlRewriteDialog({ onAdded }: { onAdded: () => void }) {
  const { t } = useTranslation();
  const { t: tc } = useTranslation();
  const [open, setOpen] = useState(false);
  const [mainTab, setMainTab] = useState<"single" | "batch">("single");

  // Single add state
  const [pattern, setPattern] = useState("");
  const [replacement, setReplacement] = useState("");
  const [redirectType, setRedirectType] = useState("302");

  // Batch add state
  const [batchText, setBatchText] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    setOpen(false);
    setError("");
    setPattern("");
    setReplacement("");
    setRedirectType("302");
    setBatchText("");
  };

  const handleSubmitSingle = async () => {
    if (!pattern.trim() || !replacement.trim()) return;
    setError("");
    setLoading(true);
    try {
      await api.addUrlRewrite(pattern.trim(), replacement.trim(), redirectType.trim() || "302");
      setOpen(false);
      setPattern("");
      setReplacement("");
      setRedirectType("302");
      onAdded();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const batchParsed = useMemo(() => parseBatchRewrites(batchText), [batchText]);

  const handleSubmitBatch = async () => {
    if (batchParsed.length === 0) return;
    setError("");
    setLoading(true);
    try {
      const entries: [string, string, string][] = batchParsed.map((e) => [
        e.pattern,
        e.replacement,
        e.redirect_type,
      ]);
      await api.batchAddUrlRewrites(entries);
      setOpen(false);
      setBatchText("");
      onAdded();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const canSubmitSingle = pattern.trim().length > 0 && replacement.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button><Plus size={16} />{t("settings_dialog.trigger", { name: t("settings_urlRewrite.name") })}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t("settings_dialog.addTitle", { name: t("settings_urlRewrite.name") })}</DialogTitle></DialogHeader>

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
            {t("settings_tabs.single")}
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
            {t("settings_tabs.batch")}
          </button>
        </div>

        {mainTab === "single" ? (
          <div className="space-y-3 py-1">
            <div>
              <Label>{t("settings_urlRewrite.pattern")}</Label>
              <Input
                placeholder="^http://example.com"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("settings_urlRewrite.replacement")}</Label>
              <Input
                placeholder="https://example.com"
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("settings_urlRewrite.redirectType")}</Label>
              <Input
                placeholder="302"
                value={redirectType}
                onChange={(e) => setRedirectType(e.target.value)}
              />
            </div>
            {error && <div className="text-xs text-destructive bg-destructive/10 rounded p-2">{error}</div>}
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>{tc("actions_cancel")}</Button>
              <Button onClick={handleSubmitSingle} disabled={loading || !canSubmitSingle}>
                {loading && <Loader2 size={14} className="animate-spin" />}{t("settings_dialog.add")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3 py-1">
            <div>
              <Label>{t("settings_batch.title")}</Label>
              <p className="text-xs text-muted-foreground mb-1.5">{t("settings_batch.hintUrlRewrite")}</p>
              <textarea
                className="w-full h-36 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                placeholder={"^http://example.com https://example.com 302\n^http://foo.com https://foo.com 301"}
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
              />
            </div>
            {batchText.trim() && (
              <div className="flex items-center gap-3 text-xs">
                {batchParsed.length > 0 && (
                  <span className="flex items-center gap-1 text-success">
                    {batchParsed.length} {t("settings_batch.willAdd")}
                  </span>
                )}
              </div>
            )}
            {error && (
              <div className="text-xs text-destructive bg-destructive/10 rounded p-2">{error}</div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>{tc("actions_cancel")}</Button>
              <Button
                onClick={handleSubmitBatch}
                disabled={loading || batchParsed.length === 0}
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {batchParsed.length > 0 ? t("batch.addCount", { count: batchParsed.length }) : t("batch.add")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Edit UrlRewrite Dialog ────────────────────────────────────────────────────

function EditUrlRewriteDialog({
  rewrite,
  onUpdated,
}: {
  rewrite: UrlRewriteEntry;
  onUpdated: () => void;
}) {
  const { t } = useTranslation();
  const { t: tc } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pattern, setPattern] = useState(rewrite.pattern);
  const [replacement, setReplacement] = useState(rewrite.replacement);
  const [redirectType, setRedirectType] = useState(rewrite.redirect_type);
  const [enabled, setEnabled] = useState(rewrite.enabled);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    setOpen(false);
    setError("");
    setPattern(rewrite.pattern);
    setReplacement(rewrite.replacement);
    setRedirectType(rewrite.redirect_type);
    setEnabled(rewrite.enabled);
  };

  const handleSubmit = async () => {
    if (!pattern.trim() || !replacement.trim()) return;
    setError("");
    setLoading(true);
    try {
      await api.updateUrlRewrite(rewrite.id, pattern.trim(), replacement.trim(), redirectType.trim() || "302", enabled);
      setOpen(false);
      onUpdated();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = pattern.trim().length > 0 && replacement.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t("settings_edit.title")}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <Label>{t("settings_urlRewrite.pattern")}</Label>
            <Input
              placeholder="^http://example.com"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("settings_urlRewrite.replacement")}</Label>
            <Input
              placeholder="https://example.com"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("settings_urlRewrite.redirectType")}</Label>
            <Input
              placeholder="302"
              value={redirectType}
              onChange={(e) => setRedirectType(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>{t("settings_edit.enabled")}</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          {error && <div className="text-xs text-destructive bg-destructive/10 rounded p-2">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>{tc("actions_cancel")}</Button>
          <Button onClick={handleSubmit} disabled={loading || !canSubmit}>
            {loading && <Loader2 size={14} className="animate-spin" />}{t("settings_edit.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function UrlRewritePage() {
  const { t } = useTranslation();
  const { t: tc } = useTranslation();
  const [rewrites, setRewrites] = useState<UrlRewriteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{
    title: string;
    description?: string;
    onConfirm: () => void;
  } | null>(null);
  const [editingRewrite, setEditingRewrite] = useState<UrlRewriteEntry | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getUrlRewrites();
      setRewrites(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRemove = async (id: string) => {
    await api.removeUrlRewrite(id);
    setRewrites((prev) => prev.filter((r) => r.id !== id));
  };

  const handleToggle = async (id: string) => {
    setToggling((prev) => new Set(prev).add(id));
    try {
      await api.toggleUrlRewrite(id);
      setRewrites((prev) =>
        prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
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
    setSelected(selected.size === rewrites.length ? new Set() : new Set(rewrites.map((r) => r.id)));
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      const ids = [...selected];
      await api.batchRemoveUrlRewrites(ids);
      setRewrites((prev) => prev.filter((r) => !selected.has(r.id)));
      setSelected(new Set());
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs text-muted-foreground mb-1">{t("settings_page.breadcrumb")}</div>
          <h1 className="text-xl font-bold">{t("settings_urlRewrite.name")}</h1>
          <p className="text-xs text-muted-foreground mt-1">{t("settings_urlRewrite.subtitle")}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {selected.size > 0 && (
            <>
              <span className="text-xs text-muted-foreground mr-1">
                {t("settings_page.selectedCount", { count: selected.size })}
              </span>
              <Button
                variant="destructive"
                size="icon"
                title={`Delete ${selected.size} selected rewrites`}
                onClick={() =>
                  setConfirm({
                    title: t("settings_page.deleteTitle", { count: selected.size }),
                    description: tc("confirm.cannotUndo"),
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
          <AddUrlRewriteDialog onAdded={load} />
        </div>
      </div>

      {/* Select-all bar */}
      {rewrites.length > 0 && !loading && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {selected.size === rewrites.length ? (
              <CheckSquare size={14} className="text-primary" />
            ) : (
              <Square size={14} />
            )}
            {selected.size === rewrites.length ? t("settings_page.deselectAll") : t("settings_page.selectAll")}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={20} className="animate-spin mr-2" />
          {tc("status_loading")}
        </div>
      ) : rewrites.length === 0 ? (
        <div className="w-full py-10 border border-dashed border-border rounded-lg flex flex-col items-center gap-2 text-muted-foreground">
          <BookMarked size={24} />
          <div className="text-sm font-medium">{t("settings_page.empty")}</div>
          <div className="text-xs">{t("settings_page.emptyHint")}</div>
        </div>
      ) : (
        <div className="space-y-2">
          {rewrites.map((rewrite) => {
            const isSelected = selected.has(rewrite.id);
            const isToggling = toggling.has(rewrite.id);
            return (
              <Card
                key={rewrite.id}
                className={`py-0 gap-0 transition-colors cursor-pointer ${
                  isSelected ? "ring-1 ring-primary bg-primary/5" : ""
                }`}
                onClick={() => toggleSelect(rewrite.id)}
              >
                <CardContent className="flex items-center gap-3 px-4 py-3">
                  {/* Checkbox */}
                  <button
                    className="shrink-0 text-muted-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(rewrite.id);
                    }}
                  >
                    {isSelected ? (
                      <CheckSquare size={14} className="text-primary" />
                    ) : (
                      <Square size={14} />
                    )}
                  </button>

                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <BookMarked size={16} className="text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium font-mono">{rewrite.pattern}</span>
                      <Badge
                        variant={rewrite.enabled ? "default" : "outline"}
                        className={`text-xs ${!rewrite.enabled ? "opacity-60" : ""}`}
                      >
                        {rewrite.enabled ? t("settings_status.enabled") : t("settings_status.disabled")}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      {rewrite.replacement}
                      <span className="text-muted-foreground/60 ml-2">({rewrite.redirect_type})</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    {/* Toggle button */}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title={rewrite.enabled ? t("settings_actions.disable") : t("settings_actions.enable")}
                      disabled={isToggling}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(rewrite.id);
                      }}
                    >
                      {isToggling ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Switch
                          checked={rewrite.enabled}
                          onCheckedChange={() => handleToggle(rewrite.id)}
                          className="scale-75"
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </Button>

                    {/* Edit button */}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title={t("settings_actions.edit")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingRewrite(rewrite);
                      }}
                    >
                      <Edit size={14} />
                    </Button>

                    {/* Delete button */}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title={t("settings_actions.delete")}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirm({
                          title: t("settings_page.removeTitle"),
                          description: t("settings_page.removeDesc", { name: rewrite.pattern }),
                          onConfirm: () => {
                            setConfirm(null);
                            handleRemove(rewrite.id);
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

      {editingRewrite && (
        <EditUrlRewriteDialog
          rewrite={editingRewrite}
          onUpdated={() => {
            setEditingRewrite(null);
            load();
          }}
        />
      )}
    </div>
  );
}
