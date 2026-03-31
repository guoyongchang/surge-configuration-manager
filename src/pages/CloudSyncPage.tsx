import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Cloud, Download, Loader2, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { CloudSyncSettings, SyncConflictInfo } from "@/types";
import * as api from "@/lib/api";
import CloudSyncConflictDialog from "@/components/CloudSyncConflictDialog";
import ConfirmRestoreDialog from "@/components/ConfirmRestoreDialog";

export default function CloudSyncPage() {
  const { t } = useTranslation();
  const { t: tc } = useTranslation();
  const [cloudSync, setCloudSync] = useState<CloudSyncSettings>({
    enabled: false,
    github_pat: null,
    repo_url: null,
    auto_sync: false,
    last_synced_at: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // 冲突相关状态
  const [conflict, setConflict] = useState<SyncConflictInfo | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [conflictLoading, setConflictLoading] = useState(false);

  useEffect(() => {
    api.getCloudSyncSettings().then((cs) => {
      setCloudSync(cs);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateCloudSyncSettings(cloudSync);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncError(null);
    setConflict(null);
    try {
      const conflictInfo = await api.checkSyncConflict();
      if (conflictInfo) {
        setConflict(conflictInfo);
        setSyncing(false);
        return;
      }
      // No conflict — push directly
      await api.syncToCloud();
      const cs = await api.getCloudSyncSettings();
      setCloudSync(cs);
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setSyncing(false);
    }
  };

  const handleRestoreClick = () => {
    setShowRestoreConfirm(true);
  };

  const handleRestoreConfirm = async () => {
    setShowRestoreConfirm(false);
    setRestoring(true);
    setSyncError(null);
    setConflict(null);
    try {
      const conflictInfo = await api.checkSyncConflict();
      if (conflictInfo) {
        setConflict(conflictInfo);
        setRestoring(false);
        return;
      }
      // No conflict — restore directly
      await api.syncFromCloud();
      const cs = await api.getCloudSyncSettings();
      setCloudSync(cs);
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setRestoring(false);
    }
  };

  const handleKeepLocal = async () => {
    setConflictLoading(true);
    try {
      await api.syncToCloud();
      setConflict(null);
      const cs = await api.getCloudSyncSettings();
      setCloudSync(cs);
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setConflictLoading(false);
    }
  };

  const handleKeepCloud = async () => {
    setConflictLoading(true);
    try {
      await api.syncFromCloud();
      setConflict(null);
      const cs = await api.getCloudSyncSettings();
      setCloudSync(cs);
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setConflictLoading(false);
    }
  };

  const isBusy = syncing || restoring;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 size={20} className="animate-spin mr-2" />
        {t("status.loading")}
      </div>
    );
  }

  return (
    <div className="p-6 w-full max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Cloud size={18} className="text-muted-foreground" />
          <h1 className="text-xl font-bold">{t("settings_cloudSync_sectionTitle")}</h1>
        </div>
      </div>

      <Card className="py-0 gap-0">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm">{t("settings_cloudSync_enableLabel")}</div>
              <div className="text-xs text-muted-foreground">
                {t("settings_cloudSync_enableHint")}
              </div>
            </div>
            <Switch
              checked={cloudSync.enabled}
              onCheckedChange={(v) => setCloudSync((p) => ({ ...p, enabled: v }))}
            />
          </div>

          <div>
            <Label>{t("settings_cloudSync_patLabel")}</Label>
            <p className="text-xs text-muted-foreground mb-1.5">
              {t("settings_cloudSync_patHint")}
            </p>
            <Input
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
              value={cloudSync.github_pat ?? ""}
              onChange={(e) => setCloudSync((p) => ({
                ...p,
                github_pat: e.target.value || null,
              }))}
            />
          </div>

          <div>
            <Label>{t("settings_cloudSync_repoUrlLabel")}</Label>
            <p className="text-xs text-muted-foreground mb-1.5">
              {t("settings_cloudSync_repoUrlHint")}
            </p>
            <Input
              placeholder="username/repo-name"
              value={cloudSync.repo_url ?? ""}
              onChange={(e) => setCloudSync((p) => ({
                ...p,
                repo_url: e.target.value || null,
              }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm">{t("settings_cloudSync_autoSyncLabel")}</div>
              <div className="text-xs text-muted-foreground">
                {t("settings_cloudSync_autoSyncHint")}
              </div>
            </div>
            <Switch
              checked={cloudSync.auto_sync}
              onCheckedChange={(v) => setCloudSync((p) => ({ ...p, auto_sync: v }))}
            />
          </div>

          {cloudSync.last_synced_at && (
            <div className="text-xs text-muted-foreground">
              {t("settings_cloudSync_lastSynced")}: {new Date(cloudSync.last_synced_at).toLocaleString()}
            </div>
          )}

          {syncError && (
            <div className="text-xs text-danger">{syncError}</div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving || isBusy} size="sm">
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : saved ? (
                <RefreshCw size={14} />
              ) : (
                <Save size={14} />
              )}
              {saved ? tc("status.saved") : t("settings_cloudSync_saveBtn")}
            </Button>
            {cloudSync.enabled && (
              <Button onClick={handleSyncNow} size="sm" disabled={isBusy}>
                {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {t("settings_cloudSync_syncNow")}
              </Button>
            )}
            {cloudSync.enabled && (
              <Button onClick={handleRestoreClick} size="sm" disabled={isBusy} variant="outline">
                {restoring ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {t("settings_cloudSync_restoreFromCloud")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmRestoreDialog
        open={showRestoreConfirm}
        onConfirm={handleRestoreConfirm}
        onCancel={() => setShowRestoreConfirm(false)}
      />

      {conflict && (
        <CloudSyncConflictDialog
          conflict={conflict}
          onKeepLocal={handleKeepLocal}
          onKeepCloud={handleKeepCloud}
          onClose={() => setConflict(null)}
          loading={conflictLoading}
        />
      )}
    </div>
  );
}
