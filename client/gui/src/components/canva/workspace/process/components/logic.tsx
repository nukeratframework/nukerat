import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IconType } from "react-icons";
import { PiBrowser } from "react-icons/pi";
import { RiEdgeLine } from "react-icons/ri";
import { BsKey, BsPencilSquare, BsPrinter, BsShieldExclamation } from "react-icons/bs";
import { LuBlocks } from "react-icons/lu";
import { PiToolbox } from "react-icons/pi";
import { IoHelpCircleOutline, IoSettingsOutline } from "react-icons/io5";
import { GrVmware } from "react-icons/gr";
import { IoIosSearch } from "react-icons/io";
import { PiGoogleChromeLogoLight } from "react-icons/pi";
import { GoTerminal } from "react-icons/go";
import { VscTerminalPowershell } from "react-icons/vsc";
import { LiaWindows } from "react-icons/lia";
import { SiVirtualbox } from "react-icons/si";
import { toast } from "sonner";
import { DataFetch, parseProcessTree } from "@/api/process";
import type { ProcessNode } from "@/api/process";
import type { Session } from "@/api/sessions";
import { processMenuRuntimeRef } from "@/components/ui/rigth-click-menu.tsx";

// types -----------------------------------------------------------------------

export type SortKey =
  | "name"
  | "pid"
  | "cpu"
  | "memory"
  | "user"
  | "integrity"
  | "session"
  | "arch"
  | "network"
  | "privilege";

export type SortDir = "asc" | "desc";

export type ProcessFilter = "all" | "user" | "admin" | "system" | "root";

export const PROCESS_FILTERS: { label: string; value: ProcessFilter }[] = [
  { label: "All", value: "all" },
  { label: "User", value: "user" },
  { label: "Admin", value: "admin" },
  { label: "System", value: "system" },
  { label: "Root", value: "root" },
];

export function privilegeClass(privilege?: string): string {
  switch ((privilege ?? "").toLowerCase()) {
    case "system":
      return "text-[#f09292]";
    case "root":
      return "text-[#ed8585]";
    case "admin":
      return "text-[#ef9a60]";
    default:
      return "text-[#d4d4d4]";
  }
}

export const DEFAULT_WIDTHS: Record<string, number> = {
  name: 200,
  pid: 64,
  cpu: 74,
  memory: 88,
  user: 140,
  integrity: 32,
  session: 60,
  arch: 70,
  network: 150,
  privilege: 70,
};

export const TABLE_HEADERS: { label: string; key: string }[] = [
  { label: "NAME", key: "name" },
  { label: "PID", key: "pid" },
  { label: "CPU", key: "cpu" },
  { label: "MEMORY", key: "memory" },
  { label: "USER", key: "user" },
  { label: "PRIV", key: "privilege" },
  { label: "INTEGRITY", key: "integrity" },
  { label: "SESSION", key: "session" },
  { label: "ARCH", key: "arch" },
  { label: "NETWORK", key: "network" },
];

// icons -----------------------------------------------------------------------

const ICON_MAP: [string, IconType][] = [
  ["lsass", BsKey],
  ["spoolsv", BsPrinter],
  ["registry", LuBlocks],
  ["wmiprvse", PiToolbox],
  ["helppane", IoHelpCircleOutline],
  ["systemsettings", IoSettingsOutline],
  ["msedge", RiEdgeLine],
  ["msedgewebview2", RiEdgeLine],
  ["ctfmon", BsPencilSquare],
  ["vmtoolsd", GrVmware],
  ["searchindexer", IoIosSearch],
  ["chrome", PiGoogleChromeLogoLight],
  ["conhost", GoTerminal],
  ["powershell", VscTerminalPowershell],
  ["smartscreen", BsShieldExclamation],
  ["msmpeng", BsShieldExclamation],
  ["mpdefendercoreservice", BsShieldExclamation],
  ["sechealthui", BsShieldExclamation],
  ["securityhealthservice", BsShieldExclamation],
  ["securityhealthhost", BsShieldExclamation],
  ["securityhealthsystray", BsShieldExclamation],
  ["vboxservice", SiVirtualbox],
  ["vboxtray", SiVirtualbox],
  ["microsoft.activedirectory.webservices", LiaWindows],
];

export function normaliseProcessName(name: string): string {
  return name.toLowerCase().replace(/\.[a-z0-9]+$/, "");
}

export function getProcessIcon(name: string): IconType {
  const key = normaliseProcessName(name);
  const match = ICON_MAP.find(([kw]) => key.includes(kw));
  return match ? match[1] : PiBrowser;
}

// tree ------------------------------------------------------------------------

export function filterTree(nodes: ProcessNode[], query: string): ProcessNode[] {
  if (!query) return nodes;
  const q = query.toLowerCase();
  return nodes.reduce<ProcessNode[]>((acc, node) => {
    const matchSelf =
      node.name.toLowerCase().includes(q) ||
      String(node.pid).includes(q) ||
      node.user.toLowerCase().includes(q);
    const filteredChildren = filterTree(node.children ?? [], query);
    if (matchSelf || filteredChildren.length) acc.push({ ...node, children: filteredChildren });
    return acc;
  }, []);
}

export function filterByPrivilege(
  nodes: ProcessNode[],
  filter: ProcessFilter
): ProcessNode[] {
  if (filter === "all") return nodes;
  return nodes.reduce<ProcessNode[]>((acc, node) => {
    const privilege = (node.privilege ?? "").toLowerCase();
    const matchSelf = privilege === filter;
    const filteredChildren = filterByPrivilege(node.children ?? [], filter);
    if (matchSelf || filteredChildren.length) acc.push({ ...node, children: filteredChildren });
    return acc;
  }, []);
}

export function flattenNodes(nodes: ProcessNode[]): ProcessNode[] {
  return nodes.flatMap((node) => [
    { ...node, children: undefined },
    ...flattenNodes(node.children ?? []),
  ]);
}

function valorDoCampo(n: ProcessNode, key: SortKey): string {
  if (key === "name") return String(n.name ?? "");
  if (key === "pid") return String(n.pid ?? "");
  if (key === "cpu") return String(n.cpu ?? "");
  if (key === "memory") return String(n.memory ?? "");
  if (key === "user") return String(n.user ?? "");
  if (key === "integrity") return String(n.integrity ?? "");
  if (key === "session") return String(n.session ?? "");
  if (key === "arch") return String(n.arch ?? "");
  if (key === "network") return String(n.network ?? "");
  if (key === "privilege") return String(n.privilege ?? "");
  return "";
}

export function ordenarProcessNodes(nodes: ProcessNode[], key: SortKey, az: boolean): ProcessNode[] {
  const copia = nodes.slice();
  for (let i = 0; i < copia.length; i++) {
    for (let j = i + 1; j < copia.length; j++) {
      const a = valorDoCampo(copia[i], key).toLowerCase();
      const b = valorDoCampo(copia[j], key).toLowerCase();
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
  return copia.map((n) => ({
    ...n,
    children: n.children?.length ? ordenarProcessNodes(n.children, key, az) : n.children,
  }));
}

export function getVisibleNodes(
  processes: ProcessNode[],
  search: string,
  filter: ProcessFilter,
  treeMode: boolean,
  sort: SortKey | null,
  sortDir: SortDir
) {
  const filtered = filterByPrivilege(filterTree(processes, search), filter);
  if (!sort) {
    return treeMode ? filtered : flattenNodes(filtered);
  }
  const az = sortDir === "asc";
  return treeMode
    ? ordenarProcessNodes(filtered, sort, az)
    : ordenarProcessNodes(flattenNodes(filtered), sort, az);
}

function getDisplayedRows(
  nodes: ProcessNode[],
  treeMode: boolean,
  expandedPids: Set<number>
): ProcessNode[] {
  if (!treeMode) return nodes;
  const rows: ProcessNode[] = [];
  const walk = (ns: ProcessNode[]) => {
    for (const n of ns) {
      rows.push({ ...n, children: undefined });
      if (expandedPids.has(n.pid) && n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return rows;
}

export function copyProcessContext(
  processes: ProcessNode[],
  search: string,
  filter: ProcessFilter,
  treeMode: boolean,
  sort: SortKey | null,
  sortDir: SortDir,
  expandedPids: Set<number>
) {
  const rows = getDisplayedRows(
    getVisibleNodes(processes, search, filter, treeMode, sort, sortDir),
    treeMode,
    expandedPids
  );
  const payload = rows.map(({ name, pid, cpu, memory, user, privilege, integrity, session, arch, network }) => ({
    name, pid, cpu, memory, user, privilege, integrity, session, arch, network,
  }));
  navigator.clipboard.writeText(JSON.stringify({ process: payload }));
  toast.success("Process context copied");
}

export function allParentPids(nodes: ProcessNode[]): Set<number> {
  const s = new Set<number>();
  const walk = (ns: ProcessNode[]) => {
    for (const n of ns) {
      if (n.children?.length) {
        s.add(n.pid);
        walk(n.children);
      }
    }
  };
  walk(nodes);
  return s;
}

// table -----------------------------------------------------------------------

export function useProcessTable(
  processes: ProcessNode[],
  search: string,
  filter: ProcessFilter,
  treeMode: boolean,
  sort: SortKey | null,
  sortDir: SortDir
) {
  const [expandedPids, setExpandedPids] = useState<Set<number>>(() => allParentPids(processes));
  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  useEffect(() => {
    setExpandedPids(allParentPids(processes));
  }, [processes]);

  const toggle = useCallback((pid: number) => {
    setExpandedPids((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  }, []);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, key: string) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = colWidths[key] ?? DEFAULT_WIDTHS[key] ?? 80;
      const onMove = (ev: MouseEvent) => {
        const newWidth = Math.max(40, startWidth + ev.clientX - startX);
        setColWidths((prev) => ({ ...prev, [key]: newWidth }));
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [colWidths]
  );

  const visibleNodes = useMemo(
    () => getVisibleNodes(processes, search, filter, treeMode, sort, sortDir),
    [processes, search, filter, treeMode, sort, sortDir]
  );

  const copyContext = useCallback(
    () => copyProcessContext(processes, search, filter, treeMode, sort, sortDir, expandedPids),
    [processes, search, filter, treeMode, sort, sortDir, expandedPids]
  );

  return {
    expandedPids,
    colWidths,
    toggle,
    handleResizeStart,
    visibleNodes,
    copyContext,
  };
}

// window ------------------------------------------------------------------------

function showFetchFailureToast(res: unknown, fallbackMessage: string): boolean {
  const r = res as { request?: string; status?: string; message?: string; error?: string };
  const isRequestError = r?.request === "process";
  const isFailure =
    isRequestError ||
    r?.status === "failure" ||
    r?.status === "error" ||
    r?.status === "ERR_conn";
  if (!isFailure) return false;
  toast.error(r?.message ?? r?.error ?? fallbackMessage);
  return true;
}

export function useProcessWindow(selectedHost?: { host: Session; server: string } | null) {
  const hostUnavailable = !selectedHost;
  const [processes, setProcesses] = useState<ProcessNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProcessFilter>("all");
  const [treeMode, setTreeMode] = useState(true);
  const [sort, setSort] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<number | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sort !== key) {
        setSort(key);
        setSortDir("asc");
        return;
      }
      if (sortDir === "asc") {
        setSortDir("desc");
        return;
      }
      setSort(null);
      setSortDir("asc");
    },
    [sort, sortDir],
  );

  const load = useCallback(async () => {
    if (!selectedHost || requestControllerRef.current) return;

    const controller = new AbortController();
    requestControllerRef.current = controller;
    setLoading(true);
    const res = await DataFetch(selectedHost.server, selectedHost.host.tag, controller.signal);

    if (requestControllerRef.current === controller) {
      requestControllerRef.current = null;
      setLoading(false);
    }

    if ((res as { status?: string })?.status === "aborted") {
      return;
    }

    if (showFetchFailureToast(res, "Could not load process list.")) {
      return;
    }

    const nextProcesses = parseProcessTree(res);
    if ((res as { status?: string })?.status === "success" && nextProcesses === null) {
      toast.error("Could not parse process tree.");
      return;
    }

    setProcesses(nextProcesses ?? []);
  }, [selectedHost]);

  useEffect(() => {
    setProcesses([]);
    setSelected(null);
    if (selectedHost) {
      void load();
    }

    return () => {
      requestControllerRef.current?.abort();
      requestControllerRef.current = null;
    };
  }, [selectedHost, load]);

  const cancelLoading = useCallback(() => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setLoading(false);
  }, []);

  const table = useProcessTable(processes, search, filter, treeMode, sort, sortDir);

  const searchRef = useRef(search);
  const loadingRef = useRef(loading);
  const hostUnavailableRef = useRef(hostUnavailable);
  searchRef.current = search;
  loadingRef.current = loading;
  hostUnavailableRef.current = hostUnavailable;

  const visibleCountRef = useRef(0);
  visibleCountRef.current = table.visibleNodes.length;

  const controlsDisabled = () => loadingRef.current || hostUnavailableRef.current;

  processMenuRuntimeRef.current = {
    getSearch: () => searchRef.current,
    setSearch,
    controlsDisabled,
    canCopyContext: () => visibleCountRef.current > 0,
    refresh: load,
    copyContext: table.copyContext,
    setTreeView: () => setTreeMode(true),
    setFlatView: () => setTreeMode(false),
  };

  useEffect(() => {
    return () => {
      processMenuRuntimeRef.current = null;
    };
  }, []);

  return {
    hostUnavailable,
    processes,
    loading,
    search,
    setSearch,
    filter,
    setFilter,
    treeMode,
    setTreeMode,
    sort,
    sortDir,
    selected,
    setSelected,
    handleSort,
    load,
    cancelLoading,
    table,
  };
}
