import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  splitPanelDefaultWidth,
  splitPanelMaxWidth,
  splitPanelMinWidth,
} from "@/components/canva/utils/split-panel";
import type { Session } from "@/api/sessions";
import { deleteQueue, fetchQueue, type QueueItem } from "@/api/queue";
import type { FetchToastResponse } from "@/components/canva/utils/toast_rules";
import { topbarFloatEscapeBlockRef } from "@/components/canva/shortcuts";
import { tryConfirmDialogEnter } from "@/components/canva/utils/confirm-dialog-keydown";
import { listRowMouseDown } from "@/components/canva/utils/list-row-selection";
import { formatUtcDateOnly, utcTableColumnTitle } from "@/components/canva/utils/utc-date";

export const TABLE_COLUMNS = ["Host", "Type", "Input", utcTableColumnTitle("Date"), "Completed", "Server"] as const;

export const yn = (n: number) => (n ? "yes" : "no");

export const short = (s: string, n = 15) => (s.length > n ? `${s.slice(0, n)}...` : s);

export type QueueEntry = {
  key: string;
  tag: string;
  time: string;
  host: string;
  hostTag: string;
  type: string;
  input: string;
  parameters: string;
  isCompleted: number;
  error: string;
  captured: number;
  output: string;
  server: string;
};

const pageSize = 50;
const ok = (s?: string) => s === "success" || s === "successfull";

const normalize = (raw: QueueItem): QueueEntry => {
  const server = String(raw.server ?? "").trim();
  const tag = String(raw.tag ?? "");
  return {
    key: `${server}|${tag}`,
    tag,
    time: formatUtcDateOnly(String(raw.createdAt ?? "")),
    host: String(raw.host ?? ""),
    hostTag: String(raw.hostTag ?? raw.host ?? ""),
    type: String(raw.type ?? ""),
    input: String(raw.input ?? ""),
    parameters: String(raw.parameters ?? ""),
    isCompleted: Number(raw.isCompleted ?? 0),
    error: String(raw.error ?? ""),
    captured: Number(raw.captured ?? 0),
    output: String(raw.output ?? ""),
    server,
  };
};

export function useQueuePanel() {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
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
  const [rightWidth, setRightWidth] = useState(splitPanelDefaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const skipDebounceRef = useRef(false);
  const [tick, setTick] = useState(0);
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
  const selected = entries.find((e) => e.key === selectedKey) ?? null;

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
      const res = await fetchQueue({
        ...(q && { search: q }),
        hostTag,
        page: 1,
        pageSize: 500,
      });
      if (!alive) return;
      setResponse(res);
      if (ok(res.status)) {
        setEntries(Array.isArray(res.content) ? res.content.map(normalize) : []);
        if (Array.isArray(res.hosts)) setHosts(res.hosts);
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

  const handleListMouseDown = (e: ReactMouseEvent) =>
    listRowMouseDown(e, () => setSelectedKey(null));

  const handleConfirmRemove = async () => {
    if (!selected?.server.trim()) {
      setResponse({ status: "failure", message: "No server associated with this entry" });
      setShowRemoveConfirm(false);
      return;
    }
    setDeleting(true);
    const res = await deleteQueue(selected.tag, selected.server);
    setResponse(res);
    setDeleting(false);
    if (ok(res.status)) {
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
      resetPage();
    },
    setHostOpen,
    setShowRemoveConfirm,
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
    applyFilter: forceLoad,
    refresh: forceLoad,
    pickRow: (key: string) => setSelectedKey(key),
    handleListMouseDown,
    openRow: (key: string) => {
      setSelectedKey(key);
      setPanelOpen(true);
    },
    view: () => selected && setPanelOpen(true),
    handleOpenRemoveConfirm: () => {
      if (selected) setShowRemoveConfirm(true);
    },
    handleConfirmRemove,
    splitContainerRef,
    resize: (e: ReactMouseEvent) => {
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
