import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  RefreshCw,
  CloudDownload,
  ExternalLink,
  Trash2,
  Loader2,
  FileText,
  FolderOpen,
  AlertTriangle,
  Crown,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import type { Subscription } from "@/types";
import * as api from "@/lib/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";

function StatusBadge({ status }: { status: Subscription["status"] }) {
  const variant =
    status === "active"
      ? "default"
      : status === "error"
        ? "destructive"
        : "secondary";
  return (
    <Badge variant={variant} className="text-xs">
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function UsageBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const color =
    pct > 80 ? "bg-danger" : pct > 60 ? "bg-warning" : "bg-primary";
  return (
    <div className="w-full">
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-muted-foreground">
          {used.toFixed(1)} / {total.toFixed(1)} GB used
        </span>
      </div>
    </div>
  );
}

function timeAgo(iso: string | null, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (!iso) return t("status.never", { ns: "common" });
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("status.justNow", { ns: "common" });
  if (mins < 60) return t("timeAgo.minsAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("timeAgo.hoursAgo", { count: hours });
  return t("timeAgo.daysAgo", { count: Math.floor(hours / 24) });
}

function SubscriptionCard({
  sub,
  onRefresh,
  onRemove,
  onSetPrimary,
}: {
  sub: Subscription;
  onRefresh: (id: string) => void;
  onRemove: (id: string) => void;
  onSetPrimary: (id: string) => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const { t } = useTranslation("subscriptions");
  const isFile = sub.source_type === "file";

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh(sub.id);
    setRefreshing(false);
  };

  return (
    <Card className={`py-0 gap-0 transition-colors ${sub.is_primary ? "ring-1 ring-primary" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${sub.is_primary ? "bg-primary/25" : "bg-primary/15"}`}>
              {isFile ? (
                <FileText size={20} className="text-primary" />
              ) : (
                <CloudDownload size={20} className="text-primary" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{sub.name}</span>
                {sub.is_primary && (
                  <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                    <Crown size={10} />
                    {t("card.primary")}
                  </span>
                )}
                <Badge variant="outline" className="text-xs font-mono">
                  {isFile ? t("card.local") : t("card.url")}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground truncate max-w-xs">
                {sub.url}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-mono">
              {t("card.nodesCount", { count: sub.node_count })}
            </Badge>
            {!isFile && (
              <Button variant="ghost" size="icon-xs" asChild>
                <a href={sub.url} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} />
                </a>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-xs">
                  <MoreHorizontal size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!sub.is_primary && (
                  <DropdownMenuItem onClick={() => onSetPrimary(sub.id)}>
                    <Crown size={14} />
                    {t("card.setPrimary")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleRefresh} disabled={refreshing}>
                  {refreshing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  {t("card.refreshNow")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onRemove(sub.id)}
                >
                  <Trash2 size={14} />
                  {t("card.remove")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {sub.is_primary && (
          <div className="flex items-center gap-2 mb-3 text-xs text-primary bg-primary/10 rounded-lg px-3 py-2">
            <Crown size={12} />
            <span>{t("card.primaryInfo")}</span>
          </div>
        )}
        {!sub.is_primary && sub.node_count > 0 && (
          <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
            <span>{t("card.secondaryInfo")}</span>
          </div>
        )}

        {sub.status === "error" && (
          <div className="flex items-center gap-2 mb-3 text-xs text-warning bg-warning/10 rounded-lg px-3 py-2">
            <AlertTriangle size={14} />
            <span>{t("card.refreshError")}</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-4 text-xs">
          <div>
            <div className="text-muted-foreground mb-0.5">{t("card.lastRefreshed")}</div>
            <div className="font-medium">{timeAgo(sub.last_refreshed, t)}</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-0.5">
              {isFile ? t("card.source") : t("card.interval")}
            </div>
            <div className="font-medium">
              {isFile ? t("card.localFile") : `${sub.interval_secs / 3600}h`}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-0.5">{t("card.status")}</div>
            <StatusBadge status={sub.status} />
          </div>
        </div>

        <UsageBar used={sub.usage_used_gb} total={sub.usage_total_gb} />
        {sub.expires && (
          <div className="text-right mt-0.5">
            <span className="text-xs text-muted-foreground">
              {t("card.expires", { date: sub.expires })}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddSubscriptionDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [sourceType, setSourceType] = useState<"url" | "file">("url");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation("subscriptions");
  const { t: tc } = useTranslation("common");

  const handlePickFile = async () => {
    const selected = await api.pickFile({
      title: t("dialog.filePickerTitle"),
      filters: [{ name: "Config", extensions: ["conf", "txt", "list"] }],
    });
    if (selected) {
      setUrl(selected as string);
      if (!name.trim()) {
        const filename = (selected as string).split("/").pop() || "";
        setName(filename.replace(/\.(conf|txt|list)$/, ""));
      }
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !url.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.addSubscription(name.trim(), url.trim(), sourceType);
      setOpen(false);
      setName("");
      setUrl("");
      setSourceType("url");
      onAdded();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} />
          {t("dialog.triggerLabel")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dialog.addTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Source Type Toggle */}
          <div className="flex gap-2">
            <button
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                sourceType === "url"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => { setSourceType("url"); setUrl(""); }}
            >
              <CloudDownload size={16} />
              {t("dialog.fromUrl")}
            </button>
            <button
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                sourceType === "file"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => { setSourceType("file"); setUrl(""); }}
            >
              <FileText size={16} />
              {t("dialog.fromFile")}
            </button>
          </div>

          <div>
            <Label>{t("dialog.nameLabel")}</Label>
            <Input
              placeholder={t("dialog.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {sourceType === "url" ? (
            <div>
              <Label>{t("dialog.urlLabel")}</Label>
              <Input
                placeholder={t("dialog.urlPlaceholder")}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          ) : (
            <div>
              <Label>{t("dialog.fileLabel")}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={t("dialog.filePlaceholder")}
                  value={url}
                  readOnly
                  className="flex-1"
                />
                <Button variant="outline" size="icon" onClick={handlePickFile}>
                  <FolderOpen size={16} />
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {tc("actions.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 size={14} className="animate-spin" />}
            {tc("actions.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<{ title: string; description?: string; onConfirm: () => void } | null>(null);
  const { t } = useTranslation("subscriptions");
  const { t: tc } = useTranslation("common");

  const load = useCallback(async () => {
    try {
      const data = await api.getSubscriptions();
      setSubs(data);
    } catch {
      /* noop on first load */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async (id: string) => {
    try {
      const updated = await api.refreshSubscription(id);
      setSubs((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (e) {
      console.error("Refresh failed:", e);
    }
  };

  const handleRemove = async (id: string) => {
    await api.removeSubscription(id);
    setSubs((prev) => prev.filter((s) => s.id !== id));
  };

  const confirmRemove = (sub: Subscription) => {
    setConfirm({
      title: t("page.removeTitle"),
      description: t("page.removeDesc", { name: sub.name }),
      onConfirm: () => { setConfirm(null); handleRemove(sub.id); },
    });
  };

  const handleSetPrimary = async (id: string) => {
    await api.setPrimarySubscription(id);
    setSubs((prev) => prev.map((s) => ({ ...s, is_primary: s.id === id })));
  };

  return (
    <div className="p-6 w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            {t("page.breadcrumb")}
          </div>
          <h1 className="text-xl font-bold">{t("page.title")}</h1>
        </div>
        <AddSubscriptionDialog onAdded={load} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 size={20} className="animate-spin mr-2" />
          {tc("status.loading")}
        </div>
      ) : subs.length === 0 ? (
        <button
          className="w-full py-10 border border-dashed border-border rounded-lg flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
          onClick={() =>
            document
              .querySelector<HTMLButtonElement>("[data-slot=dialog-trigger]")
              ?.click()
          }
        >
          <CloudDownload size={24} />
          <div className="text-sm font-medium">{t("page.emptyTitle")}</div>
          <div className="text-xs">
            {t("page.emptyHint")}
          </div>
        </button>
      ) : (
        <div className="space-y-4">
          {subs.map((sub) => (
            <SubscriptionCard
              key={sub.id}
              sub={sub}
              onRefresh={handleRefresh}
              onRemove={() => confirmRemove(sub)}
              onSetPrimary={handleSetPrimary}
            />
          ))}
        </div>
      )}

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
