import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { formatToastMessage } from "@/components/canva/utils/toast_rules";
import {
  getServers,
  putServer,
  deleteServer,
  type ServerEntry,
} from "@/api/system/config";
import { authServer } from "@/api/system/auth";
import { encodeKey, parseKey } from "@/api/system/key";
import { testConnection, type ConnectionStatus } from "@/api/servers";
import { topbarFloatEscapeBlockRef } from "@/components/canva/shortcuts";
import {
  splitPanelDefaultWidth,
  splitPanelMaxWidth,
  splitPanelMinWidth,
} from "@/components/canva/utils/split-panel";
import { listRowMouseDown } from "@/components/canva/utils/list-row-selection";


export type PanelMode = "add" | "edit" | null;

export interface ServerFormData {
  key: string;
  scheme: string;
  host: string;
  port: string;
}

export const empty_form: ServerFormData = {
  key: "",
  scheme: "http",
  host: "",
  port: "",
};

function splitStoredOrigin(ipField: string): { scheme: string; host: string } {
  const origin = ipField.trim().replace(/\/$/, "");

  const match = origin.match(/^(https?):\/\/(.+)$/i);
  if (match) {
    return { scheme: match[1].toLowerCase(), host: match[2] };
  }

  return {
    scheme: "http",
    host: origin.replace(/^https?:\/\//i, ""),
  };
}

export function parseServerForm(
  form: ServerFormData
): { ok: true; parsed: ServerEntry } | { ok: false; error: string } {
  const key = form.key.trim();
  const scheme = form.scheme.trim().toLowerCase();
  const host = form.host.trim();
  const port = form.port.trim();

  if (!key) return { ok: false, error: "Key is empty." };
  if (scheme !== "http" && scheme !== "https") {
    return { ok: false, error: 'Protocol must be "http" or "https".' };
  }
  if (!host || host.includes("/")) {
    return { ok: false, error: "Host must be non-empty and must not contain '/'." };
  }
  if (!/^\d+$/.test(port)) return { ok: false, error: "Port must be numeric." };
  const portNum = Number(port);
  if (portNum < 1 || portNum > 65535) {
    return { ok: false, error: "Port must be between 1 and 65535." };
  }

  try {
    const credentials = parseKey(key);
    const entry: ServerEntry = {
      id: "",
      name: credentials.name.trim(),
      ip: `${scheme}://${host}`,
      port,
      user: credentials.user,
      pass: credentials.pass,
      secret: credentials.secret,
      token: "",
    };
    return { ok: true, parsed: entry };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid key format";
    return { ok: false, error: message };
  }
}

export function serverEntryToForm(entry: ServerEntry): ServerFormData {
  const { scheme, host } = splitStoredOrigin(entry.ip);
  return {
    key: encodeKey({
      name: entry.name,
      user: entry.user,
      pass: entry.pass,
      secret: entry.secret,
    }),
    scheme,
    host,
    port: entry.port,
  };
}

export const formatServerProtocol = (entry: ServerEntry) =>
  splitStoredOrigin(entry.ip).scheme.toUpperCase();

export const formatServerHost = (entry: ServerEntry) =>
  splitStoredOrigin(entry.ip).host;

export function newServerId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function entryFingerprint(s: ServerEntry) {
  return JSON.stringify({
    name: s.name.trim(),
    ip: s.ip.trim().replace(/\/$/, ""),
    port: s.port,
    user: s.user,
    pass: s.pass,
    secret: s.secret,
  });
}

export function canAuthServerForm(formData: ServerFormData): boolean {
  return Boolean(formData.key.trim() && formData.host.trim() && formData.port.trim());
}

export function readServerKeyFile(
  e: React.ChangeEvent<HTMLInputElement>,
  onRead: (key: string) => void
): void {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const content = ev.target?.result as string;
    onRead(content.trim());
  };
  reader.readAsText(file);
  e.target.value = "";
}

export interface ServerFormPanelProps {
  mode: "add" | "edit";
  selectedName?: string;
  formData: ServerFormData;
  submitting: boolean;
  handleClosePanel: () => void;
  handleAuth: () => void | Promise<void>;
  handleClearAuth: () => void | Promise<void>;
  canClearAuth: boolean;
  handleFormChange: <K extends keyof ServerFormData>(
    key: K,
    value: ServerFormData[K]
  ) => void;
}

export function useServerPanel() {
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [formData, setFormData] = useState<ServerFormData>(empty_form);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, ConnectionStatus>>(
    {}
  );
  const [rightWidth, setRightWidth] = useState(splitPanelDefaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const [response, setResponse] = useState<any>(null);

  const selected = servers.find((s) => s.id === selectedId) ?? null;

  const checkStatus = (entry: ServerEntry) => {
    setStatuses((prev) => ({ ...prev, [entry.id]: "checking" }));
    testConnection(entry).then((res) => {
      setResponse(res);
      setStatuses((prev) => ({
        ...prev,
        [entry.id]:
          res.online && res.auth === true
            ? "online"
            : res.online
              ? "unauthorized"
              : "offline",
      }));
    });
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await getServers();
      setServers(data);
      setLoading(false);
      data.forEach(checkStatus);
    };
    load();
  }, []);

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
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      topbarFloatEscapeBlockRef.current = false;
    };
  }, [showRemoveConfirm]);

  useEffect(() => {
    if (panelMode !== "edit" || !selected) return;
    setFormData(serverEntryToForm(selected));
  }, [panelMode, selected]);

  useEffect(() => {
    if (panelMode === "edit" && !selected) {
      setPanelMode(null);
    }
  }, [panelMode, selected]);

  const openEditPanel = (entry: ServerEntry) => {
    setSelectedId(entry.id);
    setPanelMode("edit");
  };

  const handleRowClick = (id: string) => setSelectedId(id);

  const handleListMouseDown = (e: React.MouseEvent) =>
    listRowMouseDown(e, () => setSelectedId(null));

  const handleAdd = () => {
    setFormData(empty_form);
    setPanelMode("add");
  };

  const handleEdit = () => {
    if (!selected) return;
    openEditPanel(selected);
  };

  const handleRemove = () => {
    if (selected) setShowRemoveConfirm(true);
  };

  const handleConfirmRemove = async () => {
    if (!selected) return;
    setSubmitting(true);
    await deleteServer(selected.id);
    setServers((prev) => prev.filter((s) => s.id !== selected.id));
    setStatuses((prev) => {
      const n = { ...prev };
      delete n[selected.id];
      return n;
    });
    setSelectedId(null);
    setShowRemoveConfirm(false);
    setSubmitting(false);
  };

  const handleRefresh = () => servers.forEach(checkStatus);

  const handleFormChange = <K extends keyof ServerFormData>(
    key: K,
    value: ServerFormData[K]
  ) => setFormData((prev) => ({ ...prev, [key]: value }));

  const canClearAuth = panelMode === "edit" && Boolean(selected?.token?.trim());

  const handleClearAuth = async () => {
    if (!selected?.token?.trim()) return;

    setSubmitting(true);
    try {
      const entry: ServerEntry = { ...selected, token: "" };
      await putServer(entry);
      setServers((prev) => prev.map((s) => (s.id === entry.id ? entry : s)));
      checkStatus(entry);
      toast.success("Session cleared");
    } catch (e) {
      toast.error(formatToastMessage(e instanceof Error ? e.message : "Failed to clear JWT"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAuth = async () => {
    const parsed = parseServerForm(formData);
    if (!parsed.ok) {
      toast.error(formatToastMessage(parsed.error));
      return;
    }

    const { name, ip, port, user, pass, secret } = parsed.parsed;
    const fp = entryFingerprint({ ...parsed.parsed, token: "" });
    const skipId = panelMode === "edit" ? selected?.id : null;
    const dup = servers.find((s) => s.id !== skipId && entryFingerprint(s) === fp);
    if (dup) {
      toast.error(formatToastMessage(`${name}:Key already exists`));
      return;
    }

    setSubmitting(true);
    try {
      const token = await authServer({ name, ip, port, user, pass, secret });
      const entry: ServerEntry = {
        id: panelMode === "edit" && selected ? selected.id : newServerId(),
        name,
        ip,
        port,
        user,
        pass,
        secret,
        token,
      };
      await putServer(entry);
      setServers((prev) =>
        panelMode === "add"
          ? [...prev, entry]
          : prev.map((s) => (s.id === entry.id ? entry : s))
      );
      checkStatus(entry);
      toast.success("Authenticated");
      setPanelMode(null);
    } catch (e) {
      toast.error(formatToastMessage(e instanceof Error ? e.message : "Authentication failed"));
    } finally {
      setSubmitting(false);
    }
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
      const delta = startX - ev.clientX;
      setRightWidth(Math.max(splitPanelMinWidth, Math.min(maxWidth, startWidth + delta)));
    };
    const onUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return {
    servers,
    loading,
    selectedId,
    panelMode,
    formData,
    showRemoveConfirm,
    submitting,
    statuses,
    rightWidth,
    isDragging,
    selected,
    setShowRemoveConfirm,
    setPanelMode,
    openEditPanel,
    handleRowClick,
    handleListMouseDown,
    handleAdd,
    handleEdit,
    handleRemove,
    handleConfirmRemove,
    handleRefresh,
    handleFormChange,
    handleAuth,
    handleClearAuth,
    canClearAuth,
    handleResizeStart,
    splitContainerRef,
    response,
  };
}

export type { ConnectionStatus };
