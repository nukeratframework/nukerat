import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { formatUtcDateOnly, utcTableColumnTitle } from "@/components/canva/utils/utc-date";
import { toast } from "sonner";
import { topbarFloatEscapeBlockRef } from "@/components/canva/shortcuts";
import { formatToastMessage } from "@/components/canva/utils/toast_rules";
import {
  splitPanelDefaultWidth,
  splitPanelMaxWidth,
  splitPanelMinWidth,
} from "@/components/canva/utils/split-panel";
import { listRowMouseDown } from "@/components/canva/utils/list-row-selection";
import {
  addScriptRequest,
  deleteScriptRequest,
  editScriptRequest,
  fetchScripts,
  changeStatusScriptRequest,
  type ScriptEntry,
} from "@/api/scripts";
import { formatNukeScript } from "./format";

export type PanelMode = "add" | "edit" | null;

export const TABLE_COLUMNS = [
  "Status",
  "Name",
  "Server",
  "Description",
  "Errors",
  utcTableColumnTitle("Last Run"),
  utcTableColumnTitle("Created"),
] as const;

export const formatUtc = (raw?: string | null) => formatUtcDateOnly(raw);

export interface ScriptFormData {
  name: string;
  server: string;
  description: string;
  content: string;
}

export const emptyForm: ScriptFormData = { name: "", server: "", description: "", content: "" };

export function parseScriptServer(server: string) {
  const base = server.trim().replace(/\/+$/, "");
  const match = base.match(/^(.*):(\d+)$/);
  return match ? { host: match[1], port: match[2] } : { host: base, port: "" };
}

export function buildScriptServer(ip: string, port: string) {
  return `${ip.trim().replace(/\/$/, "")}:${port.trim()}`;
}

const ok = (s?: string) => s === "success" || s === "successfull";

function isScriptException(message: string) {
  return /^Error:\s*line\s+\d+:/i.test(message) || message.includes("\n") || /traceback|exception/i.test(message);
}

function entryToForm(entry: ScriptEntry): ScriptFormData {
  return {
    name: entry.name ?? "",
    server: entry.server ?? "",
    description: entry.description ?? "",
    content: entry.content ?? "",
  };
}

export function canSubmitScriptForm(
  form: ScriptFormData,
  mode: "add" | "edit",
  editBaseline: string | null
) {
  if (!form.content.trim()) return false;
  if (mode === "edit") return editBaseline != null && form.content.trim() !== editBaseline.trim();
  return form.name.trim() && form.server.trim();
}

export function readScriptFile(
  e: React.ChangeEvent<HTMLInputElement>,
  onRead: (content: string) => void
) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => onRead((ev.target?.result as string).trim());
  reader.readAsText(file);
  e.target.value = "";
}

export function useScriptsPanel() {
  const [scripts, setScripts] = useState<ScriptEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [formData, setFormData] = useState<ScriptFormData>(emptyForm);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rightWidth, setRightWidth] = useState(splitPanelDefaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const [editBaseline, setEditBaseline] = useState<string | null>(null);
  const [response, setResponse] = useState<any>(null);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const selected = scripts.find((s) => s.tag === selectedTag) ?? null;
  const closePanel = () => setPanelMode(null);

  const reportFailure = (res: any) => {
    if (ok(res?.status)) return false;
    const message = typeof res?.message === "string" ? res.message.trim() : "";
    if (isScriptException(message)) {
      setScriptError(message);
      return true;
    }
    setScriptError(null);
    toast.error(formatToastMessage(message || "Request failed"));
    return true;
  };

  const loadScripts = useCallback(async (report = false) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    const res = await fetchScripts(ctrl.signal);
    if (ctrl.signal.aborted) return;
    if (report) {
      setResponse(res);
      if (!reportFailure(res)) setScriptError(null);
    }
    if (ok(res?.status)) setScripts(Array.isArray(res.content) ? res.content : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadScripts();
    return () => abortRef.current?.abort();
  }, [loadScripts]);

  useEffect(() => {
    if (panelMode === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
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
    if (panelMode === "edit" && selected) {
      const form = entryToForm(selected);
      setFormData(form);
      setEditBaseline(form.content.trim());
    } else if (panelMode !== "edit") setEditBaseline(null);
  }, [panelMode, selected]);

  useEffect(() => {
    if (panelMode === "edit" && !selected) closePanel();
  }, [panelMode, selected]);

  const openEdit = (entry: ScriptEntry) => {
    setSelectedTag(entry.tag);
    setPanelMode("edit");
  };

  const handleRowClick = (tag: string) => setSelectedTag(tag);

  const handleListMouseDown = (e: React.MouseEvent) =>
    listRowMouseDown(e, () => setSelectedTag(null));

  return {
    scripts,
    loading,
    selectedTag,
    panelMode,
    formData,
    showRemoveConfirm,
    submitting,
    editBaseline,
    selected,
    response,
    scriptError,
    setScriptError,
    panelStyle: (panelMode
      ? { zIndex: 10, "--panel-width": `${rightWidth}px`, ...(isDragging && { transition: "none" }) }
      : {}) as CSSProperties,
    setShowRemoveConfirm,
    closePanel,
    openEdit,
    handleRowClick,
    handleListMouseDown,
    handleAdd: () => {
      setFormData(emptyForm);
      setPanelMode("add");
    },
    handleEdit: () => selected && openEdit(selected),
    handleFormChange: <K extends keyof ScriptFormData>(key: K, value: ScriptFormData[K]) =>
      setFormData((prev) => ({ ...prev, [key]: value })),
    handleServerChange: (ip: string, port: string) =>
      setFormData((prev) => ({ ...prev, server: buildScriptServer(ip, port) })),
    handleSubmitForm: async () => {
      if (panelMode !== "add" && panelMode !== "edit") return;
      if (!canSubmitScriptForm(formData, panelMode, editBaseline)) return;
      setSubmitting(true);
      const payload = {
        ...(panelMode === "edit" && selected ? { tag: selected.tag } : {}),
        name: formData.name.trim(),
        description: formData.description.trim().slice(0, 100),
        content: formData.content,
      };
      const server = panelMode === "edit" ? selected?.server : formData.server;
      const res =
        panelMode === "add"
          ? await addScriptRequest(payload, server)
          : await editScriptRequest(payload, server);
      setResponse(res);
      setSubmitting(false);
      if (reportFailure(res)) return;
      setScriptError(null);
      toast.success(res?.message ?? (panelMode === "add" ? "Script created" : "Script updated"));
      closePanel();
      await loadScripts();
    },
    handleConfirmRemove: async () => {
      if (!selected) return;
      setSubmitting(true);
      const res = await deleteScriptRequest(selected.tag, selected.content ?? "", selected.server);
      setResponse(res);
      setSubmitting(false);
      if (reportFailure(res)) return;
      setScriptError(null);
      toast.success(res?.message ?? "Script removed");
      setShowRemoveConfirm(false);
      setSelectedTag(null);
      await loadScripts();
    },
    handleChangeStatus: async () => {
      if (!selected) return;
      setSubmitting(true);
      const res = await changeStatusScriptRequest(selected.tag, selected.status === 1 ? 0 : 1, selected.server);
      setResponse(res);
      setSubmitting(false);
      if (reportFailure(res)) return;
      setScriptError(null);
      toast.success(res?.message ?? "Script updated");
      await loadScripts();
    },
    handleRefresh: () => loadScripts(true),
    handleFormat: () => {
      if (!formData.content.trim()) return;
      setFormData((prev) => ({ ...prev, content: formatNukeScript(prev.content) }));
    },
    handleResizeStart: (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = rightWidth;
      const containerW =
        splitContainerRef.current?.getBoundingClientRect().width ?? 0;
      const maxWidth = splitPanelMaxWidth(containerW, splitPanelMinWidth);
      setIsDragging(true);
      const onMove = (ev: MouseEvent) =>
        setRightWidth(
          Math.max(splitPanelMinWidth, Math.min(maxWidth, startWidth + (startX - ev.clientX))),
        );
      const onUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    splitContainerRef,
  };
}
