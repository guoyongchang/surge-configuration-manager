import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Save, Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GeneralSettings } from "@/types";
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

export default function GeneralSettingsPage() {
  const { t } = useTranslation();
  const { t: tc } = useTranslation();
  const [settings, setSettings] = useState<GeneralSettings>({
    http_listen: null,
    socks5_listen: null,
    extra_lines: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const g = await api.getGeneralSettings();
    setSettings(g);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateGeneralSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const extraLinesText = settings.extra_lines.join("\n");
  const setExtraLinesText = (text: string) =>
    setSettings((prev) => ({
      ...prev,
      extra_lines: text ? text.split("\n") : [],
    }));

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
          <Settings2 size={18} className="text-muted-foreground" />
          <h1 className="text-xl font-bold">{t("settings_general_sectionTitle")}</h1>
        </div>
      </div>

      <Card className="py-0 gap-0">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("settings_general_httpListenLabel")}</Label>
              <p className="text-xs text-muted-foreground mb-1.5">
                {t("settings_general_httpListenHint")}
              </p>
              <Input
                placeholder="0.0.0.0:7890"
                value={settings.http_listen ?? ""}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    http_listen: e.target.value || null,
                  }))
                }
              />
            </div>
            <div>
              <Label>{t("settings_general_socks5ListenLabel")}</Label>
              <p className="text-xs text-muted-foreground mb-1.5">
                {t("settings_general_socks5ListenHint")}
              </p>
              <Input
                placeholder="0.0.0.0:7891"
                value={settings.socks5_listen ?? ""}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    socks5_listen: e.target.value || null,
                  }))
                }
              />
            </div>
          </div>
          <SectionTextarea
            label={t("settings_general_extraLinesLabel")}
            description={t("settings_general_extraLinesHint")}
            value={extraLinesText}
            onChange={setExtraLinesText}
            placeholder={"internet-test-url = http://google.com/\nproxy-test-url = http://google.com/\nloglevel = notify"}
          />
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : saved ? (
                <Save size={14} />
              ) : (
                <Save size={14} />
              )}
              {saved ? tc("status.saved") : t("settings_general_saveBtn")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
