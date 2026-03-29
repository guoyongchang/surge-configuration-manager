import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Save, Loader2, Settings2, Globe, Shield, BookMarked, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { GeneralSettings, AdvancedSections, CloudSyncSettings } from "@/types";
import * as api from "@/lib/api";

function SectionTextarea({
  label,
  description,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground mb-1.5">{description}</p>
      )}
      <textarea
        className="w-full h-32 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const [general, setGeneral] = useState<GeneralSettings>({
    http_listen: "0.0.0.0:7890",
    socks5_listen: "0.0.0.0:7891",
    extra_lines: [],
  });
  const [sections, setSections] = useState<AdvancedSections>({
    mitm: "",
    host: "",
    url_rewrite: "",
  });
  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingSections, setSavingSections] = useState(false);
  const [savedGeneral, setSavedGeneral] = useState(false);
  const [savedSections, setSavedSections] = useState(false);
  const [cloudSync, setCloudSync] = useState<CloudSyncSettings>({
    enabled: false,
    github_pat: null,
    repo_url: null,
    auto_sync: false,
    last_synced_at: null,
  });
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [savingCloudSync, setSavingCloudSync] = useState(false);
  const [savedCloudSync, setSavedCloudSync] = useState(false);

  const load = useCallback(async () => {
    try {
      const [g, s, cs] = await Promise.all([
        api.getGeneralSettings(),
        api.getAdvancedSections(),
        api.getCloudSyncSettings(),
      ]);
      setGeneral(g);
      setSections(s);
      setCloudSync(cs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveGeneral = async () => {
    setSavingGeneral(true);
    try {
      await api.updateGeneralSettings(general);
      setSavedGeneral(true);
      setTimeout(() => setSavedGeneral(false), 2000);
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSaveSections = async () => {
    setSavingSections(true);
    try {
      await api.updateAdvancedSections(sections);
      setSavedSections(true);
      setTimeout(() => setSavedSections(false), 2000);
    } finally {
      setSavingSections(false);
    }
  };

  const extraLinesText = general.extra_lines.join("\n");
  const setExtraLinesText = (text: string) =>
    setGeneral((prev) => ({
      ...prev,
      extra_lines: text ? text.split("\n") : [],
    }));

  const handleSaveCloudSync = async () => {
    setSavingCloudSync(true);
    try {
      await api.updateCloudSyncSettings(cloudSync);
      setSavedCloudSync(true);
      setTimeout(() => setSavedCloudSync(false), 2000);
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setSavingCloudSync(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      await api.syncToCloud();
      const cs = await api.getCloudSyncSettings();
      setCloudSync(cs);
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 size={20} className="animate-spin mr-2" />
        {tc("status.loading")}
      </div>
    );
  }

  return (
    <div className="p-6 w-full max-w-2xl">
      <div className="mb-6">
        <div className="text-xs text-muted-foreground mb-1">{t("page.breadcrumb")}</div>
        <h1 className="text-xl font-bold">{t("page.title")}</h1>
      </div>

      {/* General Settings */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Settings2 size={15} className="text-muted-foreground" />
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t("general.sectionTitle")}
          </h2>
        </div>
        <Card className="py-0 gap-0">
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("general.httpListenLabel")}</Label>
                <p className="text-xs text-muted-foreground mb-1.5">
                  {t("general.httpListenHint")}
                </p>
                <Input
                  placeholder="0.0.0.0:7890"
                  value={general.http_listen ?? ""}
                  onChange={(e) =>
                    setGeneral((prev) => ({
                      ...prev,
                      http_listen: e.target.value || null,
                    }))
                  }
                />
              </div>
              <div>
                <Label>{t("general.socks5ListenLabel")}</Label>
                <p className="text-xs text-muted-foreground mb-1.5">
                  {t("general.socks5ListenHint")}
                </p>
                <Input
                  placeholder="0.0.0.0:7891"
                  value={general.socks5_listen ?? ""}
                  onChange={(e) =>
                    setGeneral((prev) => ({
                      ...prev,
                      socks5_listen: e.target.value || null,
                    }))
                  }
                />
              </div>
            </div>
            <SectionTextarea
              label={t("general.extraLinesLabel")}
              description={t("general.extraLinesHint")}
              value={extraLinesText}
              onChange={setExtraLinesText}
              placeholder={"internet-test-url = http://google.com/\nproxy-test-url = http://google.com/\nloglevel = notify"}
            />
            <div className="flex justify-end">
              <Button onClick={handleSaveGeneral} disabled={savingGeneral} size="sm">
                {savingGeneral ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : savedGeneral ? (
                  <RefreshCw size={14} />
                ) : (
                  <Save size={14} />
                )}
                {savedGeneral ? tc("status.saved") : t("general.saveBtn")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* MITM */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={15} className="text-muted-foreground" />
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t("mitm.sectionTitle")}
          </h2>
        </div>
        <Card className="py-0 gap-0">
          <CardContent className="p-5 space-y-4">
            <SectionTextarea
              label={t("mitm.label")}
              description={t("mitm.hint")}
              value={sections.mitm}
              onChange={(v) => setSections((prev) => ({ ...prev, mitm: v }))}
              placeholder={"hostname = *.google.com, *.apple.com\nskip-server-cert-verify = true"}
            />
          </CardContent>
        </Card>
      </section>

      {/* Host */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Globe size={15} className="text-muted-foreground" />
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t("host.sectionTitle")}
          </h2>
        </div>
        <Card className="py-0 gap-0">
          <CardContent className="p-5 space-y-4">
            <SectionTextarea
              label={t("host.label")}
              description={t("host.hint")}
              value={sections.host}
              onChange={(v) => setSections((prev) => ({ ...prev, host: v }))}
              placeholder={"example.com = 1.2.3.4\nfoo.internal = 192.168.1.10"}
            />
          </CardContent>
        </Card>
      </section>

      {/* URL Rewrite */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <BookMarked size={15} className="text-muted-foreground" />
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t("urlRewrite.sectionTitle")}
          </h2>
        </div>
        <Card className="py-0 gap-0">
          <CardContent className="p-5 space-y-4">
            <SectionTextarea
              label={t("urlRewrite.label")}
              description={t("urlRewrite.hint")}
              value={sections.url_rewrite}
              onChange={(v) => setSections((prev) => ({ ...prev, url_rewrite: v }))}
              placeholder={"^http://example.com https://example.com 302"}
            />
          </CardContent>
        </Card>
      </section>

      {/* Save advanced sections */}
      <div className="flex justify-end mb-8">
        <Button onClick={handleSaveSections} disabled={savingSections}>
          {savingSections ? (
            <Loader2 size={14} className="animate-spin" />
          ) : savedSections ? (
            <RefreshCw size={14} />
          ) : (
            <Save size={14} />
          )}
          {savedSections ? tc("status.saved") : t("saveSectionsBtn")}
        </Button>
      </div>

      {/* Cloud Sync */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Globe size={15} className="text-muted-foreground" />
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t("cloudSync.sectionTitle")}
          </h2>
        </div>
        <Card className="py-0 gap-0">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm">{t("cloudSync.enableLabel")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("cloudSync.enableHint")}
                </div>
              </div>
              <Switch
                checked={cloudSync.enabled}
                onCheckedChange={(v) => setCloudSync((p) => ({ ...p, enabled: v }))}
              />
            </div>

            <div>
              <Label>{t("cloudSync.patLabel")}</Label>
              <p className="text-xs text-muted-foreground mb-1.5">
                {t("cloudSync.patHint")}
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
              <Label>{t("cloudSync.repoUrlLabel")}</Label>
              <p className="text-xs text-muted-foreground mb-1.5">
                {t("cloudSync.repoUrlHint")}
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
                <div className="text-sm">{t("cloudSync.autoSyncLabel")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("cloudSync.autoSyncHint")}
                </div>
              </div>
              <Switch
                checked={cloudSync.auto_sync}
                onCheckedChange={(v) => setCloudSync((p) => ({ ...p, auto_sync: v }))}
              />
            </div>

            {cloudSync.last_synced_at && (
              <div className="text-xs text-muted-foreground">
                {t("cloudSync.lastSynced")}: {new Date(cloudSync.last_synced_at).toLocaleString()}
              </div>
            )}

            {syncError && (
              <div className="text-xs text-danger">{syncError}</div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSaveCloudSync} disabled={savingCloudSync} size="sm">
                {savingCloudSync ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : savedCloudSync ? (
                  <RefreshCw size={14} />
                ) : (
                  <Save size={14} />
                )}
                {savedCloudSync ? tc("status.saved") : t("cloudSync.saveBtn")}
              </Button>
              {cloudSync.enabled && (
                <Button onClick={handleSyncNow} size="sm" disabled={syncing}>
                  {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {t("cloudSync.syncNow")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
