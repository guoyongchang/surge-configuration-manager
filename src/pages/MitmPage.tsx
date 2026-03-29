import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { AdvancedSections } from "@/types";
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

export default function MitmPage() {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const [mitmSection, setMitmSection] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const s = await api.getAdvancedSections();
    setMitmSection(s.mitm ?? "");
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only update mitm_section, preserve other sections
      const current = await api.getAdvancedSections();
      const updated: AdvancedSections = {
        ...current,
        mitm: mitmSection,
      };
      await api.updateAdvancedSections(updated);
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
        <div className="text-xs text-muted-foreground mb-1">{t("mitm.breadcrumb")}</div>
        <h1 className="text-xl font-bold">{t("mitm.title")}</h1>
      </div>

      <Card className="py-0 gap-0">
        <CardContent className="p-5 space-y-4">
          <SectionTextarea
            label={t("mitm.label")}
            description={t("mitm.hint")}
            value={mitmSection}
            onChange={setMitmSection}
            placeholder={"hostname = *.google.com, *.apple.com\nskip-server-cert-verify = true"}
          />
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
