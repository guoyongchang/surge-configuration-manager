import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Save, Loader2, Settings2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GeneralSettings } from "@/types";
import * as api from "@/lib/api";

export default function SettingsPage() {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const [general, setGeneral] = useState<GeneralSettings>({
    http_listen: "0.0.0.0:7890",
    socks5_listen: "0.0.0.0:7891",
    extra_lines: [],
  });
  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savedGeneral, setSavedGeneral] = useState(false);

  useEffect(() => {
    api.getGeneralSettings().then((g) => {
      setGeneral(g);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

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

  const extraLinesText = general.extra_lines.join("\n");
  const setExtraLinesText = (text: string) =>
    setGeneral((prev) => ({
      ...prev,
      extra_lines: text ? text.split("\n") : [],
    }));

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
            <div>
              <Label>{t("general.extraLinesLabel")}</Label>
              <p className="text-xs text-muted-foreground mb-1.5">
                {t("general.extraLinesHint")}
              </p>
              <textarea
                className="w-full h-32 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                placeholder={"internet-test-url = http://google.com/\nproxy-test-url = http://google.com/\nloglevel = notify"}
                value={extraLinesText}
                onChange={(e) => setExtraLinesText(e.target.value)}
              />
            </div>
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
    </div>
  );
}
