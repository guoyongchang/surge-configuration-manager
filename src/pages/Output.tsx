import { useEffect, useState, useCallback } from "react";
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
import { DiffEditor } from "@monaco-editor/react";
import type { OutputConfig, BuildRecord, BackupInfo, CloudSyncSettings, SyncConflictInfo } from "@/types";
import * as api from "@/lib/api";
import { CloudSyncConflictDialog } from "@/components/CloudSyncConflictDialog";

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
  const { t } = useTranslation();
  const { t: tc } = useTranslation();
  const [config, setConfig] = useState<OutputConfig | null>(null);
  const [builds, setBuilds] = useState<BuildRecord[]>([]);
  const [generating, setGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [lastBuildTime, setLastBuildTime] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [backupPreviewOpen, setBackupPreviewOpen] = useState(false);
  const [backupOriginal, setBackupOriginal] = useState("");
  const [backupModified, setBackupModified] = useState("");
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [syncConflictOpen, setSyncConflictOpen] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<SyncConflictInfo | null>(null);
  const [cloudSync, setCloudSync] = useState<CloudSyncSettings | null>(null);

  const load = useCallback(async () => {
    try {
      const [cfg, history, cs] = await Promise.all([
        api.getOutputConfig(),
        api.getBuildHistory(),
        api.getCloudSyncSettings(),
      ]);
      setConfig(cfg);
      setBuilds(history);
      setCloudSync(cs);
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

      // Auto-sync if enabled
      if (cloudSync?.enabled && cloudSync?.auto_sync) {
        const conflict = await api.checkSyncConflict();
        if (conflict) {
          setConflictInfo(conflict);
          setSyncConflictOpen(true);
        } else {
          await api.syncToCloud();
          const cs = await api.getCloudSyncSettings();
          setCloudSync(cs);
        }
      }
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

  const handleKeepLocal = async () => {
    if (!conflictInfo) return;
    await api.syncToCloud();
    const cs = await api.getCloudSyncSettings();
    setCloudSync(cs);
  };

  const handleKeepCloud = async () => {
    await api.syncFromCloud();
    const cs = await api.getCloudSyncSettings();
    setCloudSync(cs);
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 size={20} className="animate-spin mr-2" />
        {tc("status_loading")}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">{t("output_page.title")}</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {t("output_page.subtitle")}
        </p>
      </div>

      <div className="flex gap-6">
        {/* Left column: Settings */}
        <div className="flex-1 space-y-5">
          {/* Output Path + Filename */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">
              {t("output_page.outputPathLabel")}
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
              {t("output_page.outputFilenameLabel")}
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
              {t("output_page.outputFilenameHint")}
            </p>
          </div>

          {/* Toggles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm">{t("output_page.regenerateLabel")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("output_page.regenerateHint")}
                </div>
              </div>
              <Switch
                checked={config.auto_regenerate}
                onCheckedChange={(v) => updateConfig({ auto_regenerate: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm">{t("output_page.minifyLabel")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("output_page.minifyHint")}
                </div>
              </div>
              <Switch
                checked={config.minify}
                onCheckedChange={(v) => updateConfig({ minify: v })}
              />
            </div>
          </div>

          {/* Preview button */}
          <Button variant="outline" onClick={handlePreview} className="w-full">
            <Eye size={16} />
            {t("output_page.previewBtn")}
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
            {generating ? t("output_page.generatingBtn") : t("output_page.generateBtn")}
          </Button>

          {/* Status */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">{t("output_page.statusLabel")}</span>
              <span className="text-success font-medium">{t("output_page.statusReady")}</span>
            </div>
            {lastBuildTime && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">{t("output_page.lastBuildLabel")}</span>
                <span>{timeDisplay(lastBuildTime, t)}</span>
              </div>
            )}
          </div>

          {/* Build History */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">{t("output_page.buildHistoryTitle")}</h3>
              {builds.length > 0 && (
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-primary"
                  onClick={handleClearHistory}
                >
                  {t("output_page.clearAllBtn")}
                </Button>
              )}
            </div>
            {builds.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-6">
                {t("output_page.noBuilds")}
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
                          <div className="text-xs text-muted-foreground">{t("output_page.noChange")}</div>
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
            {t("output_page.historyVersionsBtn")}
          </Button>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent style={{ maxWidth: "80vw" }} className="max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t("output_page.previewTitle")}</DialogTitle>
          </DialogHeader>
          <pre className="text-xs font-mono bg-background border border-border rounded-lg p-4 overflow-auto max-h-[60vh] whitespace-pre-wrap">
            {previewContent || t("page.noPreviewData")}
          </pre>
        </DialogContent>
      </Dialog>

      {/* History Versions Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent style={{ maxWidth: "80vw" }} className="max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t("output_page.historyVersionsTitle")}</DialogTitle>
          </DialogHeader>
          {backups.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              {t("output_page.noBackups")}
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
                          {t("output_page.backupCreated")}: {new Date(backup.created).toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t("output_page.backupSize")}:{" "}
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
                          const [original, modified] = await Promise.all([
                            api.getBackupContent(backup.filename),
                            api.previewConfig(),
                          ]);
                          setBackupOriginal(original);
                          setBackupModified(modified);
                          setBackupPreviewOpen(true);
                        } catch (e) {
                          console.error("Preview failed:", e);
                        }
                      }}
                    >
                      <Eye size={12} />
                      {t("output_page.backupPreview")}
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        setSelectedBackup(backup.filename);
                        setRollbackConfirmOpen(true);
                      }}
                    >
                      {t("output_page.rollback")}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Backup Preview Dialog — Monaco DiffEditor */}
      <Dialog open={backupPreviewOpen} onOpenChange={setBackupPreviewOpen}>
        <DialogContent
          style={{ maxWidth: "90vw" }}
          className="!w-[90vw] max-h-[85vh]"
        >
          <DialogHeader className="mb-2">
            <DialogTitle>{t("output_page.backupPreview")}</DialogTitle>
            <p className="text-xs text-muted-foreground">{t("output_page.diffHint")}</p>
          </DialogHeader>
          <div style={{ height: "65vh" }} className="border border-border rounded-lg overflow-hidden">
            <DiffEditor
              original={backupOriginal}
              modified={backupModified}
              language="plaintext"
              theme="vs-dark"
              options={{
                readOnly: true,
                renderSideBySide: true,
                scrollBeyondLastLine: false,
                minimap: { enabled: false },
                lineNumbers: "on",
                folding: true,
                wordWrap: "off",
                automaticLayout: true,
                fixedOverflowWidgets: true,
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Rollback Confirm Dialog */}
      <Dialog open={rollbackConfirmOpen} onOpenChange={setRollbackConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("output_page.rollbackConfirmTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("output_page.rollbackConfirm")}</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setRollbackConfirmOpen(false)}>
              {tc("output_page.cancel")}
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
              {t("output_page.rollback")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cloud Sync Conflict Dialog */}
      {cloudSync?.enabled && (
        <CloudSyncConflictDialog
          open={syncConflictOpen}
          onOpenChange={setSyncConflictOpen}
          localContent={conflictInfo?.local_content ?? ""}
          cloudContent={conflictInfo?.cloud_content ?? ""}
          onKeepLocal={handleKeepLocal}
          onKeepCloud={handleKeepCloud}
        />
      )}
    </div>
  );
}
