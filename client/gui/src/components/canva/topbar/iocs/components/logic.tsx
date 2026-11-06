import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import {
  splitPanelDefaultWidth,
  splitPanelMaxWidth,
  splitPanelMinWidth,
} from "@/components/canva/utils/split-panel";
import { deleteIocRequest, fetchIocs } from "@/api/iocs";
import { fetchSessions, type Session } from "@/api/sessions";
import type { FetchToastResponse } from "@/components/canva/utils/toast_rules";
import { topbarFloatEscapeBlockRef } from "@/components/canva/shortcuts";
import { tryConfirmDialogEnter } from "@/components/canva/utils/confirm-dialog-keydown";
import { formatUtcDateOnly } from "@/components/canva/utils/utc-date";
import { listRowMouseDown } from "@/components/canva/utils/list-row-selection";

export type IocEntry = {
  id: string;
  tag: string;
  time: string;
  hostTag: string;
  type: string;
  value: string;
  server: string;
};

const pageSize = 50;

export function useIocPanel() {
  const [entries, setEntries] = useState<IocEntry[]>([]);
  const [hosts, setHosts] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [hostTag, setHostTag] = useState("all");
  const [hostId, setHostId] = useState("");
  const [hostOpen, setHostOpen] = useState(false);
  const [hostsLoading, setHostsLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<FetchToastResponse | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [rightWidth, setRightWidth] = useState(splitPanelDefaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const skipDebounceRef = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const confirmRemoveRef = useRef<() => void>(() => {});
  const deletingRef = useRef(deleting);
  deletingRef.current = deleting;

  const hostGroups = hosts.reduce<Record<string, Session[]>>((g, h) => {
    (g[h._server ?? "Unknown"] ??= []).push(h);
    return g;
  }, {});

  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  const visible = entries.slice((page - 1) * pageSize, page * pageSize);
  const selected = entries.find((e) => e.id === selectedKey) ?? null;

  const refreshHosts = useCallback(async () => {
    setHostsLoading(true);
    const res = await fetchSessions("default");
    if (res?.status === "success" && Array.isArray(res.sessions)) {
      const sessions = res.sessions as Session[];
      setHosts(sessions.filter((h) => h.tag));
    } else {
      setHosts([]);
    }
    setHostsLoading(false);
  }, []);

  const forceLoad = useCallback(() => {
    skipDebounceRef.current = true;
    setPage(1);
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    const delay = skipDebounceRef.current ? 0 : search.trim() ? 450 : 0;
    skipDebounceRef.current = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const q = search.trim();
      const res = await fetchIocs({
        ...(q && { search: q }),
        ...(hostTag !== "all" && { hostTags: [hostTag] }),
        page: 1,
        pageSize: 500,
      });
      if (!alive) return;
      setResponse(res);
      if (res.status === "success" || res.status === "successfull") {
        setEntries((Array.isArray(res.content) ? res.content : []).map((raw: any, index: number) => {
          const server = String(raw.server ?? "").trim();
          const tag = String(raw.tag ?? "");
          return {
            id: String(index),
            tag,
            time: formatUtcDateOnly(String(raw.createdAt ?? "")),
            hostTag: String(raw.hostTag ?? ""),
            type: String(raw.type ?? ""),
            value: String(raw.value ?? ""),
            server,
          };
        }));
      } else setEntries([]);
      setLoading(false);
    }, delay);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [search, hostTag, tick]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    if (panelOpen && !selected) setPanelOpen(false);
  }, [panelOpen, selected]);

  useEffect(() => {
    if (!showRemoveConfirm) return;
    topbarFloatEscapeBlockRef.current = true;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setShowRemoveConfirm(false);
        return;
      }
      tryConfirmDialogEnter(
        e,
        () => confirmRemoveRef.current(),
        () => deletingRef.current,
      );
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      topbarFloatEscapeBlockRef.current = false;
    };
  }, [showRemoveConfirm]);

  const resetPage = () => setPage(1);

  const handleListMouseDown = (e: MouseEvent) =>
    listRowMouseDown(e, () => setSelectedKey(null));

  const handleConfirmRemove = async () => {
    if (!selected?.server.trim()) {
      setResponse({ status: "failure", message: "No server associated with this entry" });
      setShowRemoveConfirm(false);
      return;
    }
    setDeleting(true);
    const res = await deleteIocRequest(selected.tag, selected.server);
    setResponse(res);
    setDeleting(false);
    if (res.status === "success" || res.status === "successfull") {
      setShowRemoveConfirm(false);
      setPanelOpen(false);
      setSelectedKey(null);
      setTick((n) => n + 1);
    }
  };
  confirmRemoveRef.current = () => {
    void handleConfirmRemove();
  };

  return {
    loading,
    search,
    hostGroups,
    hostOpen,
    hostId,
    hostsLoading,
    selectedHost: hosts.find((h) => String(h.id) === hostId),
    showRemoveConfirm,
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
    setSearch: (v: string) => {
      setSearch(v);
      setPage(1);
    },
    setPage,
    setPanelOpen,
    setHostOpen,
    setShowRemoveConfirm,
    refreshHosts,
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
    applyFilter: forceLoad,
    refresh: forceLoad,
    handleOpenRemoveConfirm: () => {
      if (selected) setShowRemoveConfirm(true);
    },
    pickRow: (id: string) => setSelectedKey(id),
    handleListMouseDown,
    openRow: (id: string) => {
      setSelectedKey(id);
      setPanelOpen(true);
    },
    handleConfirmRemove,
    splitContainerRef,
    resize: (e: MouseEvent) => {
      e.preventDefault();
      const x0 = e.clientX;
      const w0 = rightWidth;
      setIsDragging(true);
      const move = (ev: globalThis.MouseEvent) => {
        const containerW =
          splitContainerRef.current?.getBoundingClientRect().width ?? 0;
        const maxWidth = splitPanelMaxWidth(containerW, splitPanelMinWidth);
        setRightWidth(Math.max(splitPanelMinWidth, Math.min(maxWidth, w0 + x0 - ev.clientX)));
      };
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
