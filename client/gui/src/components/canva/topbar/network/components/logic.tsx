import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { DataFetch, type Session } from "@/api/sessions";
import {
  fetchConnections,
  saveConnectionRequest,
  removeConnectionRequest,
  restartConnectionRequest,
  buildCreateSelectedServer,
  type NetworkFormData,
  type Connection,
} from "@/api/network";
import { topbarFloatEscapeBlockRef } from "@/components/canva/shortcuts";
import { tryConfirmDialogEnter } from "@/components/canva/utils/confirm-dialog-keydown";
import {
  splitPanelDefaultWidth,
  splitPanelMaxWidth,
  splitPanelMinWidth,
} from "@/components/canva/utils/split-panel";
import { listRowMouseDown } from "@/components/canva/utils/list-row-selection";

export type { NetworkFormData, Connection };

export type PanelMode = "add" | "view" | null;

export const TABLE_COLUMNS = [
  "Host",
  "Type",
  "Port",
  "Forward",
  "Protocol",
  "Server",
] as const;

export const emptyForm: NetworkFormData = {
  networkType: "port_forwarding",
  host: "",
  port: "",
  targetPort: "",
  protocol: "tcp",
  authUser: "",
  authPass: "",
  hostTag: "",
  forwardHost: "",
  forwardPort: "",
};

export const typeLabel = (t?: string) =>
  t === "socks" || t === "proxychains" ? "socks" : "port forwarding";

export const formatForward = (c: Connection) => {
  if (c.networkType !== "port_forwarding") return "-";
  const host = c.forwardHost?.trim();
  const port = c.forwardPort;
  if (!host || port === "" || port == null) return "-";
  return `${host}:${port}`;
};

export const formatProtocol = (c: Connection) => {
  const raw = c.protocol?.trim();
  if (!raw || raw === "-") return "-";
  const lower = raw.toLowerCase();
  if (lower === "tcp" || lower === "udp") return lower.toUpperCase();
  return raw;
};

export const getRowId = (c: Connection, index: number) => {
  const p = c.server ? `${c.server}-` : "";
  if (c.id?.trim()) return `${p}${c.id}`;
  if (c.session_id?.trim()) return `${p}${c.session_id}`;
  return `${p}${c.networkType ?? "conn"}-${c.targetPort ?? "port"}-${index}`;
};

export const getRequestTag = (c: Connection | null) =>
  c?.tag?.trim() || c?.session_id?.trim() || c?.id?.trim() || null;

export const findSelectedConnection = (
  items: Connection[],
  selectedRowId: string | null
): Connection | null => {
  if (!selectedRowId) return null;
  return items.find((c, index) => getRowId(c, index) === selectedRowId) ?? null;
};

export const buildActionSelectedServer = (c: Connection | null) =>
  c?.server ? `${c.server}/api/network/` : undefined;

export function useHostTagOptions() {
  const [hosts, setHosts] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHosts = useCallback(() => {
    setLoading(true);
    const collected: Session[] = [];
    DataFetch((partial) => collected.push(...partial)).then(() => {
      setHosts([...collected]);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadHosts();
  }, [loadHosts]);

  const groups = hosts.reduce<Record<string, Session[]>>((acc, host) => {
    const key = host._server ?? "Unknown";
    (acc[key] ??= []).push(host);
    return acc;
  }, {});

  return { groups, loading, loadHosts };
}

export function useNetworkPanel() {
  const [items, setItems] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [formData, setFormData] = useState<NetworkFormData>(emptyForm);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const confirmRemoveRef = useRef<() => void>(() => {});
  const submittingRef = useRef(submitting);
  submittingRef.current = submitting;
  const [rightWidth, setRightWidth] = useState(splitPanelDefaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const hostTagOptions = useHostTagOptions();

  const selected = findSelectedConnection(items, selectedRowId);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetchConnections();
    setItems(res);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (panelMode === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelMode(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panelMode]);

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
        () => submittingRef.current,
      );
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      topbarFloatEscapeBlockRef.current = false;
    };
  }, [showRemoveConfirm]);

  useEffect(() => {
    if (panelMode === "view" && !selected) {
      setPanelMode(null);
    }
  }, [panelMode, selected]);

  const handleRowClick = (rowId: string) => {
    setSelectedRowId(rowId);
  };

  const handleListMouseDown = (e: React.MouseEvent) =>
    listRowMouseDown(e, () => setSelectedRowId(null));

  const handleRowDoubleClick = (rowId: string) => {
    setSelectedRowId(rowId);
    setPanelMode("view");
  };

  const handleFormChange = <K extends keyof NetworkFormData>(
    key: K,
    value: NetworkFormData[K]
  ) => setFormData((prev) => ({ ...prev, [key]: value }));

  const handleSubmitForm = async () => {
    const port = Number(formData.targetPort);
    if (!formData.host.trim() || !formData.port.trim()) return;
    if (!formData.targetPort.trim() || port < 1 || port > 65535) return;
    if (formData.networkType === "socks") {
      const user = formData.authUser.trim();
      const pass = formData.authPass.trim();
      if (Boolean(user) !== Boolean(pass)) {
        toast.error("User and password must both be set or both empty");
        return;
      }
      if (!formData.hostTag.trim()) {
        toast.error("Implant tag is required");
        return;
      }
    }
    if (formData.networkType === "port_forwarding") {
      const fp = Number(formData.forwardPort);
      if (!formData.hostTag.trim() || !formData.forwardHost.trim() || !formData.forwardPort.trim() || fp < 1 || fp > 65535) {
        toast.error("Implant, forward host and port are required");
        return;
      }
      if (formData.protocol !== "tcp") {
        toast.error("Only TCP supported");
        return;
      }
    }
    setSubmitting(true);
    const res = await saveConnectionRequest("create", formData, buildCreateSelectedServer(formData));
    setSubmitting(false);
    if (res?.status !== "success") {
      toast.error(res?.message ?? "Failed to create connection");
      return;
    }
    toast.success(res?.message ?? "Connection created");
    await refresh();
    setPanelMode(null);
  };

  const handleRestart = async () => {
    const id = getRequestTag(selected);
    if (!id) return;
    setSubmitting(true);
    const res = await restartConnectionRequest(id, buildActionSelectedServer(selected));
    setSubmitting(false);
    if (res?.status !== "success") {
      toast.error(res?.message ?? "Failed to restart connection");
      return;
    }
    toast.success(res?.message ?? "Connection restarted");
    await refresh();
  };

  const handleConfirmRemove = async () => {
    const id = getRequestTag(selected);
    if (!id) return;
    setSubmitting(true);
    const res = await removeConnectionRequest(id, buildActionSelectedServer(selected));
    if (res?.status !== "success") {
      setSubmitting(false);
      toast.error(res?.message ?? "Failed to remove connection");
      return;
    }
    setItems((prev) => prev.filter((c, i) => getRowId(c, i) !== selectedRowId));
    setSelectedRowId(null);
    setSubmitting(false);
    setShowRemoveConfirm(false);
    toast.success(res?.message ?? "Connection removed");
    await refresh();
  };
  confirmRemoveRef.current = () => {
    void handleConfirmRemove();
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightWidth;
    const containerW =
      splitContainerRef.current?.getBoundingClientRect().width ?? 0;
    const maxWidth = splitPanelMaxWidth(containerW, splitPanelMinWidth);
    setIsDragging(true);
    const onMove = (ev: MouseEvent) => {
      setRightWidth(
        Math.max(splitPanelMinWidth, Math.min(maxWidth, startWidth + startX - ev.clientX)),
      );
    };
    const onUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const panelStyle =
    panelMode !== null
      ? ({
          "--panel-width": `${rightWidth}px`,
          ...(isDragging ? { transition: "none" } : {}),
        } as React.CSSProperties)
      : {};

  return {
    items,
    loading,
    selectedRowId,
    panelMode,
    formData,
    showRemoveConfirm,
    submitting,
    selected,
    panelStyle,
    setPanelMode,
    setShowRemoveConfirm,
    handleRowClick,
    handleListMouseDown,
    handleRowDoubleClick,
    handleAdd: () => {
      setFormData(emptyForm);
      setPanelMode("add");
    },
    handleRestart,
    handleFormChange,
    handleSubmitForm,
    handleConfirmRemove,
    handleResizeStart,
    handleOpenRemoveConfirm: () => selected && setShowRemoveConfirm(true),
    handleOpenView: () => {
      if (selected) setPanelMode("view");
    },
    handleRefresh: refresh,
    hostGroups: hostTagOptions.groups,
    hostsLoading: hostTagOptions.loading,
    splitContainerRef,
  };
}

// view.tsx --------------------------------

export const getViewFlags = (connection: Connection | null) => ({
  isSocks:
    connection?.networkType === "socks" ||
    connection?.networkType === "proxychains",
  isPortForward: connection?.networkType === "port_forwarding",
});

export const getViewTitle = (connection: Connection | null): string => {
  const tag = connection?.hostTag?.trim() || connection?.tag?.trim();
  if (tag) return tag;
  return typeLabel(connection?.networkType);
};
