import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  FolderOpen,
  Zap,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  Archive,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { diffLines } from "diff";
import type { OutputConfig, BuildRecord, BackupInfo } from "@/types";
import * as api from "@/lib/api";

interface DiffRow {
  left: { text: string; color: "neutral" | "removed" | "empty" };
  right: { text: string; color: "neutral" | "added" | "empty" };
}

function buildSideBySideRows(diff: ReturnType<typeof diffLines>): DiffRow[] {
  const rows: DiffRow[] = [];
  let i = 0;
  while (i < diff.length) {
    const part = diff[i];
    if (part.added) {
      // Check if previous part was removed — pair them
      if (i > 0 && diff[i - 1].removed) {
        const prevLines = diff[i - 1].value.split("\n");
        const currLines = part.value.split("\n");
        const maxLen = Math.max(prevLines.length, currLines.length);
        for (let j = 0; j < maxLen; j++) {
          rows.push({
            left: {
              text: prevLines[j] ?? "",
              color: prevLines[j] !== undefined ? "removed" : "empty",
            },
            right: {
              text: currLines[j] ?? "",
              color: currLines[j] !== undefined ? "added" : "empty",
            },
          });
        }
      } else {
        // Just added lines
        for (const line of part.value.split("\n")) {
          if (line === "" && part.value.endsWith("\n")) continue;
          rows.push({ left: { text: "", color: "empty" }, right: { text: line, color: "added" } });
        }
      }
    } else if (part.removed) {
      // Removed lines not followed by added — show alone
      let j = i + 1;
      let paired = false;
      if (j < diff.length && diff[j].added) {
        // Will be paired in next iteration via the "added" branch above
        paired = true;
      }
      if (!paired) {
        for (const line of part.value.split("\n")) {
          if (line === "" && part.value.endsWith("\n")) continue;
          rows.push({ left: { text: line, color: "removed" }, right: { text: "", color: "empty" } });
        }
      }
    } else {
      // Unchanged
      for (const line of part.value.split("\n")) {
        if (line === "" && part.value.endsWith("\n")) continue;
        rows.push({ left: { text: line, color: "neutral" }, right: { text: line, color: "neutral" } });
      }
    }
    i++;
  }
  return rows;
}

function StatusIcon({ status }: { status: BuildRecord["status"] }) {
  if (status === "success")
    return <CheckCircle size={16} className="text-success" />;
  return <XCircle size={16} className="text-danger" />;
}

function timeDisplay(iso: string, t: (key: string) => string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 86400000) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return t("page.yesterday");
}

export default function OutputPage() {
  const { t } = useTranslation("output");
  const { t: tc } = useTranslation("common");
  const [config, setConfig] = useState<OutputConfig | null>(null);
  const [builds, setBuilds] = useState<BuildRecord[]>([]);
  const [generating, setGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [lastBuildTime, setLastBuildTime] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [backupPreviewOpen, setBackupPreviewOpen] = useState(false);
  const [backupDiff, setBackupDiff] = useState<ReturnType<typeof diffLines>>([]);
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);

  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  const handleDiffScroll = useCallback((source: "left" | "right") => {
    const sourceEl = source === "left" ? leftScrollRef.current : rightScrollRef.current;
    const targetEl = source === "left" ? rightScrollRef.current : leftScrollRef.current;
    if (!sourceEl || !targetEl || syncingRef.current) return;
    syncingRef.current = true;
    targetEl.scrollTop = sourceEl.scrollTop;
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const [cfg, history] = await Promise.all([
        api.getOutputConfig(),
        api.getBuildHistory(),
      ]);
      setConfig(cfg);
      setBuilds(history);
      if (history.length > 0) {
        setLastBuildTime(history[0].time);
      }
    } catch {
      /* first load */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateConfig = async (partial: Partial<OutputConfig>) => {
    if (!config) return;
    const updated = { ...config, ...partial };
    setConfig(updated);
    await api.updateOutputConfig(updated);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const record = await api.generateConfig();
      setBuilds((prev) => [record, ...prev].slice(0, 20));
      setLastBuildTime(record.time);
    } catch (e) {
      console.error("Generate failed:", e);
    } finally {
      setGenerating(false);
    }
  };

  const handlePickFolder = async () => {
    const selected = await api.pickFolder({
      title: t("page.selectOutputDir"),
    });
    if (selected) {
      updateConfig({ output_path: selected as string });
    }
  };

  const handlePreview = async () => {
    try {
      const content = await api.previewConfig();
      setPreviewContent(content);
      setPreviewOpen(true);
    } catch (e) {
      console.error("Preview failed:", e);
    }
  };

  const handleClearHistory = async () => {
    await api.clearBuildHistory();
    setBuilds([]);
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 size={20} className="animate-spin mr-2" />
        {tc("status.loading")}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">{t("page.title")}</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {t("page.subtitle")}
        </p>
      </div>

      <div className="flex gap-6">
        {/* Left column: Settings */}
        <div className="flex-1 space-y-5">
          {/* Output Path + Filename */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">
              {t("page.outputPathLabel")}
            </Label>
            <div className="flex gap-2">
              <div className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm font-mono truncate">
                {config.output_path}
              </div>
              <Button variant="outline" size="icon" onClick={handlePickFolder}>
                <FolderOpen size={16} />
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">
              {t("page.outputFilenameLabel")}
            </Label>
            <Input
              className="font-mono text-sm"
              value={config.output_filename}
              placeholder="surge.conf"
              onChange={(e) => updateConfig({ output_filename: e.target.value })}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (!v) updateConfig({ output_filename: "surge.conf" });
              }}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("page.outputFilenameHint")}
            </p>
          </div>

          {/* Toggles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm">{t("page.regenerateLabel")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("page.regenerateHint")}
                </div>
              </div>
              <Switch
                checked={config.auto_regenerate}
                onCheckedChange={(v) => updateConfig({ auto_regenerate: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm">{t("page.minifyLabel")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("page.minifyHint")}
                </div>
              </div>
              <Switch
                checked={config.minify}
                onCheckedChange={(v) => updateConfig({ minify: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm">{t("page.autoUploadLabel")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("page.autoUploadHint")}
                </div>
              </div>
              <Switch
                checked={config.auto_upload}
                onCheckedChange={(v) => updateConfig({ auto_upload: v })}
              />
            </div>
          </div>

          {/* Preview button */}
          <Button variant="outline" onClick={handlePreview} className="w-full">
            <Eye size={16} />
            {t("page.previewBtn")}
          </Button>
        </div>

        {/* Right column: Generate + History */}
        <div className="w-80 space-y-4">
          {/* Generate button */}
          <Button
            size="lg"
            className="w-full h-auto py-8 flex-col gap-2 text-lg font-semibold"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <Loader2 size={28} className="animate-spin" />
            ) : (
              <Zap size={28} />
            )}
            {generating ? t("page.generatingBtn") : t("page.generateBtn")}
          </Button>

          {/* Status */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">{t("page.statusLabel")}</span>
              <span className="text-success font-medium">{t("page.statusReady")}</span>
            </div>
            {lastBuildTime && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">{t("page.lastBuildLabel")}</span>
                <span>{timeDisplay(lastBuildTime, t)}</span>
              </div>
            )}
          </div>

          {/* Build History */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">{t("page.buildHistoryTitle")}</h3>
              {builds.length > 0 && (
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-primary"
                  onClick={handleClearHistory}
                >
                  {t("page.clearAllBtn")}
                </Button>
              )}
            </div>
            {builds.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-6">
                {t("page.noBuilds")}
              </div>
            ) : (
              <div className="space-y-2">
                {builds.map((build) => (
                  <Card key={build.id} className="py-0 gap-0">
                    <CardContent className="flex items-center gap-3 px-3 py-2.5">
                      <StatusIcon status={build.status} />
                      <div className="flex-1 min-w-0">
                        {build.filename ? (
                          <div className="flex items-center gap-1 text-xs font-medium">
                            <Archive size={11} className="text-primary shrink-0" />
                            <span className="font-mono truncate">{build.filename}</span>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">{t("page.noChange")}</div>
                        )}
                        <div className="text-xs text-muted-foreground truncate">
                          {build.description}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {timeDisplay(build.time, t)}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          {/* History Versions button */}
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const list = await api.getBackups();
                setBackups(list);
                setHistoryOpen(true);
              } catch (e) {
                console.error("Failed to load backups:", e);
              }
            }}
            className="w-full"
          >
            <History size={16} />
            {t("page.historyVersionsBtn")}
          </Button>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t("page.previewTitle")}</DialogTitle>
          </DialogHeader>
          <pre className="text-xs font-mono bg-background border border-border rounded-lg p-4 overflow-auto max-h-[60vh] whitespace-pre-wrap">
            {previewContent || t("page.noPreviewData")}
          </pre>
        </DialogContent>
      </Dialog>

      {/* History Versions Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t("page.historyVersionsTitle")}</DialogTitle>
          </DialogHeader>
          {backups.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              {t("page.noBackups")}
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-auto">
              {backups.map((backup) => (
                <Card key={backup.filename} className="py-0 gap-0">
                  <CardContent className="flex items-center gap-3 px-3 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 text-xs font-medium">
                        <Archive size={11} className="text-primary shrink-0" />
                        <span className="font-mono truncate">{backup.filename}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {t("page.backupCreated")}: {new Date(backup.created).toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t("page.backupSize")}:{" "}
                          {backup.size_bytes < 1024
                            ? `${backup.size_bytes} B`
                            : backup.size_bytes < 1024 * 1024
                              ? `${(backup.size_bytes / 1024).toFixed(1)} KB`
                              : `${(backup.size_bytes / (1024 * 1024)).toFixed(1)} MB`}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={async () => {
                        try {
                          const [backupContent, currentContent] = await Promise.all([
                            api.getBackupContent(backup.filename),
                            api.previewConfig(),
                          ]);
                          const changes = diffLines(backupContent, currentContent);
                          setBackupDiff(changes);
                          setBackupPreviewOpen(true);
                        } catch (e) {
                          console.error("Preview failed:", e);
                        }
                      }}
                    >
                      <Eye size={12} />
                      {t("page.backupPreview")}
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        setSelectedBackup(backup.filename);
                        setRollbackConfirmOpen(true);
                      }}
                    >
                      {t("page.rollback")}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Backup Preview Dialog — side-by-side diff */}
      <Dialog open={backupPreviewOpen} onOpenChange={setBackupPreviewOpen}>
        <DialogContent className="max-w-[80vw] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t("page.backupPreview")}</DialogTitle>
            <p className="text-xs text-muted-foreground">{t("page.diffHint")}</p>
          </DialogHeader>
          <div className="flex text-xs font-mono leading-5 border border-border rounded-lg overflow-hidden">
            {/* Left: backup */}
            <div
              ref={leftScrollRef}
              onScroll={() => handleDiffScroll("left")}
              className="flex-1 overflow-auto max-h-[65vh] bg-card"
            >
              <div className="sticky top-0 bg-card border-b border-border px-3 py-1.5 font-semibold text-xs text-muted-foreground z-10">
                Backup
              </div>
              {buildSideBySideRows(backupDiff).map((row, idx) => {
                const leftColor =
                  row.left.color === "removed"
                    ? "bg-red-950/30 text-red-400"
                    : row.left.color === "empty"
                      ? "bg-muted/20"
                      : "text-muted-foreground";
                return (
                  <div
                    key={idx}
                    className={`px-3 py-0.5 ${leftColor}`}
                  >
                    {row.left.text || "\u00A0"}
                  </div>
                );
              })}
            </div>
            {/* Divider */}
            <div className="w-px bg-border shrink-0" />
            {/* Right: current */}
            <div
              ref={rightScrollRef}
              onScroll={() => handleDiffScroll("right")}
              className="flex-1 overflow-auto max-h-[65vh] bg-card"
            >
              <div className="sticky top-0 bg-card border-b border-border px-3 py-1.5 font-semibold text-xs text-muted-foreground z-10">
                Current
              </div>
              {buildSideBySideRows(backupDiff).map((row, idx) => {
                const rightColor =
                  row.right.color === "added"
                    ? "bg-green-950/30 text-green-400"
                    : row.right.color === "empty"
                      ? "bg-muted/20"
                      : "text-muted-foreground";
                return (
                  <div
                    key={idx}
                    className={`px-3 py-0.5 ${rightColor}`}
                  >
                    {row.right.text || "\u00A0"}
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rollback Confirm Dialog */}
      <Dialog open={rollbackConfirmOpen} onOpenChange={setRollbackConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("page.rollbackConfirmTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("page.rollbackConfirm")}</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setRollbackConfirmOpen(false)}>
              {tc("page.cancel")}
            </Button>
            <Button
              onClick={async () => {
                if (!selectedBackup) return;
                try {
                  await api.rollbackToBackup(selectedBackup);
                  setRollbackConfirmOpen(false);
                  setHistoryOpen(false);
                } catch (e) {
                  console.error("Rollback failed:", e);
                }
              }}
            >
              {t("page.rollback")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
