import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { listRowMouseDown } from "@/components/canva/utils/list-row-selection";
import { tryConfirmDialogEnter } from "@/components/canva/utils/confirm-dialog-keydown";
import { toast } from "sonner";
import { DataFetch, type Session } from "@/api/sessions";
import { formatToastMessage } from "@/components/canva/utils/toast_rules";
import {
  createCredentialRequest,
  deleteCredentialRequest,
  editCredentialRequest,
  fetchCredentials,
  isCredentialSuccess,
  type CredentialEntry,
} from "@/api/credentials";
import { credentialsMenuRuntimeRef } from "@/components/ui/rigth-click-menu.tsx";

export type FormMode = "add" | "edit";
export type PanelMode = FormMode | "view" | null;

export const TABLE_COLUMNS = ["Name", "Server", "Host Tag", "Desc"] as const;

export const tableCellTruncate =
  "inline-block max-w-[30ch] truncate align-middle";

export interface CredentialFormData {
  name: string;
  server: string;
  host: string;
  desc: string;
  content: string;
}

export const emptyForm: CredentialFormData = {
  name: "",
  server: "",
  host: "",
  desc: "",
  content: "",
};

const formFingerprint = (form: CredentialFormData) => JSON.stringify(form);

function entryToForm(entry: CredentialEntry): CredentialFormData {
  return {
    name: entry.name ?? "",
    server: entry.server ?? "",
    host: entry.host ?? "",
    desc: entry.desc ?? "",
    content: entry.content ?? "",
  };
}

export function parseCredentialServer(server: string) {
  const base = server.trim().replace(/\/+$/, "");
  const match = base.match(/^(.*):(\d+)$/);
  return match ? { host: match[1], port: match[2] } : { host: base, port: "" };
}

export function buildCredentialServer(ip: string, port: string) {
  return `${ip.trim().replace(/\/$/, "")}:${port.trim()}`;
}

export function canSubmitCredentialForm(
  form: CredentialFormData,
  mode: FormMode,
  editBaseline: string | null
) {
  if (!form.name.trim() || !form.server.trim() || !form.host.trim() || !form.content.trim()) {
    return false;
  }
  if (mode === "edit") {
    return editBaseline != null && formFingerprint(form) !== editBaseline;
  }
  return true;
}

export function useCredentialHostSelect(server: string) {
  const [hosts, setHosts] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    const collected: Session[] = [];
    DataFetch((partial) => collected.push(...partial)).then((res) => {
      setResponse(res);
      setHosts(collected);
      setLoading(false);
    });
  }, []);

  return {
    hosts: server ? hosts.filter((h) => h._server === server) : hosts,
    loading,
    response,
  };
}

export function useCredentialsPanel() {
  const [credentials, setCredentials] = useState<CredentialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [formData, setFormData] = useState<CredentialFormData>(emptyForm);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removeConfirmMode, setRemoveConfirmMode] = useState<"selected" | "all">("selected");
  const [submitting, setSubmitting] = useState(false);
  const [rightWidth, setRightWidth] = useState(380);
  const [isDragging, setIsDragging] = useState(false);
  const [editBaseline, setEditBaseline] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const selectedTagRef = useRef(selectedTag);
  selectedTagRef.current = selectedTag;
  const credentialsRef = useRef(credentials);
  credentialsRef.current = credentials;
  const submittingRef = useRef(submitting);
  const confirmRemoveRef = useRef<() => void>(() => {});
  submittingRef.current = submitting;

  const selected = credentials.find((c) => c.tag === selectedTag) ?? null;
  const closePanel = () => setPanelMode(null);

  const loadCredentials = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    const res = await fetchCredentials(ctrl.signal);
    if (ctrl.signal.aborted) return;
    if (isCredentialSuccess(res?.status)) {
      setCredentials(Array.isArray(res.credentials) ? res.credentials : []);
    } else if (res?.message !== "Cancelled") {
      toast.error(formatToastMessage(res?.message ?? "Failed to load credentials"));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCredentials();
    return () => abortRef.current?.abort();
  }, [loadCredentials]);

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
    return () => document.removeEventListener("keydown", onKey, true);
  }, [showRemoveConfirm]);

  useEffect(() => {
    if (panelMode === "edit" && selected) {
      const form = entryToForm(selected);
      setFormData(form);
      setEditBaseline(formFingerprint(form));
    } else if (panelMode !== "edit") {
      setEditBaseline(null);
    }
  }, [panelMode, selected]);

  useEffect(() => {
    if ((panelMode === "edit" || panelMode === "view") && !selected) {
      closePanel();
    }
  }, [panelMode, selected]);

  const openPanel = (entry: CredentialEntry, mode: Exclude<PanelMode, null>) => {
    setSelectedTag(entry.tag);
    setPanelMode(mode);
  };

  const handleRowClick = (tag: string) => setSelectedTag(tag);

  const handleListMouseDown = (e: ReactMouseEvent) =>
    listRowMouseDown(e, () => setSelectedTag(null));

  const handleRowDoubleClick = (tag: string) => {
    setSelectedTag(tag);
    setPanelMode("view");
  };

  const handleAdd = () => {
    setFormData(emptyForm);
    setPanelMode("add");
  };

  const handleEdit = () => {
    if (selected) openPanel(selected, "edit");
  };

  const handleFormChange = <K extends keyof CredentialFormData>(
    key: K,
    value: CredentialFormData[K]
  ) => setFormData((prev) => ({ ...prev, [key]: value }));

  const handleServerChange = (ip: string, port: string) => {
    const server = buildCredentialServer(ip, port);
    setFormData((prev) => ({
      ...prev,
      server,
      host: prev.server === server ? prev.host : "",
    }));
  };

  const handleSubmitForm = async () => {
    if (panelMode !== "add" && panelMode !== "edit") return;
    if (!canSubmitCredentialForm(formData, panelMode, editBaseline)) return;

    setSubmitting(true);
    const res =
      panelMode === "edit" && selected
        ? await editCredentialRequest(selected.tag, formData)
        : await createCredentialRequest(formData);

    if (!isCredentialSuccess(res?.status)) {
      setSubmitting(false);
      toast.error(
        formatToastMessage(
          res?.message ??
            (panelMode === "edit" ? "Failed to update credential" : "Failed to create credential")
        )
      );
      return;
    }

    setSubmitting(false);
    toast.success(res?.message ?? (panelMode === "edit" ? "Credential updated" : "Credential created"));
    closePanel();
    await loadCredentials();
  };

  const handleRemoveSelected = useCallback(() => {
    if (!selectedTagRef.current) return;
    setRemoveConfirmMode("selected");
    setPanelMode(null);
    setShowRemoveConfirm(true);
  }, []);

  const handleOpenRemoveAllConfirm = useCallback(() => {
    if (!credentialsRef.current.length || submittingRef.current) return;
    setRemoveConfirmMode("all");
    setPanelMode(null);
    setShowRemoveConfirm(true);
  }, []);

  const handleRemoveAll = useCallback(async () => {
    const list = credentialsRef.current;
    if (!list.length || submittingRef.current) return;
    setSubmitting(true);
    let failed = 0;
    let lastMessage: string | undefined;
    for (const c of list) {
      const res = await deleteCredentialRequest(c.tag, c.server);
      lastMessage = res?.message;
      if (!isCredentialSuccess(res?.status)) failed += 1;
    }
    setShowRemoveConfirm(false);
    setSelectedTag(null);
    setSubmitting(false);
    if (failed > 0) {
      toast.error(
        formatToastMessage(
          failed === list.length
            ? (lastMessage ?? "Failed to remove credentials")
            : `Failed to remove ${failed} credential${failed === 1 ? "" : "s"}`
        )
      );
    } else {
      toast.success(lastMessage ?? "Credentials removed");
    }
    await loadCredentials();
  }, [loadCredentials]);

  const handleConfirmRemove = async () => {
    if (removeConfirmMode === "all") {
      setShowRemoveConfirm(false);
      await handleRemoveAll();
      return;
    }
    if (!selected) return;
    setSubmitting(true);
    const res = await deleteCredentialRequest(selected.tag, selected.server);

    if (!isCredentialSuccess(res?.status)) {
      setSubmitting(false);
      toast.error(formatToastMessage(res?.message ?? "Failed to remove credential"));
      return;
    }

    setShowRemoveConfirm(false);
    setSelectedTag(null);
    setSubmitting(false);
    toast.success(res?.message ?? "Credential removed");
    await loadCredentials();
  };
  confirmRemoveRef.current = () => {
    void handleConfirmRemove();
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightWidth;
    const maxWidth = Math.round(2200 * 0.4);
    setIsDragging(true);
    const onMove = (ev: MouseEvent) => {
      setRightWidth(Math.max(380, Math.min(maxWidth, startWidth + (startX - ev.clientX))));
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

  credentialsMenuRuntimeRef.current = {
    getFieldValue: (key) => formDataRef.current[key],
    setFieldValue: (key, value) => handleFormChange(key, value),
    canEditFields: () => !submitting,
    prepareRowFromTarget: (target) => {
      const el = target instanceof HTMLElement ? target : null;
      const row = el?.closest("tr[data-credential-tag]");
      const tag = row?.getAttribute("data-credential-tag");
      if (!tag) return;
      selectedTagRef.current = tag;
      setSelectedTag(tag);
    },
    hasRowSelection: () => selectedTagRef.current != null,
    add: handleAdd,
    edit: handleEdit,
    removeSelected: handleRemoveSelected,
    canRemoveSelected: () => selectedTagRef.current != null,
    removeAll: handleOpenRemoveAllConfirm,
    canRemoveAll: () => credentialsRef.current.length > 0 && !submittingRef.current,
    refresh: () => void loadCredentials(),
  };

  useEffect(() => {
    return () => {
      credentialsMenuRuntimeRef.current = null;
    };
  }, []);

  return {
    credentials,
    loading,
    selectedTag,
    panelMode,
    formData,
    showRemoveConfirm,
    removeConfirmMode,
    credentialCount: credentials.length,
    submitting,
    editBaseline,
    selected,
    panelStyle,
    setShowRemoveConfirm,
    closePanel,
    openView: (entry: CredentialEntry) => openPanel(entry, "view"),
    handleRowClick,
    handleListMouseDown,
    handleRowDoubleClick,
    handleAdd,
    handleEdit,
    handleRemove: handleRemoveSelected,
    handleConfirmRemove,
    handleRefresh: loadCredentials,
    handleFormChange,
    handleServerChange,
    handleSubmitForm,
    handleResizeStart,
  };
}
