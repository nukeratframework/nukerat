import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getServers, pollNsDebugger, type NsDebuggerItem } from "@/api/ns_debugger";
import type { ServerEntry } from "@/api/system/config";
import {
  getServerOptionLabel,
  truncateServerLabel,
} from "@/components/canva/topbar/listeners/components/logic";
import { nsDebuggerMenuRuntimeRef } from "@/components/ui/rigth-click-menu.tsx";
import type { FetchToastResponse } from "@/components/canva/utils/toast_rules";

export type NsDebuggerLine = { key: string; time: string; content: string };

const NS_DEBUGGER_TARGET_TAG = "ns";

export const nsDebuggerTargetId = (serverId: string) =>
  `${serverId}:${NS_DEBUGGER_TARGET_TAG}`;

export const tagFromNsDebuggerTargetId = (serverId: string, targetId: string) => {
  const prefix = `${serverId}:`;
  if (!targetId.startsWith(prefix)) return "";
  return targetId.slice(prefix.length);
};

function serverKey(server: { name?: string; ip?: string; port?: string }) {
  const ip = server.ip?.trim().replace(/\/$/, "");
  const port = server.port?.trim();
  return `${server.name}:${ip}:${port}`;
}

function formatNsDebuggerTargetLabel(server: ServerEntry) {
  const ip = server.ip?.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "") || "";
  const port = server.port?.trim() || "";
  if (ip && port) return `${ip}:${port}`;
  return truncateServerLabel(getServerOptionLabel(server));
}

function toLine(item: NsDebuggerItem): NsDebuggerLine {
  const srv = item.server ?? "?";
  const time = item.time ?? "";
  return { key: `${srv}-${item.id}-${item.tag}`, time, content: item.content ?? "" };
}

const isAbortError = (e: unknown) =>
  e instanceof DOMException && e.name === "AbortError";

export function useNsDebuggerPanel() {
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [serverId, setServerId] = useState("");
  const [tag, setTag] = useState("");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<NsDebuggerLine[]>([]);
  const [response, setResponse] = useState<FetchToastResponse | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [targetOpen, setTargetOpen] = useState(false);
  const [serversLoading, setServersLoading] = useState(false);
  const dead = useRef(new Set<string>());

  const server = servers.find((s) => s.id === serverId);
  const selectedTargetId = serverId && tag ? nsDebuggerTargetId(serverId) : "";
  const selectedTargetLabel = useMemo(() => {
    if (!server) return "";
    return formatNsDebuggerTargetLabel(server);
  }, [server]);

  const loadServers = useCallback(async () => {
    setServersLoading(true);
    try {
      const list = await getServers();
      setServers(list);
      setResponse({ status: "success" });
    } catch {
      setServers([]);
    } finally {
      setServersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServers();
  }, [loadServers]);

  useEffect(() => {
    if (!serverId && !tag) return;
    const valid = Boolean(
      serverId && tag === NS_DEBUGGER_TARGET_TAG && servers.some((s) => s.id === serverId),
    );
    if (!valid) {
      setServerId("");
      setTag("");
    }
  }, [servers, serverId, tag]);

  useEffect(() => {
    if (!server?.ip?.trim() || !server?.port?.trim() || tag !== NS_DEBUGGER_TARGET_TAG) {
      return;
    }

    const ac = new AbortController();
    const { signal } = ac;
    const key = serverKey(server);

    const loop = async () => {
      if (dead.current.has(key)) return;
      while (!signal.aborted && !dead.current.has(key)) {
        try {
          const res = await pollNsDebugger(server, signal);
          if (signal.aborted) return;
          if (res.status === "failure" || res.status === "ERR_conn") {
            dead.current.add(key);
            setResponse(res);
            return;
          }
          const batch = res.content ?? [];
          if (batch.length) {
            setLines((prev) => [...prev, ...batch.map(toLine)]);
          }
        } catch (err) {
          if (signal.aborted || isAbortError(err)) return;
          dead.current.add(key);
          setResponse({
            status: "failure",
            message: err instanceof Error ? err.message.slice(0, 80) : "Request failed",
          });
          return;
        }
      }
    };

    void loop();

    return () => {
      ac.abort();
    };
  }, [server?.ip, server?.port, server?.name, tag, refreshKey]);

  const filteredLines = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter(
      (line) =>
        line.content.toLowerCase().includes(q) ||
        line.time.toLowerCase().includes(q),
    );
  }, [lines, search]);

  const handleRefresh = useCallback(() => {
    if (!server) return;
    dead.current.delete(serverKey(server));
    setRefreshKey((k) => k + 1);
  }, [server]);

  const handleClear = useCallback(() => {
    setLines([]);
  }, []);

  const clearServerFilter = useCallback(() => {
    setServerId("");
    setTag("");
    setTargetOpen(false);
    setLines([]);
    dead.current.clear();
  }, []);

  const selectNsDebuggerTarget = useCallback((nextServerId: string, targetId: string) => {
    const tagName = tagFromNsDebuggerTargetId(nextServerId, targetId);
    if (tagName !== NS_DEBUGGER_TARGET_TAG) return;
    setServerId(nextServerId);
    setTag(tagName);
    setTargetOpen(false);
    setLines([]);
    dead.current.clear();
    setRefreshKey((k) => k + 1);
  }, []);

  const filterServers = useMemo(
    () => servers.filter((s) => s.ip?.trim() && s.port?.trim()),
    [servers],
  );

  const getTargetsForServer = useCallback(
    (s: ServerEntry) => [
      {
        id: nsDebuggerTargetId(s.id),
        name: formatNsDebuggerTargetLabel(s),
      },
    ],
    [],
  );

  const linesRef = useRef(lines);
  linesRef.current = lines;

  const syncMenuRuntime = useCallback(() => {
    nsDebuggerMenuRuntimeRef.current = {
      hasOutput: () => linesRef.current.length > 0,
      refresh: handleRefresh,
      clear: handleClear,
      canClear: () => linesRef.current.length > 0,
    };
  }, [handleRefresh, handleClear]);

  useLayoutEffect(() => {
    syncMenuRuntime();
  });

  const hasServer = Boolean(serverId && tag);

  return {
    servers: filterServers,
    search,
    tag,
    lines,
    displayLines: filteredLines,
    hasServer,
    selectedTargetId,
    selectedTargetLabel,
    targetOpen,
    serversLoading,
    response,
    serverLabel: (s: ServerEntry) => truncateServerLabel(getServerOptionLabel(s)),
    setSearch,
    setTargetOpen,
    refreshServers: loadServers,
    clearServerFilter,
    selectNsDebuggerTarget,
    getTargetsForServer,
    handleRefresh,
    handleClear,
  };
}
