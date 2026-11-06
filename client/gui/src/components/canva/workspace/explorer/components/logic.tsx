import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DataFetch } from "@/api/folders";
import type { Session } from "@/api/sessions";
import { explorerMenuRuntimeRef } from "@/components/ui/rigth-click-menu.tsx";
import { utcTableColumnTitle } from "@/components/canva/utils/utc-date";

// types -----------------------------------------------------------------------

export type ViewMode = "grid" | "list";

export interface FileContentData {
  content: string;
  fileName: string;
  contentB64: string;
  oversizedOnly?: boolean;
}

// path ------------------------------------------------------------------------

export function buildPathString(path: string[]): string | undefined {
  if (!path.length) return undefined;
  if (/^[A-Za-z]:$/.test(path[0])) return path.join("\\");
  return `/${path.join("/")}`;
}

export function formatPathDisplay(path: string[]): string {
  if (!path.length) return "/";
  if (/^[A-Za-z]:$/.test(path[0])) return path.join("\\");
  return `/${path.join("/")}`;
}

// tree ------------------------------------------------------------------------

export function isFile(node: unknown): boolean {
  return (node as { type?: string })?.type === "file";
}

export function getChildren(node: unknown): [string, unknown][] {
  if (!node || typeof node !== "object") return [];
  return Object.entries(node).filter(
    ([k, v]) => k !== "expanded" && typeof v === "object" && v !== null
  ) as [string, unknown][];
}

export function getNodeAtPath(tree: unknown[], path: string[]): unknown | null {
  if (!tree.length) return null;
  let node: unknown = tree[0];
  for (const segment of path) {
    if (!node || typeof node !== "object" || (node as Record<string, unknown>)[segment] === undefined) {
      return null;
    }
    node = (node as Record<string, unknown>)[segment];
  }
  return node;
}

export function filterTree(node: unknown, query: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, val] of getChildren(node)) {
    if (name.toLowerCase().includes(query.toLowerCase())) {
      result[name] = val;
    } else if (!isFile(val)) {
      const filtered = filterTree(val, query);
      if (Object.keys(filtered).length > 0) result[name] = filtered;
    }
  }
  return result;
}

export function allFolderKeys(node: unknown, prefix: string[] = []): string[] {
  const keys: string[] = [];
  for (const [name, val] of getChildren(node)) {
    if (!isFile(val)) {
      const p = [...prefix, name];
      keys.push(p.join("/"));
      keys.push(...allFolderKeys(val, p));
    }
  }
  return keys;
}

export function getItemSubtitle(name: string, nodeVal: unknown, fileNode: boolean): string {
  const raw = (nodeVal as { size?: unknown })?.size ?? "0";
  if (fileNode) return String(raw);
  const folderCount = Number.parseInt(String(raw), 10);
  return Number.isNaN(folderCount) ? `${raw} items` : `${folderCount} ${folderCount === 1 ? "item" : "items"}`;
}

export const EXPLORER_FILE_MAX_BYTES = 25 * 1024 * 1024;

const LISTED_SIZE_UNITS: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
};

export function parseListedFileSize(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const match = /^([\d.]+)\s*([KMGT]?B)$/i.exec(text);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value)) return null;
  const unit = match[2].toUpperCase() as keyof typeof LISTED_SIZE_UNITS;
  const multiplier = LISTED_SIZE_UNITS[unit];
  if (!multiplier) return null;
  return Math.round(value * multiplier);
}

export function getListedFileSizeBytes(explorerTree: unknown[], filePath: string[]): number | null {
  if (filePath.length === 0) return null;
  const parentPath = filePath.slice(0, -1);
  const fileName = filePath[filePath.length - 1];
  const parent = getNodeAtPath(explorerTree, parentPath);
  if (!parent || typeof parent !== "object") return null;
  const fileNode = (parent as Record<string, unknown>)[fileName];
  if (!fileNode || !isFile(fileNode)) return null;
  return parseListedFileSize((fileNode as { size?: unknown }).size);
}

// base64 / download -----------------------------------------------------------

export function getBase64Bytes(value: string): Uint8Array | null {
  if (!value || !value.trim()) return null;
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  } catch {
    return null;
  }
}

export function hasValidBase64Content(value: string): boolean {
  return getBase64Bytes(value) !== null;
}

export function isImage(contentB64: string): string | null {
  const bytes = getBase64Bytes(contentB64);
  if (!bytes || bytes.length < 3) return null;

  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return "image/bmp";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
    return "image/x-icon";
  }

  return null;
}

export function downloadBase64File(
  contentB64: string,
  fileName: string,
  mimeType = "application/octet-stream"
): boolean {
  const bytes = getBase64Bytes(contentB64);
  if (!bytes) return false;

  const safeName = fileName?.trim() || "download";
  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return true;
}

// resize ----------------------------------------------------------------------

export function useHorizontalResize(
  initialWidth = 220,
  min = 120,
  minRemaining = 120,
  maxWidth = Number.POSITIVE_INFINITY
) {
  const [width, setWidth] = useState(initialWidth);

  const startResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const next = startWidth + (moveEvent.clientX - startX);
      const cap = Math.min(window.innerWidth - minRemaining, maxWidth);
      setWidth(Math.max(min, Math.min(cap, next)));
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return { width, startResize };
}

// truncated names -------------------------------------------------------------

export function useTruncatedNames(deps: unknown[]) {
  const [truncatedNames, setTruncatedNames] = useState<Record<string, boolean>>({});
  const nameRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  const updateTruncation = (key: string) => {
    const el = nameRefs.current[key];
    if (!el) return;
    const truncated = el.scrollWidth > el.clientWidth;
    setTruncatedNames((prev) => (prev[key] === truncated ? prev : { ...prev, [key]: truncated }));
  };

  const attachNameRef = (key: string) => (el: HTMLSpanElement | null) => {
    nameRefs.current[key] = el;
    if (el) updateTruncation(key);
  };

  useEffect(() => {
    const recalc = () => Object.keys(nameRefs.current).forEach(updateTruncation);
    const id = window.setTimeout(recalc, 0);
    window.addEventListener("resize", recalc);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", recalc);
    };
  }, deps);

  return { attachNameRef, isTruncated: (key: string) => !!truncatedNames[key] };
}

// content preview -------------------------------------------------------------

export const CHUNK_MODE_THRESHOLD = 10 * 1024 * 1024;
export const CHUNK_SIZE = 2048;

export function useContentPreview(content: string, fileKey?: string) {
  const isLargeContent = content.length >= EXPLORER_FILE_MAX_BYTES;
  const useChunkMode = content.length >= CHUNK_MODE_THRESHOLD && !isLargeContent;

  const lines = useMemo(() => {
    if (useChunkMode) return [] as string[];
    return content.split(/\r?\n/);
  }, [content, useChunkMode]);

  const chunkCount = useChunkMode ? Math.ceil(content.length / CHUNK_SIZE) : 0;

  return {
    isLargeContent,
    useChunkMode,
    lines,
    chunkCount,
  };
}

// left tree -------------------------------------------------------------------

export function useLeftSideTree(explorerTree: unknown[], currentPath: string[]) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!currentPath.length) return;
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      for (let i = 1; i < currentPath.length; i++) {
        next.add(currentPath.slice(0, i).join("/"));
      }
      return next;
    });
  }, [currentPath]);

  const toggle = useCallback((key: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const rootNode = (explorerTree[0] ?? {}) as Record<string, unknown>;
  const displayNode = useMemo(
    () => (search ? filterTree(rootNode, search) : rootNode),
    [rootNode, search]
  );
  const displayExpanded = useMemo(
    () => (search ? new Set(allFolderKeys(displayNode)) : expandedPaths),
    [search, displayNode, expandedPaths]
  );
  const rootEntries = useMemo(() => getChildren(displayNode), [displayNode]);

  return { search, setSearch, displayExpanded, rootEntries, toggle };
}

export function useTreeNodeClick(
  isFileNode: boolean,
  path: string[],
  pathKey: string,
  isOpen: boolean,
  onExpand: (path: string[]) => void,
  onToggle: (key: string) => void,
  onFileClick: (path: string[]) => void
) {
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
  };

  const handleClick = () => {
    if (isFileNode) {
      onFileClick(path);
      return;
    }
    clearTimer();
    clickTimer.current = setTimeout(() => onExpand(path), 200);
  };

  const handleDoubleClick = () => {
    clearTimer();
    if (!isFileNode) {
      onToggle(pathKey);
      onExpand(path);
    }
  };

  const handleChevronClick = () => {
    clearTimer();
    if (isFileNode) return;
    onToggle(pathKey);
    if (!isOpen) onExpand(path);
  };

  return { handleClick, handleDoubleClick, handleChevronClick };
}

// right panel -----------------------------------------------------------------

export function useRightSidePath(currentPath: string[], onPathSubmit: (path: string) => Promise<boolean>) {
  const pathDisplay = formatPathDisplay(currentPath);
  const [inputValue, setInputValue] = useState(pathDisplay);

  useEffect(() => {
    setInputValue(pathDisplay);
  }, [pathDisplay]);

  const handlePathSubmit = useCallback(async () => {
    await onPathSubmit(inputValue);
  }, [inputValue, onPathSubmit]);

  return { inputValue, setInputValue, handlePathSubmit };
}

export const EXPLORER_MODIFIED_COLUMN = utcTableColumnTitle("Modified");

export const explorerTableColumns = ["Name", "Type", "Size", EXPLORER_MODIFIED_COLUMN];

export type ExplorerColumn = "Name" | "Type" | "Size" | typeof EXPLORER_MODIFIED_COLUMN;
export type ExplorerListItem = [string, unknown];

/** Natural name order (Explorer uses StrCmpLogicalW). */
function compareExplorerNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function isFolderEntry(item: ExplorerListItem): boolean {
  return !isFile(item[1]);
}

function fileExtensionSortKey(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0 || dot === fileName.length - 1) return "";
  return fileName.slice(dot + 1);
}

function folderSizeSortValue(nodeVal: unknown): number {
  const raw = (nodeVal as { size?: unknown })?.size;
  const n = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function fileSizeSortValue(nodeVal: unknown): number {
  return parseListedFileSize((nodeVal as { size?: unknown })?.size) ?? -1;
}

function modifiedSortValue(nodeVal: unknown, missingSentinel: number): number {
  const raw = String((nodeVal as { modified?: string })?.modified ?? "").trim();
  if (!raw || raw.toLowerCase() === "unknown") return missingSentinel;
  const slice = raw.length >= 10 ? raw.slice(0, 10) : raw;
  const t = Date.parse(slice);
  return Number.isFinite(t) ? t : missingSentinel;
}

function compareExplorerItems(
  a: ExplorerListItem,
  b: ExplorerListItem,
  column: ExplorerColumn,
  ascending: boolean
): number {
  const dir = ascending ? 1 : -1;
  const folderA = isFolderEntry(a);
  const folderB = isFolderEntry(b);

  if (column !== EXPLORER_MODIFIED_COLUMN && folderA !== folderB) {
    return folderA ? -1 : 1;
  }

  let cmp = 0;
  switch (column) {
    case "Name":
      cmp = compareExplorerNames(a[0], b[0]);
      break;
    case "Type": {
      const extA = fileExtensionSortKey(a[0]);
      const extB = fileExtensionSortKey(b[0]);
      cmp = compareExplorerNames(extA, extB);
      if (cmp === 0) cmp = compareExplorerNames(a[0], b[0]);
      break;
    }
    case "Size": {
      const sx = folderA ? folderSizeSortValue(a[1]) : fileSizeSortValue(a[1]);
      const sy = folderB ? folderSizeSortValue(b[1]) : fileSizeSortValue(b[1]);
      if (sx !== sy) cmp = sx - sy;
      else cmp = compareExplorerNames(a[0], b[0]);
      break;
    }
    case EXPLORER_MODIFIED_COLUMN: {
      const missing = ascending ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      const dx = modifiedSortValue(a[1], missing);
      const dy = modifiedSortValue(b[1], missing);
      if (dx !== dy) cmp = dx - dy;
      else cmp = compareExplorerNames(a[0], b[0]);
      break;
    }
  }

  if (cmp !== 0) return cmp * dir;
  return compareExplorerNames(a[0], b[0]) * dir;
}

export function sortExplorerItems(
  items: ExplorerListItem[],
  column: ExplorerColumn,
  ascending: boolean
): ExplorerListItem[] {
  return [...items].sort((a, b) => compareExplorerItems(a, b, column, ascending));
}

export function useRightSideItems(explorerTree: unknown[], currentPath: string[]) {
  const [sortCol, setSortCol] = useState<ExplorerColumn | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const items = useMemo(() => {
    const node = getNodeAtPath(explorerTree, currentPath);
    let lista: ExplorerListItem[] = node ? getChildren(node) : [];
    if (sortCol) {
      lista = sortExplorerItems(lista, sortCol, sortAsc);
    }
    return lista;
  }, [explorerTree, currentPath, sortCol, sortAsc]);

  const handleSortColumn = (col: ExplorerColumn) => {
    if (sortCol !== col) {
      setSortCol(col);
      setSortAsc(true);
      return;
    }
    if (sortAsc) {
      setSortAsc(false);
      return;
    }
    setSortCol(null);
    setSortAsc(true);
  };

  return { items, sortCol, sortAsc, handleSortColumn };
}

// explorer window --------------------------------------------------------------

function showFetchFailureToast(res: unknown, fallbackMessage: string): boolean {
  const r = res as { request?: string; status?: string; message?: string; error?: string };
  const isRequestError = r?.request === "folders";
  const isFailure =
    isRequestError ||
    r?.status === "failure" ||
    r?.status === "error" ||
    r?.status === "ERR_conn";
  if (!isFailure) return false;
  toast.error(r?.message ?? r?.error ?? fallbackMessage);
  return true;
}

export function useExplorerWindow(
  selectedHost?: { host: Session; server: string } | null,
  leftSideMaxWidth = Number.POSITIVE_INFINITY
) {
  const hostUnavailable = !selectedHost;
  const [explorerTree, setExplorerTree] = useState<unknown[]>([]);
  const { width: leftWidth, startResize } = useHorizontalResize(220, 120, 120, leftSideMaxWidth);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [history, setHistory] = useState<string[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [autoRefresh, setautoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fileContent, setFileContent] = useState<FileContentData | null>(null);

  const fetchExplorer = useCallback(
    async (path: string[] = []) => {
      if (!selectedHost) return;
      setLoading(true);
      const res = await DataFetch(
        selectedHost.server,
        selectedHost.host.tag,
        buildPathString(path),
        false,
        autoRefresh
      );
      setLoading(false);
      if (showFetchFailureToast(res, "Could not list folder content.")) return;
      const r = res as { status?: string; folders?: unknown[] };
      if (r?.status === "success" && Array.isArray(r.folders)) {
        setExplorerTree(r.folders);
      }
    },
    [selectedHost, autoRefresh]
  );

  useEffect(() => {
    setExplorerTree([]);
    setCurrentPath([]);
    setHistory([[]]);
    setHistoryIndex(0);
    setFileContent(null);
    if (selectedHost) fetchExplorer();
  }, [selectedHost]);

  const navigateTo = useCallback(
    (path: string[]) => {
      setFileContent(null);
      setCurrentPath(path);
      const base = history.slice(0, historyIndex + 1);
      setHistory([...base, path]);
      setHistoryIndex(base.length);
    },
    [history, historyIndex]
  );

  const onExpand = useCallback(
    async (path: string[]) => {
      await fetchExplorer(path);
      navigateTo(path);
    },
    [fetchExplorer, navigateTo]
  );

  const onFileClick = useCallback(
    async (path: string[]) => {
      if (!selectedHost) return;
      const listedSize = getListedFileSizeBytes(explorerTree, path);
      if (listedSize !== null && listedSize > EXPLORER_FILE_MAX_BYTES) {
        setFileContent({
          content: "",
          fileName: path[path.length - 1] ?? "file",
          contentB64: "",
          oversizedOnly: true,
        });
        return;
      }
      setLoading(true);
      setFileContent(null);
      const res = await DataFetch(
        selectedHost.server,
        selectedHost.host.tag,
        buildPathString(path),
        true
      );
      setLoading(false);
      if (showFetchFailureToast(res, "Could not open file.")) return;

      const r = res as {
        file_content?: string;
        fileName?: string;
        file_content_b64?: string;
      };
      const fallbackName = path[path.length - 1] ?? "download";
      const decodedContent =
        typeof r?.file_content === "string" ? r.file_content : "Could not retrieve file content.";
      setFileContent({
        content: decodedContent,
        fileName: typeof r?.fileName === "string" && r.fileName.trim() ? r.fileName : fallbackName,
        contentB64: typeof r?.file_content_b64 === "string" ? r.file_content_b64 : "",
      });
    },
    [selectedHost, explorerTree]
  );

  const onPathSubmit = useCallback(
    async (rawPath: string): Promise<boolean> => {
      if (!selectedHost) return false;
      const trimmedPath = rawPath.trim();
      const pathValue = trimmedPath || undefined;
      const nextPath = trimmedPath.split(/[/\\]/).filter(Boolean);

      setLoading(true);
      const res = await DataFetch(
        selectedHost.server,
        selectedHost.host.tag,
        pathValue,
        false,
        autoRefresh
      );
      setLoading(false);

      if (showFetchFailureToast(res, "Could not access the requested path.")) return false;

      const r = res as { status?: string; folders?: unknown[] };
      if (r?.status === "success" && Array.isArray(r.folders)) {
        setExplorerTree(r.folders);
        navigateTo(nextPath);
        return true;
      }
      return false;
    },
    [selectedHost, autoRefresh, navigateTo]
  );

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const idx = historyIndex - 1;
      setFileContent(null);
      setHistoryIndex(idx);
      setCurrentPath(history[idx]);
    }
  }, [history, historyIndex]);

  const goForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const idx = historyIndex + 1;
      setFileContent(null);
      setHistoryIndex(idx);
      setCurrentPath(history[idx]);
    }
  }, [history, historyIndex]);

  const canDownloadFile = !!fileContent && hasValidBase64Content(fileContent.contentB64);

  const onDownloadFile = useCallback(() => {
    if (!fileContent) return;
    downloadBase64File(fileContent.contentB64, fileContent.fileName);
  }, [fileContent]);

  const pathDisplay = formatPathDisplay(currentPath);
  const [pathInputValue, setPathInputValue] = useState(pathDisplay);
  useEffect(() => {
    setPathInputValue(pathDisplay);
  }, [pathDisplay]);

  const handlePathSubmitAction = useCallback(async () => {
    await onPathSubmit(pathInputValue);
  }, [pathInputValue, onPathSubmit]);

  const explorerTreeRef = useRef(explorerTree);
  const currentPathRef = useRef(currentPath);
  const loadingRef = useRef(loading);
  const hostUnavailableRef = useRef(hostUnavailable);
  const pathInputRef = useRef(pathInputValue);
  const canBackRef = useRef(historyIndex > 0);
  const canForwardRef = useRef(historyIndex < history.length - 1);
  const canDownloadRef = useRef(canDownloadFile);
  explorerTreeRef.current = explorerTree;
  currentPathRef.current = currentPath;
  loadingRef.current = loading;
  hostUnavailableRef.current = hostUnavailable;
  pathInputRef.current = pathInputValue;
  canBackRef.current = historyIndex > 0;
  canForwardRef.current = historyIndex < history.length - 1;
  canDownloadRef.current = canDownloadFile;

  const controlsDisabled = () => loadingRef.current || hostUnavailableRef.current;

  const copyExplorerContext = useCallback(() => {
    const node = getNodeAtPath(explorerTreeRef.current, currentPathRef.current);
    if (!node) return;
    const payload = getChildren(node).map(([name, nodeVal]) => {
      const nv = nodeVal as { type?: string; size?: unknown };
      return {
        name,
        type: nv.type ?? (isFile(nodeVal) ? "file" : "folder"),
        size: nv.size,
      };
    });
    void navigator.clipboard.writeText(JSON.stringify({ folders: payload }));
  }, []);

  explorerMenuRuntimeRef.current = {
    getPathInput: () => pathInputRef.current,
    setPathInput: setPathInputValue,
    controlsDisabled,
    canBack: () => canBackRef.current,
    canForward: () => canForwardRef.current,
    canDownload: () => canDownloadRef.current,
    canCopyContext: () => {
      const node = getNodeAtPath(explorerTreeRef.current, currentPathRef.current);
      return Boolean(node && getChildren(node).length > 0);
    },
    goBack,
    goForward,
    refresh: () => fetchExplorer(currentPathRef.current),
    download: onDownloadFile,
    setGridView: () => setViewMode("grid"),
    setListView: () => setViewMode("list"),
    copyContext: copyExplorerContext,
  };

  useEffect(() => {
    return () => {
      explorerMenuRuntimeRef.current = null;
    };
  }, []);

  return {
    hostUnavailable,
    explorerTree,
    leftWidth,
    startResize,
    currentPath,
    viewMode,
    loading,
    fileContent,
    autoRefresh,
    setautoRefresh,
    setViewMode,
    onExpand,
    onFileClick,
    onPathSubmit,
    goBack,
    goForward,
    canBack: historyIndex > 0,
    canForward: historyIndex < history.length - 1,
    canDownloadFile,
    onDownloadFile,
    fetchExplorer,
    setLoading,
    pathInputValue,
    setPathInputValue,
    handlePathSubmitAction,
    clearFileContent: () => setFileContent(null),
  };
}
