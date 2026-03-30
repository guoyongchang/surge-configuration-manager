import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmRestoreDialog({ open, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-warning" />
            <DialogTitle>{t("settings_cloudSync_restoreConfirmTitle")}</DialogTitle>
          </div>
          <DialogDescription>
            {t("settings_cloudSync_restoreConfirmDesc")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            {t("settings_actions_cancel")}
          </Button>
          <Button onClick={onConfirm} variant="destructive">
            {t("settings_cloudSync_restoreConfirmBtn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
