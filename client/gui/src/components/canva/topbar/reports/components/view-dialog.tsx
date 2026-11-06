import { useEffect, useRef } from "react";
import { RefreshCw, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
} from "@/components/ui/dialog";
import { topbarFloatEscapeBlockRef } from "@/components/canva/shortcuts";

interface ReportViewDialogProps {
  open: boolean;
  loading: boolean;
  title: string;
  html: string | null;
  onOpenChange: (open: boolean) => void;
}

const ReportViewDialog = ({ open, loading, title, html, onOpenChange }: ReportViewDialogProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const htmlPreviewActive = open && !loading && html != null;

  useEffect(() => {
    if (!htmlPreviewActive) return;

    topbarFloatEscapeBlockRef.current = true;

    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onOpenChange(false);
    };

    document.addEventListener("keydown", onEscape, true);

    let unbindIframe: (() => void) | undefined;
    const bindIframe = () => {
      unbindIframe?.();
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      doc.addEventListener("keydown", onEscape, true);
      unbindIframe = () => doc.removeEventListener("keydown", onEscape, true);
    };

    bindIframe();
    const iframe = iframeRef.current;
    iframe?.addEventListener("load", bindIframe);

    return () => {
      document.removeEventListener("keydown", onEscape, true);
      iframe?.removeEventListener("load", bindIframe);
      unbindIframe?.();
      topbarFloatEscapeBlockRef.current = false;
    };
  }, [htmlPreviewActive, onOpenChange]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onOpenChange(false);
      }}
    >
      <DialogContent
        className="flex max-h-[92vh] w-[min(96vw,960px)] max-w-[min(96vw,960px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,960px)]"
        showCloseButton={false}
      >
        <div style={{ padding: "18px" }} className="relative flex items-center px-4 py-2.5 !border-b-0">
          <DialogClose className="absolute top-1.5 right-2 rounded p-0.5 text-[#6b6b6b] transition-colors hover:text-[#d4d4d4]">
            <X size={20} />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        <div className="min-h-[70vh] flex-1 overflow-hidden bg-[#e7e7e7]">
          {loading ? (
            <div className="flex h-[70vh] items-center justify-center text-[#666]">
              <RefreshCw size={16} className="mr-2 animate-spin" />
              Loading report...
            </div>
          ) : html ? (
            <iframe
              ref={iframeRef}
              srcDoc={html}
              title={title || "Report preview"}
              className="h-[70vh] w-full border-0"
              sandbox=""
            />
          ) : (
            <div className="flex h-[70vh] items-center justify-center text-[#666]">No preview available</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportViewDialog;
