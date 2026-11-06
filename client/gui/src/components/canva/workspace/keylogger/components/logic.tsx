import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { keyloggerMenuRuntimeRef } from "@/components/ui/rigth-click-menu.tsx";
import type { Session } from "@/api/sessions";
import { deleteKeylogger, fetchKeylogger, type KeyloggerItem } from "@/api/keylogger";
import type { FetchToastResponse } from "@/components/canva/utils/toast_rules";
import { tryConfirmDialogEnter } from "@/components/canva/utils/confirm-dialog-keydown";
import { formatUtcDateOnly, utcTableColumnTitle } from "@/components/canva/utils/utc-date";

export const TABLE_COLUMNS = [utcTableColumnTitle("Date"), "Server", "Host Tag", "Content"] as const;

export const tableCellTruncate =
  "inline-block max-w-[30ch] truncate align-middle";

export type KeyloggerEntry = {
  key: string;
  tag: string;
  hostTag: string;
  date: string;
  host: string;
  content: string;
  server: string;
};

const pageSize = 50;
const ok = (s?: string) => s === "success" || s === "successfull";
const pad = (n: number) => String(n).padStart(2, "0");

export const formatPickerDate = (date: Date) => {
  const base = `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${String(date.getFullYear()).slice(-2)}`;
  return base;
};

const normalize = (raw: KeyloggerItem): KeyloggerEntry => {
  const server = String(raw.server ?? "").trim();
  const tag = String(raw.tag ?? "");
  const hostTag = String(raw.hostTag ?? "").trim();
  return {
    key: `${server}|${tag}`,
    tag,
    hostTag,
    date: formatUtcDateOnly(String(raw.hora ?? "")),
    host: String(raw.host ?? ""),
    content: String(raw.content ?? ""),
    server,
  };
};

export function useKeyloggerPanel() {
  const [entries, setEntries] = useState<KeyloggerEntry[]>([]);
  const [hosts, setHosts] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [hostTag, setHostTag] = useState("all");
  const [hostId, setHostId] = useState("");
  const [hostOpen, setHostOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<FetchToastResponse | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [rightWidth, setRightWidth] = useState(440);
  const [isDragging, setIsDragging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmMode, setDeleteConfirmMode] = useState<"selected" | "all">("selected");

  const hostGroups = hosts.reduce<Record<string, Session[]>>((g, h) => {
    (g[h._server ?? "Unknown"] ??= []).push(h);
    return g;
  }, {});

  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  const visible = entries.slice((page - 1) * pageSize, page * pageSize);
  const selected = entries.find((e) => e.key === selectedKey) ?? null;
  const uniqueEntryCount = useMemo(() => {
    const seen = new Set<string>();
    for (const e of entries) {
      if (e.server.trim() && e.tag) seen.add(e.key);
    }
    return seen.size;
  }, [entries]);

  const load = useCallback(async () => {
    setLoading(true);
    const q = search.trim();
    const res = await fetchKeylogger({
      ...(q && { search: q }),
      hostTag,
      page: 1,
      pageSize: 500,
    });
    setResponse(res);
    if (ok(res.status)) {
      setEntries(Array.isArray(res.content) ? res.content.map(normalize) : []);
      if (Array.isArray(res.hosts)) setHosts(res.hosts);
    } else setEntries([]);
    setLoading(false);
  }, [search, hostTag]);

  useEffect(() => {
    const t = setTimeout(load, search ? 450 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    if (panelOpen && !selected) setPanelOpen(false);
  }, [panelOpen, selected]);

  const resetPage = () => setPage(1);

  const selectedRef = useRef(selected);
  const deletingRef = useRef(deleting);
  const searchRef = useRef(search);
  const entriesRef = useRef(entries);
  selectedRef.current = selected;
  deletingRef.current = deleting;
  searchRef.current = search;
  entriesRef.current = entries;

  const viewAction = useCallback(() => {
    if (selectedRef.current) setPanelOpen(true);
  }, []);

  const deleteSelected = useCallback(async () => {
    const sel = selectedRef.current;
    if (!sel?.server.trim()) {
      setResponse({ status: "failure", message: "No server associated with this entry" });
      return;
    }
    setDeleting(true);
    const res = await deleteKeylogger(sel.tag, sel.server);
    setResponse(res);
    setDeleting(false);
    if (ok(res.status)) {
      setPanelOpen(false);
      setSelectedKey(null);
      load();
    }
  }, [load]);

  const handleOpenDeleteConfirm = useCallback(() => {
    if (!selectedRef.current) return;
    setDeleteConfirmMode("selected");
    setPanelOpen(false);
    setShowDeleteConfirm(true);
  }, []);

  const handleOpenDeleteAllConfirm = useCallback(() => {
    if (!entriesRef.current.length || deletingRef.current) return;
    setDeleteConfirmMode("all");
    setPanelOpen(false);
    setShowDeleteConfirm(true);
  }, []);

  const handleRemoveAll = useCallback(async () => {
    const list = entriesRef.current;
    if (!list.length || deletingRef.current) return;
    const seen = new Set<string>();
    const targets: KeyloggerEntry[] = [];
    for (const e of list) {
      if (!e.server.trim() || !e.tag || seen.has(e.key)) continue;
      seen.add(e.key);
      targets.push(e);
    }
    if (!targets.length) return;
    setDeleting(true);
    let failed = 0;
    let lastRes: FetchToastResponse | null = null;
    for (const e of targets) {
      const res = await deleteKeylogger(e.tag, e.server);
      lastRes = res;
      if (!ok(res.status)) failed += 1;
    }
    setDeleting(false);
    setSelectedKey(null);
    setPanelOpen(false);
    if (lastRes) setResponse(lastRes);
    load();
    if (failed > 0) {
      setResponse({
        status: "failure",
        message: `Failed to remove ${failed} entr${failed === 1 ? "y" : "ies"}`,
      });
    }
  }, [load]);

  const handleConfirmRemove = useCallback(async () => {
    if (deleteConfirmMode === "all") {
      setShowDeleteConfirm(false);
      await handleRemoveAll();
      return;
    }
    setShowDeleteConfirm(false);
    await deleteSelected();
  }, [deleteConfirmMode, deleteSelected, handleRemoveAll]);

  useEffect(() => {
    if (!showDeleteConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setShowDeleteConfirm(false);
        return;
      }
      tryConfirmDialogEnter(
        e,
        () => void handleConfirmRemove(),
        () => deletingRef.current,
      );
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [showDeleteConfirm, handleConfirmRemove]);

  keyloggerMenuRuntimeRef.current = {
    getSearch: () => searchRef.current,
    setSearch: (v) => {
      setSearch(v);
      resetPage();
    },
    canUseSelection: () => selectedRef.current != null,
    isDeleting: () => deletingRef.current,
    view: viewAction,
    refresh: load,
    removeSelected: handleOpenDeleteConfirm,
    canRemoveSelected: () => selectedRef.current != null,
    removeAll: handleOpenDeleteAllConfirm,
    canRemoveAll: () => entriesRef.current.length > 0 && !deletingRef.current,
  };

  useEffect(() => {
    return () => {
      keyloggerMenuRuntimeRef.current = null;
    };
  }, []);

  return {
    loading,
    search,
    hostGroups,
    hostOpen,
    hostId,
    selectedHost: hosts.find((h) => String(h.id) === hostId),
    visible,
    page,
    pageCount,
    total: entries.length,
    response,
    selected,
    selectedKey,
    panelOpen,
    panelStyle: (panelOpen
      ? { "--panel-width": `${rightWidth}px`, ...(isDragging && { transition: "none" }) }
      : {}) as CSSProperties,
    deleting,
    showDeleteConfirm,
    deleteConfirmMode,
    entryCount: uniqueEntryCount,
    setShowDeleteConfirm,
    handleOpenDeleteConfirm,
    handleConfirmRemove,
    setSearch: (v: string) => {
      setSearch(v);
      resetPage();
    },
    setHostOpen,
    clearHostFilter: () => {
      setHostId("");
      setHostTag("all");
      setHostOpen(false);
      resetPage();
    },
    selectHost: (host: Session) => {
      const id = String(host.id);
      if (hostId === id) {
        setHostId("");
        setHostTag("all");
      } else {
        setHostId(id);
        setHostTag(host.tag || "all");
      }
      setHostOpen(false);
      resetPage();
    },
    setPage,
    setPanelOpen,
    refresh: load,
    handleRowClick: (key: string) => setSelectedKey(key),
    handleListMouseDown: (e: ReactMouseEvent) =>
      listRowMouseDown(e, () => setSelectedKey(null)),
    handleRowDoubleClick: (key: string) => {
      setSelectedKey(key);
      setPanelOpen(true);
    },
    view: () => selected && setPanelOpen(true),
    remove: handleOpenDeleteConfirm,
    resize: (e: ReactMouseEvent) => {
      e.preventDefault();
      const x0 = e.clientX;
      const w0 = rightWidth;
      setIsDragging(true);
      const move = (ev: globalThis.MouseEvent) =>
        setRightWidth(Math.max(280, Math.min(800, w0 + x0 - ev.clientX)));
      const up = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    },
  };
}
