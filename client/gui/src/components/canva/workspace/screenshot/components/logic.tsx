import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Session } from "@/api/sessions";
import { fetchScreenshot } from "@/api/screenshot";
import { formatToastMessage } from "@/components/canva/utils/toast_rules";
import { screenshotMenuRuntimeRef } from "@/components/ui/rigth-click-menu.tsx";

function screenshotDataUrlHasBytes(dataUrl: string | null): boolean {
  if (!dataUrl?.startsWith("data:image")) return false;
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return false;
  const payload = dataUrl.slice(comma + 1).trim();
  return payload.length > 0 && payload !== "empty";
}

function saveDataUrlImage(dataUrl: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export function useScreenshot(selectedHost?: { host: Session; server: string } | null) {
  const [src, setSrc] = useState<string | null>(null);
  const srcRef = useRef<string | null>(null);
  const hostTagRef = useRef<string | undefined>(selectedHost?.host?.tag);
  srcRef.current = src;
  hostTagRef.current = selectedHost?.host?.tag;

  useEffect(() => {
    setSrc(null);
    if (!selectedHost?.host?.tag || !selectedHost.server) return;

    const ac = new AbortController();
    const { signal } = ac;

    void (async () => {
      let hash: string | null = null;
      while (!signal.aborted) {
        try {
          const data = await fetchScreenshot(selectedHost, signal, hash, !!hash);
          if (data.status === "failure") {
            toast.error(formatToastMessage(data.message ?? "Screenshot failed"));
            continue;
          }
          hash = data.hash ?? hash;
          if (!data.content || data.content === "empty") {
            setSrc(null);
          } else {
            setSrc(`data:image/jpeg;base64,${data.content}`);
          }
        } catch (err) {
          if (signal.aborted || (err instanceof Error && err.name === "AbortError")) return;
          toast.error(formatToastMessage(err instanceof Error ? err.message : "Unknown error"));
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    })();

    return () => ac.abort();
  }, [selectedHost]);

  const save = useCallback(() => {
    const dataUrl = srcRef.current;
    if (!screenshotDataUrlHasBytes(dataUrl)) return;
    const tag = hostTagRef.current?.trim() || "host";
    saveDataUrlImage(dataUrl!, `screenshot-${tag}-${Date.now()}.jpg`);
  }, []);

  screenshotMenuRuntimeRef.current = {
    canSave: () => screenshotDataUrlHasBytes(srcRef.current),
    save,
  };

  useEffect(() => {
    return () => {
      screenshotMenuRuntimeRef.current = null;
    };
  }, []);

  return { src };
}
