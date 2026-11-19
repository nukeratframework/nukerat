import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { translate } from "@/i18n";
import { fetchAgents, saveAgentRequest, removeAgentRequest } from "@/api/agents";
import { topbarFloatEscapeBlockRef } from "@/components/canva/shortcuts";
import { tryConfirmDialogEnter } from "@/components/canva/utils/confirm-dialog-keydown";
import {
  splitPanelDefaultWidth,
  splitPanelMaxWidth,
  splitPanelMinWidth,
} from "@/components/canva/utils/split-panel";
import { listRowMouseDown } from "@/components/canva/utils/list-row-selection";
import type { TableColumn } from "@/components/canva/utils/utc-date";

export type AgentType = "custom" | "deepseek";
export type PanelMode = "add" | "edit" | null;

export type AgentColumnKey = "name" | "tag" | "type" | "apiKey" | "server";

/// Column keys are stable; `label` is an i18n key resolved at render time.
export const table_columns: TableColumn<AgentColumnKey>[] = [
  { key: "name", label: "agents.columns.name" },
  { key: "tag", label: "agents.columns.tag" },
  { key: "type", label: "agents.columns.type" },
  { key: "apiKey", label: "agents.columns.apiKey" },
  { key: "server", label: "agents.columns.server" },
];

const TABLE_CELL_MAX_LEN = 15;

export const truncateTableCell = (value?: string | null) => {
  const raw = value?.trim();
  if (!raw) return "-";
  if (raw.length <= TABLE_CELL_MAX_LEN) return raw;
  return `${raw.slice(0, TABLE_CELL_MAX_LEN)}...`;
};

export interface KvPair {
  key: string;
  value: string;
}

export interface Agent {
  id: string;
  tag?: string;
  name: string;
  type: AgentType;
  server?: string;
  apiKey?: string;
  endpoint?: string;
  headers?: KvPair[];
  bodyTemplate?: string;
  responseField?: string;
}

export interface AgentFormData {
  name: string;
  host: string;
  port: string;
  type: AgentType;
  apiKey: string;
  endpoint: string;
  bodyTemplate: string;
  responseField: string;
  headers: KvPair[];
  cookies: KvPair[];
}

export const emptyForm: AgentFormData = {
  name: "",
  host: "",
  port: "",
  type: "custom",
  apiKey: "",
  endpoint: "",
  bodyTemplate: "",
  responseField: "",
  headers: [],
  cookies: [],
};

const buildSelectedServer = (form: AgentFormData) =>
  form.host.trim()
    ? `${form.host.trim().replace(/\/$/, "")}:${form.port.trim()}/api/agents/`
    : undefined;

const parseAgentServer = (server?: string) => {
  if (!server) return { host: "", port: "" };
  const base = server.replace(/\/api\/agents\/?$/i, "").replace(/\/+$/, "");
  const m = base.match(/^(.*):(\d+)$/);
  return m ? { host: m[1], port: m[2] } : { host: base, port: "" };
};

const splitCookieHeader = (headers: KvPair[]) => {
  const rest: KvPair[] = [];
  let cookies: KvPair[] = [];
  for (const h of headers) {
    if (h.key.toLowerCase() === "cookie") {
      cookies = h.value.split(";").map((p) => {
        const i = p.indexOf("=");
        return i < 0 ? { key: p.trim(), value: "" } : { key: p.slice(0, i).trim(), value: p.slice(i + 1).trim() };
      }).filter((c) => c.key);
    } else rest.push(h);
  }
  return { headers: rest, cookies };
};

const formFingerprint = (form: AgentFormData) => JSON.stringify(form);

const getMissingFields = (form: AgentFormData): string[] => {
  const missing: string[] = [];
  if (!form.name.trim()) missing.push("agents.fields.name");
  if (!form.host.trim()) missing.push("agents.fields.server");
  if (form.type === "deepseek") {
    if (!form.apiKey.trim()) missing.push("agents.fields.apiKey");
  } else {
    if (!form.endpoint.trim()) missing.push("agents.fields.endpoint");
    if (!form.bodyTemplate.trim()) missing.push("agents.fields.requestBody");
    if (!form.responseField.trim()) missing.push("agents.fields.responseField");
  }
  return missing;
};

export const canSubmitAgentForm = (
  form: AgentFormData,
  mode: "add" | "edit",
  editBaseline: string | null
) => {
  if (getMissingFields(form).length) return false;
  if (mode === "edit") {
    if (editBaseline == null) return false;
    return formFingerprint(form) !== editBaseline;
  }
  return true;
};

const agentToForm = (a: Agent): AgentFormData => {
  const { headers, cookies } = splitCookieHeader(a.headers ?? []);
  const { host, port } = parseAgentServer(a.server);
  return {
    name: a.name,
    host,
    port,
    type: a.type === "deepseek" ? "deepseek" : "custom",
    apiKey: a.apiKey ?? "",
    endpoint: a.endpoint ?? "",
    bodyTemplate: a.bodyTemplate ?? "",
    responseField: a.responseField ?? "",
    headers,
    cookies,
  };
};

export const updateKv = (items: KvPair[], i: number, field: "key" | "value", value: string) =>
  items.map((x, j) => (j === i ? { ...x, [field]: value } : x));

export const removeKv = (items: KvPair[], i: number) => items.filter((_, j) => j !== i);

export const addKv = (items: KvPair[]) => [...items, { key: "", value: "" }];

export interface AgentFormPanelProps {
  mode: "add" | "edit";
  selectedName?: string;
  formData: AgentFormData;
  editBaseline: string | null;
  submitting: boolean;
  handleClosePanel: () => void;
  handleSubmitForm: () => void;
  handleFormChange: <K extends keyof AgentFormData>(key: K, value: AgentFormData[K]) => void;
}

export function useAgentsPanel() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [formData, setFormData] = useState<AgentFormData>(emptyForm);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const confirmRemoveRef = useRef<() => void>(() => {});
  const submittingRef = useRef(submitting);
  submittingRef.current = submitting;
  const [rightWidth, setRightWidth] = useState(splitPanelDefaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const [editBaseline, setEditBaseline] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const selected = agents.find((a) => a.id === selectedId) ?? null;

  const loadAgents = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    const res = await fetchAgents(ctrl.signal);
    if (ctrl.signal.aborted) return;
    if (res?.status === "success") {
      setAgents(Array.isArray(res.agents) ? res.agents : []);
    } else if (res?.message !== "Cancelled") {
      toast.error(res?.message ?? translate("agents.toast.loadFailed"));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAgents();
    return () => abortRef.current?.abort();
  }, [loadAgents]);

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
    if (panelMode === "edit" && !selected) setPanelMode(null);
    else if (panelMode !== "edit") setEditBaseline(null);
  }, [panelMode, selected]);

  const handleCancelLoading = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  const handleRowClick = (id: string) => setSelectedId(id);

  const handleListMouseDown = (e: React.MouseEvent) =>
    listRowMouseDown(e, () => setSelectedId(null));

  const handleNew = () => {
    setFormData(emptyForm);
    setEditBaseline(null);
    setPanelMode("add");
  };

  const openEdit = (id: string) => {
    const agent = agents.find((a) => a.id === id);
    if (!agent) return;
    const form = agentToForm(agent);
    setSelectedId(id);
    setFormData(form);
    setEditBaseline(formFingerprint(form));
    setPanelMode("edit");
  };

  const handleFormChange = <K extends keyof AgentFormData>(key: K, value: AgentFormData[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleSubmitForm = async () => {
    const missing = getMissingFields(formData);
    if (missing.length) {
      toast.error(
        translate("agents.toast.required", {
          fields: missing.map((key) => translate(key)).join(", "),
        }),
      );
      return;
    }
    if (panelMode === "edit" && formFingerprint(formData) === editBaseline) return;
    setSubmitting(true);
    const server = buildSelectedServer(formData);
    const res = await saveAgentRequest(
      panelMode === "edit" ? "update" : "create",
      formData,
      panelMode === "edit" ? selected?.tag : undefined,
      server
    );
    if (res?.status !== "success") {
      setSubmitting(false);
      toast.error(
        res?.message ??
          translate(panelMode === "edit" ? "agents.toast.updateFailed" : "agents.toast.createFailed"),
      );
      return;
    }
    setSubmitting(false);
    toast.success(
      res?.message ?? translate(panelMode === "edit" ? "agents.toast.updated" : "agents.toast.created"),
    );
    setPanelMode(null);
    await loadAgents();
  };

  const handleConfirmRemove = async () => {
    if (!selected?.tag?.trim()) return;
    setSubmitting(true);
    const res = await removeAgentRequest(
      selected.tag,
      selected.server ? `${selected.server}/api/agents/` : undefined
    );
    if (res?.status !== "success") {
      setSubmitting(false);
      toast.error(res?.message ?? translate("agents.toast.removeFailed"));
      return;
    }
    setShowRemoveConfirm(false);
    setSelectedId(null);
    setSubmitting(false);
    toast.success(res?.message ?? translate("agents.toast.removed"));
    await loadAgents();
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
        Math.max(splitPanelMinWidth, Math.min(maxWidth, startWidth + (startX - ev.clientX))),
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

  const panelStyle: CSSProperties | undefined =
    panelMode === null
      ? undefined
      : ({
          zIndex: 10,
          "--panel-width": `${rightWidth}px`,
          ...(isDragging && { transition: "none" }),
        } as CSSProperties);

  return {
    agents,
    loading,
    selectedId,
    panelMode,
    formData,
    editBaseline,
    showRemoveConfirm,
    submitting,
    selected,
    panelStyle,
    setPanelMode,
    setShowRemoveConfirm,
    handleCancelLoading,
    handleRowClick,
    handleListMouseDown,
    handleNew,
    openEdit,
    handleFormChange,
    handleSubmitForm,
    handleConfirmRemove,
    handleResizeStart,
    handleRefresh: loadAgents,
    splitContainerRef,
  };
}
