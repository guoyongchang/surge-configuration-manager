import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DiffEditor } from "@monaco-editor/react";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localContent: string;
  cloudContent: string;
  onKeepLocal: () => Promise<void>;
  onKeepCloud: () => Promise<void>;
}

export function CloudSyncConflictDialog({
  open,
  onOpenChange,
  localContent,
  cloudContent,
  onKeepLocal,
  onKeepCloud,
}: Props) {
  const { t } = useTranslation();
  const [resolving, setResolving] = useState(false);

  const handle = async (fn: () => Promise<void>) => {
    setResolving(true);
    try {
      await fn();
      onOpenChange(false);
    } catch (e) {
      console.error("Conflict resolution failed:", e);
    } finally {
      setResolving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: "90vw" }} className="!w-[90vw] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>{t("settings_cloudSync_conflictTitle")}</DialogTitle>
          <p className="text-xs text-muted-foreground">{t("settings_cloudSync_conflictHint")}</p>
        </DialogHeader>

        <div style={{ height: "55vh" }} className="border border-border rounded-lg overflow-hidden">
          <DiffEditor
            original={cloudContent}
            modified={localContent}
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

        <div className="flex justify-between mt-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={resolving}
              onClick={() => handle(onKeepCloud)}
            >
              {resolving ? <Loader2 size={14} className="animate-spin" /> : null}
              {t("settings_cloudSync_keepCloud")}
            </Button>
            <Button
              variant="outline"
              disabled={resolving}
              onClick={() => handle(onKeepLocal)}
            >
              {resolving ? <Loader2 size={14} className="animate-spin" /> : null}
              {t("settings_cloudSync_keepLocal")}
            </Button>
          </div>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={resolving}
          >
            {t("settings_actions_cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
