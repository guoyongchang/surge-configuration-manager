import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { DiffEditor } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SyncConflictInfo } from "@/types";

interface Props {
  conflict: SyncConflictInfo;
  onKeepLocal: () => void;
  onKeepCloud: () => void;
  onClose: () => void;
  loading?: boolean;
}

export default function CloudSyncConflictDialog({ conflict, onKeepLocal, onKeepCloud, onClose, loading }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        style={{ width: "80vw", maxWidth: "80vw" }}
        className="!w-[80vw] max-h-[85vh] overflow-y-auto"
      >
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
              <div className="bg-card px-3 py-2 text-xs font-mono text-muted-foreground border-b border-border flex items-center justify-between">
                <span>{file.path}</span>
                <div className="flex gap-4 text-xs font-sans">
                  <span className="text-info font-medium">☁️ 云端版本 (Cloud)</span>
                  <span className="text-success font-medium">💻 本地版本 (Local)</span>
                </div>
              </div>
              <div style={{ height: "40vh" }} className="overflow-hidden">
                <DiffEditor
                  original={formatJson(file.cloud_content)}
                  modified={formatJson(file.local_content)}
                  language="json"
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
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" disabled={loading} onClick={onClose}>
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
