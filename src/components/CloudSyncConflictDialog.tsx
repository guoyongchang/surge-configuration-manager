import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SyncConflictInfo } from "@/types";

interface Props {
  conflict: SyncConflictInfo;
  onKeepLocal: () => void;
  onKeepCloud: () => void;
  loading?: boolean;
}

export default function CloudSyncConflictDialog({ conflict, onKeepLocal, onKeepCloud, loading }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={true}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-warning" />
            <DialogTitle>{t("settings_cloudSync_conflictTitle")}</DialogTitle>
          </div>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {t("settings_cloudSync_conflictHint")}
        </p>

        <div className="space-y-4">
          {conflict.changed_files.map((file) => (
            <div key={file.path} className="border border-border rounded-md overflow-hidden">
              <div className="bg-card px-3 py-2 text-xs font-mono text-muted-foreground border-b border-border">
                {file.path}
              </div>
              <div className="grid grid-cols-2 gap-0">
                <div className="border-r border-border">
                  <div className="bg-card/50 px-3 py-1 text-xs text-info font-medium border-b border-border">
                    Cloud
                  </div>
                  <pre className="p-3 text-xs overflow-x-auto max-h-48 font-mono whitespace-pre-wrap break-all">
                    {formatJson(file.cloud_content)}
                  </pre>
                </div>
                <div>
                  <div className="bg-card/50 px-3 py-1 text-xs text-success font-medium border-b border-border">
                    Local
                  </div>
                  <pre className="p-3 text-xs overflow-x-auto max-h-48 font-mono whitespace-pre-wrap break-all">
                    {formatJson(file.local_content)}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" disabled={loading}>
            {t("settings_actions_cancel")}
          </Button>
          <Button onClick={onKeepCloud} disabled={loading} variant="outline">
            {loading ? "..." : t("settings_cloudSync_keepCloud")}
          </Button>
          <Button onClick={onKeepLocal} disabled={loading}>
            {loading ? "..." : t("settings_cloudSync_keepLocal")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatJson(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}
