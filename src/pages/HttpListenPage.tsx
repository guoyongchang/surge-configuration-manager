import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GeneralSettings } from "@/types";
import * as api from "@/lib/api";

export default function HttpListenPage() {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const [httpListen, setHttpListen] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const g = await api.getGeneralSettings();
    setHttpListen(g.http_listen ?? "");
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only update http_listen, preserve other settings
      const current = await api.getGeneralSettings();
      const updated: GeneralSettings = {
        ...current,
        http_listen: httpListen || null,
      };
      await api.updateGeneralSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
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
        <h1 className="text-xl font-bold">{t("httpListen.title")}</h1>
      </div>

      <Card className="py-0 gap-0">
        <CardContent className="p-5 space-y-4">
          <div>
            <Label>{t("general.httpListenLabel")}</Label>
            <p className="text-xs text-muted-foreground mb-1.5">
              {t("general.httpListenHint")}
            </p>
            <Input
              placeholder="0.0.0.0:7890"
              value={httpListen}
              onChange={(e) => setHttpListen(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : saved ? (
                "✓"
              ) : (
                <Save size={14} />
              )}
              {saved ? tc("status.saved") : t("general.saveBtn")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
