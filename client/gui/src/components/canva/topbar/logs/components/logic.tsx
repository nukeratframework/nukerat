import {
  useCallback,
  useEffect,
  useMemo,
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
import { listRowMouseDown } from "@/components/canva/utils/list-row-selection";
import { getServers, type ServerEntry } from "@/api/system/config";
import { fetchLogs } from "@/api/logs";
import {
  getServerOptionLabel,
  truncateServerLabel,
} from "@/components/canva/topbar/listeners/components/logic";

export type LogType = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
export type LogCategory = "listeners" | "launcher" | "server";

export interface LogEntry {
  id: string;
  raw: string;
  date: string;
  time: string;
  type: LogType;
  category: LogCategory;
  message: string;
}

export const short = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n)}...` : s);

export interface LogFilters {
  search: string;
  type: LogType | "all";
  category: LogCategory | "all";
}

export const logTypes: LogType[] = ["DEBUG", "INFO", "ERROR"];
export const logCategories: LogCategory[] = ["listeners", "launcher", "server"];

export const emptyFilters: LogFilters = {
  search: "",
  type: "all",
  category: "all",
};

export const pageSize = 50;

const logLevels = "DEBUG|INFO|WARNING|ERROR|CRITICAL";
const lineRe = new RegExp(
  `^(\\d{4}-\\d{2}-\\d{2}) (\\d{2}:\\d{2}:\\d{2}) UTC \\| (${logLevels}) \\| (listeners|launcher|server) \\| (.+)$`
);

type LogEntryParsed = Omit<LogEntry, "id">;

export const parseLogLine = (line: string): LogEntryParsed | null => {
  const m = line.trim().match(lineRe);
  if (!m) return null;
  const trimmed = line.trim();
  return {
    raw: trimmed,
    date: m[1],
    time: m[2],
    type: m[3] as LogType,
    category: m[4] as LogCategory,
    message: m[5],
  };
};

const toQuery = (filters: LogFilters, page: number, ip: string, port: string) => ({
  search: filters.search.trim(),
  logType: filters.type,
  category: filters.category,
  page,
  pageSize,
  ip,
  port,
});

export function useLogsPanel() {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [filters, setFilters] = useState<LogFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [response, setResponse] = useState<any>(null);
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [serverId, setServerId] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [rightWidth, setRightWidth] = useState(splitPanelDefaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const server = servers.find((s) => s.id === serverId);

  useEffect(() => {
    getServers()
      .then((list) => setServers(list))
      .catch(() => {});
  }, []);

  const load = useCallback(
    async (activeFilters: LogFilters, activePage: number, ip: string, port: string) => {
      setLoading(true);
      const res = await fetchLogs(toQuery(activeFilters, activePage, ip, port));
      setResponse(res);
      if (res?.status === "success") {
        const raw = res.logs;
        setLines(
          Array.isArray(raw)
            ? raw.filter((l: unknown) => typeof l === "string" && l.trim())
            : []
        );
        setTotal(Number(res.total) || 0);
        setPage(Number(res.page) || activePage);
      } else {
        setLines([]);
        setTotal(0);
      }
      setHasFetched(true);
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    if (!server?.ip || !server?.port) {
      setLoading(false);
      return;
    }
    const timer = setTimeout(
      () => load(filters, page, server.ip, server.port),
      filters.search ? 450 : 0
    );
    return () => clearTimeout(timer);
  }, [filters, page, server?.ip, server?.port, load]);

  const entries = useMemo(
    () =>
      lines
        .map((line, index) => {
          const entry = parseLogLine(line);
          if (!entry) return null;
          return { ...entry, id: String(index) };
        })
        .filter((e): e is LogEntry => e !== null),
    [lines]
  );

  const selected = entries.find((e) => e.id === selectedKey) ?? null;

  useEffect(() => {
    if (panelOpen && !selected) setPanelOpen(false);
  }, [panelOpen, selected]);

  const handleListMouseDown = (e: MouseEvent) =>
    listRowMouseDown(e, () => setSelectedKey(null));

  const setFilter = <K extends keyof LogFilters>(key: K, value: LogFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const setServer = (id: string) => {
    setServerId(id);
    setPage(1);
    setHasFetched(false);
  };

  const hasActiveFilters =
    filters.search.trim() !== "" || filters.type !== "all" || filters.category !== "all";

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return {
    loading,
    hasFetched,
    cancelLoading: () => setLoading(false),
    filters,
    entries,
    total,
    page,
    pageCount,
    response,
    servers,
    serverId,
    hasActiveFilters,
    setFilter,
    setServer,
    setPage,
    serverLabel: (s: ServerEntry) => truncateServerLabel(getServerOptionLabel(s)),
    clearFilters: () => {
      setFilters(emptyFilters);
      setPage(1);
    },
    handleRefresh: () => {
      if (server?.ip && server?.port) load(filters, page, server.ip, server.port);
    },
    selected,
    selectedKey,
    panelOpen,
    panelStyle: (panelOpen
      ? { "--panel-width": `${rightWidth}px`, ...(isDragging && { transition: "none" }) }
      : {}) as CSSProperties,
    setPanelOpen,
    pickRow: (id: string) => setSelectedKey(id),
    openRow: (id: string) => {
      setSelectedKey(id);
      setPanelOpen(true);
    },
    handleListMouseDown,
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
