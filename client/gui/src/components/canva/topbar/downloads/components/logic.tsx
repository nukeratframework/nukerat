import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  bindDownloadsPanel,
  getDownloadsSnapshot,
  loadDownloadsRegistry,
  subscribeDownloads,
  syncDownloadsFromElectron,
  type DownloadItem,
} from "@/components/ui/downloads_activity";

export function formatBytesCompact(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${Math.round(n)} B`;
}

export function useDownloadsPanel() {
  const [open, setOpen] = useState(false);
  const items = useSyncExternalStore(subscribeDownloads, getDownloadsSnapshot, getDownloadsSnapshot);
  const running = items.filter((i) => i.status === "running");
  const history = items.filter((i) => i.status !== "running");

  useEffect(() => {
    void loadDownloadsRegistry();
  }, []);

  useEffect(() => bindDownloadsPanel(setOpen), []);

  const prevRunningRef = useRef(0);
  useEffect(() => {
    if (running.length > prevRunningRef.current) {
      setOpen(true);
    }
    prevRunningRef.current = running.length;
  }, [running.length]);

  useEffect(() => {
    if (!open) return;
    void syncDownloadsFromElectron();
    const id = window.setInterval(() => void syncDownloadsFromElectron(), 800);
    return () => window.clearInterval(id);
  }, [open]);

  return {
    open,
    setOpen,
    items,
    running,
    history,
  };
}

export type { DownloadItem };
