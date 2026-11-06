import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sessionsMenuRuntimeRef } from "@/components/ui/rigth-click-menu.tsx";
import { toast } from "sonner";
import { DeleteSession, type Session } from "@/api/sessions";
import { DataFetch } from "@/api/sessions_lp";
import { kill_session } from "@/components/canva/workspace/sessions/components/macro";
import { tryConfirmDialogEnter } from "@/components/canva/utils/confirm-dialog-keydown";
import { formatToastMessage } from "@/components/canva/utils/toast_rules";
import { listRowMouseDown } from "@/components/canva/utils/list-row-selection";
import { formatUtcDateOnly, utcTableColumnTitle } from "@/components/canva/utils/utc-date";
import linuxHostRootSvg from "@/assets/icons/sessions/linux_root.svg";
import linuxHostSvg from "@/assets/icons/sessions/linux.svg";
import macHostRootSvg from "@/assets/icons/sessions/mac_root.svg";
import macHostSvg from "@/assets/icons/sessions/mac.svg";
import unknownHostRootSvg from "@/assets/icons/sessions/unknown_root.svg";
import unknownHostSvg from "@/assets/icons/sessions/unknown.svg";
import windowsHostRootSvg from "@/assets/icons/sessions/windows_root.svg";
import windowsHostSvg from "@/assets/icons/sessions/windows.svg";

const fetchToastId = "sessions-fetch-error";
const retryDelayMs = 5000;

export const sessionsBulkDeleteQuiet = { active: false };

const icons = {
  windows: { n: windowsHostSvg, r: windowsHostRootSvg },
  linux: { n: linuxHostSvg, r: linuxHostRootSvg },
  mac: { n: macHostSvg, r: macHostRootSvg },
  unknown: { n: unknownHostSvg, r: unknownHostRootSvg },
};

export const tableColumns = ["Platform", utcTableColumnTitle("Last Check"), "Tag", "Hostname", "User", "Privilege", "Internal", "External", "Listener", "PID", "Process", "Note"];

function valorDaColuna(h: Session, coluna: string): string {
  if (coluna === "Platform") return String(h.os ?? "");
  if (coluna === utcTableColumnTitle("Last Check")) return formatUtcDateOnly(h.last_activity);
  if (coluna === "Tag") return String(h.tag ?? "");
  if (coluna === "Hostname") return String(h.hostname ?? "");
  if (coluna === "User") return String(h.user ?? "");
  if (coluna === "Privilege") return String(h.privilege ?? "user");
  if (coluna === "Internal") return String(h.internal ?? h.ip ?? "");
  if (coluna === "External") return String(h.external_ip ?? "");
  if (coluna === "Listener") return String(h.listener ?? "");
  if (coluna === "PID") return String(h.pid ?? "");
  if (coluna === "Process") return formatProcess(h.process);
  if (coluna === "Note") return String(h.notes ?? "");
  return "";
}

export function ordenarSessions(lista: Session[], coluna: string, az: boolean): Session[] {
  const copia = lista.slice();
  for (let i = 0; i < copia.length; i++) {
    for (let j = i + 1; j < copia.length; j++) {
      const a = valorDaColuna(copia[i], coluna).toLowerCase();
      const b = valorDaColuna(copia[j], coluna).toLowerCase();
      let trocar = false;
      if (az) {
        if (a > b) trocar = true;
      } else if (a < b) {
        trocar = true;
      }
      if (trocar) {
        const tmp = copia[i];
        copia[i] = copia[j];
        copia[j] = tmp;
      }
    }
  }
  return copia;
}

export const formatDate = (raw?: string | null) => {
  if (!raw) return "-";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(2);
  return `${hh}:${mm} ${dd}/${mo}/${yy}`;
};

export const sessionIcon = (h: Session) => {
  const os = (h.os ?? "").toLowerCase();
  let f: keyof typeof icons = "unknown";
  if (/\b(win|windows|microsoft)\b/.test(os)) f = "windows";
  else if (/\b(mac|macos|osx|darwin)\b/.test(os)) f = "mac";
  else if (/\b(linux|ubuntu|debian|fedora|arch|centos|kali|android)\b/.test(os)) f = "linux";
  let root = false;
  try {
    const r = JSON.parse(h.implant_config ?? "{}")?.root;
    root = r === true || r === 1 || /^(true|1|yes)$/i.test(String(r ?? "").trim());
  } catch {}
  return icons[f][root ? "r" : "n"];
};

export const formatProcess = (v?: string | null) => {
  const s = (v ?? "").trim();
  return s ? s : "-";
};

export const tableCellTruncate =
  "inline-block max-w-[30ch] truncate align-middle";

const isAbortError = (e: unknown) =>
  e instanceof DOMException && e.name === "AbortError";

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });

export function useSessionsPanel() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [rightWidth, setRightWidth] = useState(440);
  const [isDragging, setIsDragging] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmMode, setDeleteConfirmMode] = useState<"selected" | "all">("selected");
  const confirmRemoveRef = useRef<() => void>(() => {});
  const [showKillConfirm, setShowKillConfirm] = useState(false);
  const killConfirmRef = useRef<() => void>(() => {});
  const [killTarget, setKillTarget] = useState<Session | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const selected = sessions.find((h) => h.id === selectedId) ?? null;

  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    let lista = sessions;
    if (q) {
      lista = sessions.filter((h) =>
        [h.tag, h.ip, h.internal, h.external_ip, h.listener, h.host_server, h.host_port, h.user, h.hostname, h.notes, h.arch, h.os, h.privilege, h._server].some((v) =>
          String(v ?? "").toLowerCase().includes(q)
        )
      );
    }
    if (sortCol) {
      lista = ordenarSessions(lista, sortCol, sortAsc);
    }
    return lista;
  }, [sessions, search, sortCol, sortAsc]);

  const handleSortColumn = (col: string) => {
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

  const copyContext = useCallback(() => {
    void navigator.clipboard.writeText(JSON.stringify({ sessions: filteredSessions }));
    toast.success("Sessions context copied");
  }, [filteredSessions]);

  const searchRef = useRef(search);
  const sessionCountRef = useRef(0);
  const loadingRef = useRef(loading);
  const selectedRef = useRef(selected);
  const menuSessionRef = useRef<Session | null>(null);
  const sessionsRef = useRef(sessions);
  const submittingRef = useRef(submitting);
  searchRef.current = search;
  sessionCountRef.current = filteredSessions.length;
  loadingRef.current = loading;
  selectedRef.current = selected;
  sessionsRef.current = sessions;
  submittingRef.current = submitting;

  useEffect(() => {
    const ac = new AbortController();
    const { signal } = ac;

    const loop = async () => {
      let bootstrapped = false;
      while (!signal.aborted) {
        try {
          const res = await DataFetch({
            signal,
            sessionsLongPoll: bootstrapped,
          });
          bootstrapped = true;
          if (signal.aborted) return;
          setLoading(false);
          if (res.status === "success") {
            setSessions(
              res.sessions.map((h) => ({
                ...h,
                process: formatProcess(h.process),
              })),
            );
            toast.dismiss(fetchToastId);
          } else {
            setSessions([]);
            if (!sessionsBulkDeleteQuiet.active) {
              toast.error(formatToastMessage(res.message ?? "Failed to fetch sessions"), {
                id: fetchToastId,
              });
            }
          }
        } catch (err) {
          if (signal.aborted || isAbortError(err)) return;
          setLoading(false);
          if (!sessionsBulkDeleteQuiet.active) {
            const message = err instanceof Error ? err.message : "Unknown error";
            toast.error(formatToastMessage(message), { id: fetchToastId });
          }
          try {
            await sleep(retryDelayMs, signal);
          } catch {
            return;
          }
        }
      }
    };

    void loop();

    return () => {
      ac.abort();
      toast.dismiss(fetchToastId);
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  useEffect(() => {
    if (panelOpen && !selected) setPanelOpen(false);
  }, [panelOpen, selected]);

  const handleRowClick = (id: number) => {
    setSelectedId(id);
  };

  const handleRowDoubleClick = (id: number) => {
    setSelectedId(id);
    setPanelOpen(true);
  };

  const handleListMouseDown = (e: React.MouseEvent) =>
    listRowMouseDown(e, () => setSelectedId(null));

  const handleOpenDeleteConfirm = () => {
    if (!selected) return;
    setDeleteConfirmMode("selected");
    setPanelOpen(false);
    setShowDeleteConfirm(true);
  };

  const handleOpenDeleteAllConfirm = () => {
    if (!sessionsRef.current.length || submittingRef.current) return;
    setDeleteConfirmMode("all");
    setPanelOpen(false);
    setShowDeleteConfirm(true);
  };

  const handleOpenKillConfirm = () => {
    const s = menuSessionRef.current;
    if (!s?.tag?.trim()) return;
    setKillTarget(s);
    setPanelOpen(false);
    setShowKillConfirm(true);
  };

  const handleConfirmKill = () => {
    const s = killTarget;
    if (!s?.tag?.trim()) return;
    kill_session(s.tag.trim(), s._server);
    setShowKillConfirm(false);
    setKillTarget(null);
  };

  const handleCancelKill = () => {
    setShowKillConfirm(false);
    setKillTarget(null);
  };

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
        () => confirmRemoveRef.current(),
        () => submittingRef.current,
      );
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [showDeleteConfirm]);

  useEffect(() => {
    if (!showKillConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setShowKillConfirm(false);
        setKillTarget(null);
        return;
      }
      tryConfirmDialogEnter(e, () => killConfirmRef.current());
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [showKillConfirm]);

  const handleConfirmRemove = async () => {
    if (deleteConfirmMode === "all") {
      await handleRemoveAll();
      setShowDeleteConfirm(false);
      return;
    }
    if (!selected?._server) return;
    setSubmitting(true);
    const res = await DeleteSession(selected.tag, selected._server);
    setSubmitting(false);
    setShowDeleteConfirm(false);
    setSelectedId(null);
    setRefreshKey((k) => k + 1);
    if (res?.status !== "success") {
      toast.error(res?.message ?? "Failed to remove session");
    }
  };

  const handleRemoveAll = async () => {
    const list = sessionsRef.current;
    if (!list.length || submittingRef.current) return;
    sessionsBulkDeleteQuiet.active = true;
    setSubmitting(true);
    let failed = 0;
    for (const s of list) {
      if (!s._server) continue;
      const res = await DeleteSession(s.tag, s._server);
      if (res?.status !== "success") failed += 1;
    }
    sessionsBulkDeleteQuiet.active = false;
    setSubmitting(false);
    setSelectedId(null);
    setPanelOpen(false);
    setRefreshKey((k) => k + 1);
    if (failed > 0) {
      toast.error(`Failed to remove ${failed} session(s)`);
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightWidth;
    setIsDragging(true);
    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      setRightWidth(Math.max(280, Math.min(800, startWidth + delta)));
    };
    const onUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  }, []);

  sessionsMenuRuntimeRef.current = {
    getSearch: () => searchRef.current,
    setSearch,
    getMenuSession: () => menuSessionRef.current,
    prepareFromTarget: (target) => {
      const el = target instanceof HTMLElement ? target : null;
      const row = el?.closest("tr[data-session-id]");
      const id = row?.getAttribute("data-session-id");
      if (!id) {
        menuSessionRef.current = null;
        return;
      }
      const h = sessionsRef.current.find((x) => String(x.id) === id);
      menuSessionRef.current = h ?? null;
    },
    canCopyContext: () => sessionCountRef.current > 0,
    copyContext,
    refresh: handleRefresh,
    canRefresh: () => !loadingRef.current,
    removeSelected: handleOpenDeleteConfirm,
    canRemoveSelected: () => selectedRef.current != null,
    removeAll: handleOpenDeleteAllConfirm,
    canRemoveAll: () => sessionsRef.current.length > 0 && !submittingRef.current,
    openKillConfirm: handleOpenKillConfirm,
    canKill: () => Boolean(menuSessionRef.current?.tag?.trim()),
  };

  useEffect(() => {
    return () => {
      sessionsMenuRuntimeRef.current = null;
    };
  }, []);

  const panelStyle =
    panelOpen
      ? ({
          "--panel-width": `${rightWidth}px`,
          ...(isDragging ? { transition: "none" } : {}),
        } as React.CSSProperties)
      : {};

  confirmRemoveRef.current = handleConfirmRemove;
  killConfirmRef.current = handleConfirmKill;

  return {
    filteredSessions,
    loading,
    search,
    selectedId,
    panelOpen,
    showDeleteConfirm,
    deleteConfirmMode,
    showKillConfirm,
    killTarget,
    submitting,
    selected,
    sessionCount: sessions.length,
    panelStyle,
    setSearch,
    setPanelOpen,
    setShowDeleteConfirm,
    handleRowClick,
    handleRowDoubleClick,
    handleListMouseDown,
    handleOpenDeleteConfirm,
    handleConfirmRemove,
    handleConfirmKill,
    handleCancelKill,
    handleResizeStart,
    handleRefresh,
    sortCol,
    sortAsc,
    handleSortColumn,
  };
}
