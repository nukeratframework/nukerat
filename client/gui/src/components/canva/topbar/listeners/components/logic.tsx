import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  fetchListeners,
  saveListenerRequest,
  removeListenerRequest,
  restartListenerRequest,
} from "@/api/listeners";
import { getServers, type ServerEntry } from "@/api/system/config";
import { topbarFloatEscapeBlockRef } from "@/components/canva/shortcuts";
import { tryConfirmDialogEnter } from "@/components/canva/utils/confirm-dialog-keydown";
import {
  splitPanelDefaultWidth,
  splitPanelMaxWidth,
  splitPanelMinWidth,
} from "@/components/canva/utils/split-panel";
import { listRowMouseDown } from "@/components/canva/utils/list-row-selection";

// Types ----------------------------------------------------------

export type ListenerType = 'channel' | 'file_server';
export type ChannelPayload = 'http' | 'https';
export type CertSource = 'self_signed' | 'manual';
export type CertKeyType = 'rsa' | 'ecdsa';

export type ImplantBodyType = 'off' | 'custom' | 'json' | 'xml';
export type PanelMode = 'add' | 'view' | null;

export const implantBodyTemplates: Record<ImplantBodyType, string> = {
  off: '§content§',
  custom: '§content§',
  json: `{
  "type": "telemetry",
  "event": "sync",
  "payload": "§content§",
}`,
  xml: `<sync>
  <version>1.0</version>
  <body>§content§</body>
</sync>`,
};

const listenerResponseTemplates: Record<ImplantBodyType, string> = {
  off: '§content§',
  custom: '§content§',
  json: `{
  "status": "ok",
  "data": "§content§"
}`,
  xml: `<response>
  <status>200</status>
  <payload>§content§</payload>
</response>`,
};

// General consts and interfaces ----------------------------------------------------------

export interface ResponseHeader {
  key: string;
  value: string;
}

export interface ListenerCert {
  enabled: boolean;
  source: CertSource;
  certPem: string;
  keyPem: string;
  country: string;
  state: string;
  locality: string;
  organization: string;
  orgUnit: string;
  commonName: string;
  sanDns: string;
  days: string;
  keyType: CertKeyType;
}

export interface Listener {
  tag: string;
  type?: string;
  protocol?: string;
  name: string;
  implants: number;
  certfile?: any;
  keyfile?: any;
  listenerType?: ListenerType;
  channelPayload?: ChannelPayload;
  host?: string;
  port?: string | number;
  payload?: string;
  bind_interface?: string;
  endpointPath?: string;
  responseHeaders?: ResponseHeader[];
  implantBodyType?: ImplantBodyType;
  implantBody?: string;
  listenerResponse?: string;
  server?: string;
}

export interface ListenerFormData {
  name: string;
  listenerType: ListenerType;
  channelPayload: ChannelPayload;
  host: string;
  port: string;
  portToOpen: string;
  ssl: boolean;
  cert: ListenerCert;
  endpointPath: string;
  responseHeaders: ResponseHeader[];
  implantBodyType: ImplantBodyType;
  implantBody: string;
  listenerResponse: string;
}

const communicationFromPreset = (type: ImplantBodyType) => ({
  implantBody: implantBodyTemplates[type],
  listenerResponse: listenerResponseTemplates[type],
});

export { listenerResponseTemplates, communicationFromPreset };

export const CHANNEL_OPTIONS: [ChannelPayload, string][] = [
  ['http', 'http'],
  ['https', 'https'],
];

export const CHANNEL_LABELS: Record<ChannelPayload, string> = {
  http: 'http',
  https: 'https',
};

export const getDefaultPort = (cp: ChannelPayload): string => {
  if (cp === 'https') return '443';
  return '80';
};

export const CERT_SUBJECT_FIELDS = [
  { key: "country", label: "C", placeholder: "US" },
  { key: "state", label: "ST", placeholder: "California" },
  { key: "locality", label: "L", placeholder: "San Jose" },
  { key: "organization", label: "O", placeholder: "Cisco Systems Inc" },
  { key: "orgUnit", label: "OU", placeholder: "IT" },
  { key: "commonName", label: "CN", placeholder: "update.cisco-cloud.com" },
  { key: "sanDns", label: "san dns", placeholder: "update.cisco-cloud.com" },
] as const;

export const EMPTY_CERT: ListenerCert = {
  enabled: true,
  source: 'self_signed',
  certPem: '',
  keyPem: '',
  country: '',
  state: '',
  locality: '',
  organization: '',
  orgUnit: '',
  commonName: '',
  sanDns: '',
  days: '',
  keyType: 'ecdsa',
};

export const EMPTY_FORM: ListenerFormData = {
  name: '',
  listenerType: 'channel',
  channelPayload: 'http',
  host: '',
  port: '80',
  portToOpen: '',
  ssl: false,
  cert: EMPTY_CERT,
  endpointPath: '',
  responseHeaders: [],
  implantBodyType: 'off',
  ...communicationFromPreset('off'),
};

// index.tsx --------------------------------

export const TABLE_COLUMNS = [
  "Name",
  "Type",
  "Protocol",
  "Address",
  "Server",
  "Cert",
] as const;

export const LEGACY_LABELS: Record<string, string> = {
  "windows/beacon_http/reverse_http": "http",
  "windows/beacon_https/reverse_https": "https",
  "windows/beacon_smb/bind_pipe": "smb",
  "windows/beacon_tcp/bind_tcp": "tcp bind",
  "windows/beacon_tcp/reverse_tcp": "tcp rev",
  foreign: "Foreign",
  external_c2: "ext c2",
};

export const getPayloadLabel = (l: Listener): string => {
  if (l.channelPayload) return CHANNEL_LABELS[l.channelPayload] ?? l.channelPayload;
  return LEGACY_LABELS[l.payload ?? ""] ?? l.payload ?? "-";
};

export const getListenerRowId = (l: Listener, index: number): string => {
  const p = l.server ? `${l.server}-` : "";
  if (l.tag?.trim()) return `${p}${l.tag}`;
  return `${p}${l.name ?? "listener"}-${l.listenerType ?? "legacy"}-${l.channelPayload ?? l.payload ?? "payload"}-${l.port ?? "port"}-${index}`;
};

export const getListenerRequestTag = (l: Listener | null): string | null => {
  if (!l?.tag?.trim()) return null;
  return l.tag;
};

export const findSelectedListener = (
  listeners: Listener[],
  selectedRowId: string | null
): Listener | null => {
  if (!selectedRowId) return null;
  return (
    listeners.find((l, index) => getListenerRowId(l, index) === selectedRowId) ??
    null
  );
};

export const isHttpProtocol = (protocol?: string): boolean =>
  protocol === "http" || protocol === "https";

export const getListenerAddressHref = (l: Listener): string =>
  `${l.protocol}://${l.host}:${l.port}`;

export const hasListenerCert = (l: Listener): boolean =>
  Boolean(l.certfile || l.keyfile || l.protocol === "https");

export const buildCreateSelectedServer = (formData: ListenerFormData): string =>
  `${formData.host.trim().replace(/\/$/, "")}:${formData.port.trim()}/api/listeners/`;

export const reloadListeners = async (): Promise<Listener[]> => {
  const data = await fetchListeners();
  return data as Listener[];
};

export function useListenersPanel() {
  const [listeners, setListeners] = useState<Listener[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [formData, setFormData] = useState<ListenerFormData>(EMPTY_FORM);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const confirmRemoveRef = useRef<() => void>(() => {});
  const submittingRef = useRef(submitting);
  submittingRef.current = submitting;
  const [rightWidth, setRightWidth] = useState(splitPanelDefaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const selected = findSelectedListener(listeners, selectedRowId);

  const refreshListeners = useCallback(async () => {
    setLoading(true);
    const data = await reloadListeners();
    setListeners(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshListeners();
  }, [refreshListeners]);

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

  const handleAdd = () => {
    setFormData(EMPTY_FORM);
    setPanelMode("add");
  };

  const handleRestart = async () => {
    const requestId = getListenerRequestTag(selected);
    if (!requestId) return;
    setSubmitting(true);
    const res = await restartListenerRequest(
      requestId,
      selected?.server ? `${selected.server}/api/listeners/` : undefined
    );
    if (res?.status !== "success") {
      setSubmitting(false);
      toast.error(res?.message ?? "Failed to restart listener");
      return;
    }
    setSubmitting(false);
    toast.success(res?.message ?? "Listener restarted");
    await refreshListeners();
  };

  const handleFormChange = <K extends keyof ListenerFormData>(
    key: K,
    value: ListenerFormData[K]
  ) =>
    setFormData((prev) => {
      if (key === "channelPayload") {
        return {
          ...prev,
          channelPayload: value as ChannelPayload,
          port: getDefaultPort(value as ChannelPayload),
        };
      }
      if (key === "implantBodyType") {
        return {
          ...prev,
          implantBodyType: value as ImplantBodyType,
          ...communicationFromPreset(value as ImplantBodyType),
        };
      }
      return { ...prev, [key]: value };
    });

  const handleSubmitForm = async () => {
    if (!formData.name.trim()) return;
    setSubmitting(true);
    const res = await saveListenerRequest(
      "create",
      { ...formData },
      buildCreateSelectedServer(formData)
    );
    setSubmitting(false);
    if (res?.status !== "success") {
      toast.error(res?.message ?? "Failed to create listener");
      return;
    }
    toast.success(res?.message ?? "Listener created");
    await refreshListeners();
    setPanelMode(null);
  };

  const handleConfirmRemove = async () => {
    const requestId = getListenerRequestTag(selected);
    if (!requestId) return;
    setSubmitting(true);
    const res = await removeListenerRequest(
      requestId,
      selected?.server ? `${selected.server}/api/listeners/` : undefined
    );
    if (res?.status !== "success") {
      setSubmitting(false);
      toast.error(res?.message ?? "Failed to remove listener");
      return;
    }
    setListeners((prev) =>
      prev.filter((l, i) => getListenerRowId(l, i) !== selectedRowId)
    );
    setSelectedRowId(null);
    setSubmitting(false);
    setShowRemoveConfirm(false);
    toast.success(res?.message ?? "Listener removed");
    await refreshListeners();
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
      const delta = startX - ev.clientX;
      setRightWidth(
        Math.max(splitPanelMinWidth, Math.min(maxWidth, startWidth + delta))
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

  const handleOpenRemoveConfirm = () => {
    if (selected) setShowRemoveConfirm(true);
  };

  const handleOpenView = () => {
    if (selected) setPanelMode("view");
  };

  const panelStyle =
    panelMode !== null
      ? ({
          "--panel-width": `${rightWidth}px`,
          ...(isDragging ? { transition: "none" } : {}),
        } as React.CSSProperties)
      : {};

  return {
    listeners,
    loading,
    selectedRowId,
    panelMode,
    formData,
    showRemoveConfirm,
    submitting,
    rightWidth,
    isDragging,
    selected,
    panelStyle,
    setPanelMode,
    setShowRemoveConfirm,
    handleRowClick,
    handleListMouseDown,
    handleRowDoubleClick,
    handleAdd,
    handleRestart,
    handleFormChange,
    handleSubmitForm,
    handleConfirmRemove,
    handleResizeStart,
    handleOpenRemoveConfirm,
    handleOpenView,
    handleRefresh: refreshListeners,
    splitContainerRef,
  };
}

// add.tsx --------------------------------

export const getAddFormFlags = (formData: ListenerFormData) => ({
  isChannel: formData.listenerType === "channel",
  isFileServer: formData.listenerType === "file_server",
  cp: formData.channelPayload,
});

export const getChannelPayloadSectionLabel = (cp: ChannelPayload): string =>
  CHANNEL_LABELS[cp] ?? cp;

const isValidPort = (port: string): boolean => {
  const n = Number(port.trim());
  return port.trim() !== "" && Number.isInteger(n) && n >= 1 && n <= 65535;
};

const isCertComplete = (cert: ListenerCert, required: boolean): boolean => {
  if (!required) return true;
  if (cert.source === "manual") {
    return (
      cert.certPem.includes("BEGIN CERTIFICATE") &&
      cert.keyPem.includes("PRIVATE KEY")
    );
  }
  return cert.country.trim().length === 2;
};

export const isAddSubmitDisabled = (
  formData: ListenerFormData,
  submitting: boolean
): boolean => {
  if (submitting || !formData.name.trim()) return true;

  const { isChannel, isFileServer, cp } = getAddFormFlags(formData);

  if (isChannel) {
    if (!formData.host.trim() || !isValidPort(formData.portToOpen)) return true;
    if (cp === "https" && !isCertComplete(formData.cert, true)) return true;
    return false;
  }

  if (isFileServer) {
    if (!formData.host.trim() || !isValidPort(formData.portToOpen)) return true;
    if (formData.ssl && !isCertComplete(formData.cert, true)) return true;
    return false;
  }

  return true;
};

export const createServerSelectHandler =
  (
    handleFormChange: <K extends keyof ListenerFormData>(
      key: K,
      value: ListenerFormData[K]
    ) => void
  ) =>
  (host: string, port: string) => {
    handleFormChange("host", host);
    handleFormChange("port", port);
  };

// view.tsx --------------------------------

export const truncateViewText = (value: string, max = 20): string =>
  value.length > max ? `${value.slice(0, max)}...` : value;

export const readViewValue = (value?: string | number | null): string => {
  if (value === undefined || value === null || `${value}`.trim() === "") {
    return "-";
  }
  return truncateViewText(String(value));
};

export const getViewFlags = (listener: Listener | null) => ({
  isChannel: listener?.listenerType === "channel",
  isFileServer: listener?.listenerType === "file_server",
});

export const getViewTypeLabel = (listener: Listener | null): string => {
  if (listener?.listenerType === "file_server") return "File server";
  return "Channel";
};

export const getViewProtocolLabel = (listener: Listener | null): string => {
  if (listener?.listenerType === "file_server") return "file";
  return listener?.protocol ?? "";
};

export const showViewAdvancedSection = (listener: Listener | null): boolean =>
  getViewFlags(listener).isChannel &&
  (listener?.channelPayload === "http" || listener?.channelPayload === "https");

// form.tsx --------------------------------

export const truncateServerLabel = (label: string, max = 40): string =>
  label.length > max ? label.slice(0, max) + "…" : label;

export const getServerOptionLabel = (s: ServerEntry): string =>
  `${s.name} - ${s.ip}:${s.port}`;

export function useServerDropdown(
  host: string,
  port?: string,
  onSelect?: (host: string, port: string) => void,
  onSelectHost?: (host: string) => void
) {
  const [servers, setServers] = useState<ServerEntry[]>([]);

  useEffect(() => {
    getServers().then(setServers).catch(() => {});
  }, []);

  const selectedId = onSelectHost
    ? (servers.find((s) => s.ip === host)?.id ?? "")
    : (servers.find((s) => s.ip === host && s.port === (port ?? ""))?.id ??
      "");

  const handleChange = (id: string) => {
    const s = servers.find((sv) => sv.id === id);
    if (!s) return;
    if (onSelectHost) onSelectHost(s.ip);
    else if (onSelect) onSelect(s.ip, s.port);
  };

  return { servers, selectedId, handleChange };
}

export function useAdvancedSection(
  formData: ListenerFormData,
  handleFormChange: <K extends keyof ListenerFormData>(
    key: K,
    value: ListenerFormData[K]
  ) => void
) {
  const [expanded, setExpanded] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const toggleExpanded = () => setExpanded((v) => !v);

  const addImplantMarker = () => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next =
      formData.implantBody.slice(0, start) +
      "§content§" +
      formData.implantBody.slice(end);
    handleFormChange("implantBody", next);
    const pos = start + "§content§".length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const clearImplantMarkers = () =>
    handleFormChange(
      "implantBody",
      formData.implantBody.replace(/§[^§]*§/g, "").replace(/§/g, "")
    );

  const addHeader = () =>
    handleFormChange("responseHeaders", [
      ...formData.responseHeaders,
      { key: "", value: "" },
    ]);

  const removeHeader = (i: number) =>
    handleFormChange(
      "responseHeaders",
      formData.responseHeaders.filter((_, idx) => idx !== i)
    );

  const updateHeader = (i: number, f: keyof ResponseHeader, val: string) =>
    handleFormChange(
      "responseHeaders",
      formData.responseHeaders.map((h, idx) =>
        idx === i ? { ...h, [f]: val } : h
      )
    );

  return {
    expanded,
    toggleExpanded,
    bodyRef,
    addImplantMarker,
    clearImplantMarkers,
    addHeader,
    removeHeader,
    updateHeader,
  };
}

export function readListenerPemFile(
  e: React.ChangeEvent<HTMLInputElement>,
  onRead: (content: string) => void
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

export const updateListenerCert = (
  cert: ListenerFormData["cert"],
  patch: Partial<ListenerFormData["cert"]>,
  handleFormChange: <K extends keyof ListenerFormData>(
    key: K,
    value: ListenerFormData[K]
  ) => void
) => handleFormChange("cert", { ...cert, ...patch });
