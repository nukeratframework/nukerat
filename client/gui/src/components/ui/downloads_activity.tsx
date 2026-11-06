// ======= download =======

export type DownloadPhase = "requesting" | "transferring";

export type DownloadStatus = "running" | "completed" | "failed" | "cancelled";

export type DownloadItem = {
  id: string;
  dest: string;
  sourcePath: string;
  fileName: string;
  phase: DownloadPhase;
  received: number;
  total: number;
  status: DownloadStatus;
  ipcActive: boolean;
  startedAt: string;
  completedAt?: string;
};

type DownloadRecord = Omit<DownloadItem, "ipcActive">;

let items: DownloadItem[] = [];
const listeners = new Set<() => void>();
let registryLoaded = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let panelSetOpen: ((open: boolean) => void) | undefined;
let pendingPanelOpen = false;
const downloadAbortById = new Map<string, AbortController>();
const downloadServerById = new Map<string, string>();

function linkDownloadAbort(parent?: AbortController): AbortController {
  const downloadCtrl = new AbortController();
  if (!parent) return downloadCtrl;
  if (parent.signal.aborted) {
    downloadCtrl.abort();
    return downloadCtrl;
  }
  parent.signal.addEventListener("abort", () => downloadCtrl.abort(), { once: true });
  return downloadCtrl;
}

export function bindDownloadsPanel(setOpen: (open: boolean) => void) {
  panelSetOpen = setOpen;
  if (pendingPanelOpen) {
    setOpen(true);
    pendingPanelOpen = false;
  }
  return () => {
    if (panelSetOpen === setOpen) panelSetOpen = undefined;
  };
}

export function openDownloadsPanel() {
  if (panelSetOpen) {
    panelSetOpen(true);
    pendingPanelOpen = false;
  } else {
    pendingPanelOpen = true;
  }
}

function emit() {
  listeners.forEach((l) => l());
  schedulePersist();
}

export function subscribeDownloads(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDownloadsSnapshot(): DownloadItem[] {
  return items;
}

function basename(path: string) {
  return path.split(/[/\\]/).filter(Boolean).pop() ?? "download";
}

const DOWNLOAD_ID_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function newId() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += DOWNLOAD_ID_CHARS[bytes[i] % DOWNLOAD_ID_CHARS.length];
  }
  return id;
}

function findById(id: string) {
  return items.find((i) => i.id === id);
}

function toRecord(item: DownloadItem): DownloadRecord {
  const { ipcActive: _, ...rest } = item;
  return rest;
}

function schedulePersist() {
  if (!window.electronAPI) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistDownloadsRegistry();
  }, 200);
}

async function persistDownloadsRegistry() {
  if (!window.electronAPI) return;
  const entries = items.map(toRecord);
  await window.electronAPI.invoke("downloads:write", { entries });
}

export async function loadDownloadsRegistry() {
  if (!window.electronAPI) return;
  if (registryLoaded) return;
  registryLoaded = true;
  const data = (await window.electronAPI.invoke("downloads:read")) as { entries?: DownloadRecord[] };
  const entries = Array.isArray(data?.entries) ? data.entries : [];
  items = entries.map((e) => ({
    ...e,
    ipcActive: false,
    sourcePath: e.sourcePath ?? e.dest,
    id: e.id ?? newId(),
    startedAt: e.startedAt ?? new Date().toISOString(),
  }));
  emit();
}

async function setElectronProgressIndeterminate() {
  if (!window.electronAPI) return;
  await window.electronAPI.invoke("window:setDownloadProgress", { mode: "indeterminate" });
}

async function setElectronProgressRatio(ratio: number) {
  if (!window.electronAPI) return;
  await window.electronAPI.invoke("window:setDownloadProgress", { progress: ratio });
}

function refreshTaskbarFromRunning() {
  const running = items.find((i) => i.status === "running");
  if (!running) {
    void setElectronProgressRatio(-1);
    return;
  }
  if (running.total <= 0) {
    void setElectronProgressIndeterminate();
    return;
  }
  void setElectronProgressRatio(Math.min(1, running.received / running.total));
}

function insertDownload(entry: DownloadItem) {
  items = [entry, ...items].slice(0, 48);
  emit();
}

function patchById(id: string, patch: Partial<DownloadItem>) {
  const item = findById(id);
  if (!item) return;
  Object.assign(item, patch);
  items = [...items];
  emit();
}

export async function syncDownloadsFromElectron() {
  if (!window.electronAPI) return;
  const paths = (await window.electronAPI.invoke("file:listActiveDownloads")) as string[];
  const active = new Set(Array.isArray(paths) ? paths : []);
  for (const item of items) {
    item.ipcActive = item.status === "running" && active.has(item.dest);
  }
  for (const dest of active) {
    const hasRunning = items.some((i) => i.dest === dest && i.status === "running");
    if (!hasRunning) {
      const now = new Date().toISOString();
      const orphan: DownloadItem = {
        id: newId(),
        dest,
        sourcePath: dest,
        fileName: basename(dest),
        phase: "transferring",
        received: 0,
        total: 0,
        status: "running",
        ipcActive: true,
        startedAt: now,
      };
      items = [orphan, ...items].slice(0, 48);
    }
  }
  items = [...items];
  emit();
}

export type DownloadProgressHandle = {
  id: string;
  signal: AbortSignal;
};

export async function beginDownloadProgress(
  fileName: string,
  dest: string,
  sourcePath: string,
  abort?: AbortController,
  server?: string,
): Promise<DownloadProgressHandle> {
  openDownloadsPanel();
  await loadDownloadsRegistry();
  const id = newId();
  const now = new Date().toISOString();
  const controller = linkDownloadAbort(abort);
  downloadAbortById.set(id, controller);
  if (server) downloadServerById.set(id, server);
  insertDownload({
    id,
    dest,
    sourcePath: sourcePath || dest,
    fileName,
    phase: "requesting",
    received: 0,
    total: 0,
    status: "running",
    ipcActive: false,
    startedAt: now,
    completedAt: undefined,
  });
  refreshTaskbarFromRunning();
  openDownloadsPanel();
  return { id, signal: controller.signal };
}

export function updateDownloadProgress(id: string, received: number, total: number) {
  const existing = findById(id);
  if (existing && existing.status !== "running") return;
  patchById(id, {
    phase: "transferring",
    received,
    total,
    status: "running",
  });
  refreshTaskbarFromRunning();
}

export function endDownloadProgress(id: string, ok: boolean, userCancel = false) {
  downloadAbortById.delete(id);
  const item = findById(id);
  if (item) {
    if (!ok && item.status === "cancelled") {
      refreshTaskbarFromRunning();
      return;
    }
    item.status = ok ? "completed" : userCancel ? "cancelled" : "failed";
    item.ipcActive = false;
    item.completedAt = new Date().toISOString();
    if (ok && item.total <= 0 && item.received > 0) item.total = item.received;
    items = [...items];
    emit();
  }
  refreshTaskbarFromRunning();
}

export function requestServerDownloadDelete(id: string) {
  const server = downloadServerById.get(id);
  if (!server) return;
  downloadServerById.delete(id);
  void import("@/api/terminal").then(({ DataFetch }) =>
    DataFetch(`download delete --id ${id}`, server, { source_terminal: "gui-downloads" }, false).catch(
      () => {},
    ),
  );
}

export async function cancelUserDownload(id: string) {
  const item = findById(id);
  const ctrl = downloadAbortById.get(id);
  downloadAbortById.delete(id);
  requestServerDownloadDelete(id);
  ctrl?.abort();
  if (item && window.electronAPI) {
    await window.electronAPI.invoke("file:downloadClose", item.dest).catch(() => {});
  }
  endDownloadProgress(id, false, true);
}

export function clearCompletedDownloads() {
  items = items.filter((i) => i.status === "running");
  emit();
}

export function removeDownloadEntry(id: string) {
  const next = items.filter((i) => i.id !== id);
  if (next.length === items.length) return;
  items = next;
  emit();
}

export function showDownloadInFolder(dest: string) {
  if (!window.electronAPI || !dest) return;
  void window.electronAPI.invoke("file:showItemInFolder", dest).catch(() => {});
}

export function deleteDownloadEntry(id: string) {
  removeDownloadEntry(id);
}

// ========================
