import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  splitPanelDefaultWidth,
  splitPanelMaxWidth,
  splitPanelMinWidth,
} from "@/components/canva/utils/split-panel";
import { toast } from "sonner";
import { listRowMouseDown } from "@/components/canva/utils/list-row-selection";
import { fetchSessions, type Session } from "@/api/sessions";
import {
  createReportRequest,
  deleteReportRequest,
  downloadReportRequest,
  fetchReports,
  saveReportFile,
  viewReportRequest,
  resolveReportFileType,
  type ReportEntry,
  type ReportFileType,
  type ReportType,
} from "@/api/reports";
import { topbarFloatEscapeBlockRef } from "@/components/canva/shortcuts";
import { tryConfirmDialogEnter } from "@/components/canva/utils/confirm-dialog-keydown";
import { formatUtcDateOnly, utcTableColumnTitle } from "@/components/canva/utils/utc-date";

export const table_columns = ["Name", "File", "Type", "Server", "Hosts", utcTableColumnTitle("Created")] as const;

export const tableHeaderClassName = (col: (typeof table_columns)[number]) =>
  col === "File" || col === utcTableColumnTitle("Created")
    ? "text-left px-4 py-2 text-[12px] text-[#888888] font-medium uppercase tracking-widest whitespace-nowrap"
    : "text-left px-4 py-2 text-[12px] text-[#888888] font-medium uppercase tracking-widest whitespace-nowrap";

export const getReportRowId = (r: ReportEntry) => `${r.server ?? ""}-${r.tag}`;

export const reportFileTypeLabel = (entry: ReportEntry) => resolveReportFileType(entry);

export const report_type_options: { value: ReportType; label: string }[] = [
  { value: "activity", label: "Activity Report" },
  { value: "hosts", label: "Hosts Report" },
  { value: "ioc", label: "Indicators of Compromise" },
];

export const reportTypeLabel = (value?: string) =>
  report_type_options.find((o) => o.value === value)?.label ?? value ?? "-";

export const report_file_type_options: { value: ReportFileType; label: string }[] = [
  { value: "pdf", label: "pdf" },
  { value: "html", label: "html" },
  { value: "json", label: "json" },
];

export interface ReportFormData {
  name: string;
  description: string;
  server: string;
  reportType: ReportType;
  fileType: ReportFileType;
  hostTags: string[];
  hideCredentials: boolean;
}

export const empty_form: ReportFormData = {
  name: "",
  description: "",
  server: "",
  reportType: "activity",
  fileType: "pdf",
  hostTags: [],
  hideCredentials: false,
};

export const canSubmitReportForm = (form: ReportFormData, submitting: boolean) =>
  !submitting && form.name.trim().length > 0 && form.server.trim().length > 0;

export function useReportsPanel() {
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [hosts, setHosts] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [hostsLoading, setHostsLoading] = useState(true);
  const [panelMode, setPanelMode] = useState<"add" | null>(null);
  const [formData, setFormData] = useState<ReportFormData>(empty_form);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const confirmRemoveRef = useRef<() => void>(() => {});
  const submittingRef = useRef(submitting);
  submittingRef.current = submitting;
  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewHtml, setViewHtml] = useState<string | null>(null);
  const [viewTitle, setViewTitle] = useState("");
  const [rightWidth, setRightWidth] = useState(splitPanelDefaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const selected = reports.find((r) => getReportRowId(r) === selectedRowId) ?? null;

  const serverHosts = useMemo(() => {
    if (!formData.server.trim()) return hosts;
    return hosts.filter((h) => h._server === formData.server);
  }, [hosts, formData.server]);

  const refreshReports = useCallback(async () => {
    setLoading(true);
    const res = await fetchReports();
    setLoading(false);
    if (res?.status === "success") {
      setReports(Array.isArray(res.reports) ? res.reports : []);
    } else {
      setReports([]);
      toast.error(res?.message ?? "Failed to fetch reports");
    }
  }, []);

  const refreshHosts = useCallback(async () => {
    setHostsLoading(true);
    const res = await fetchSessions("default");
    setHostsLoading(false);
    if (res?.status === "success" && Array.isArray(res.sessions)) {
      setHosts(res.sessions);
    } else {
      setHosts([]);
    }
  }, []);

  useEffect(() => {
    refreshReports();
    refreshHosts();
  }, [refreshReports, refreshHosts]);

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

  const handleCloseView = useCallback(() => {
    setViewOpen(false);
    setViewHtml(null);
    setViewTitle("");
  }, []);

  const handleAdd = () => {
    setFormData(empty_form);
    setPanelMode("add");
  };

  const handleFormChange = <K extends keyof ReportFormData>(key: K, value: ReportFormData[K]) => {
    setFormData((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "server") {
        next.hostTags = [];
      }
      return next;
    });
  };

  const handleServerChange = (host: string, port: string) => {
    handleFormChange("server", `${host.trim().replace(/\/$/, "")}:${port.trim()}`);
  };

  const toggleHost = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      hostTags: prev.hostTags.includes(tag)
        ? prev.hostTags.filter((x) => x !== tag)
        : [...prev.hostTags, tag],
    }));
  };

  const selectAllHosts = () => {
    setFormData((prev) => ({
      ...prev,
      hostTags: serverHosts.map((h) => h.tag).filter(Boolean),
    }));
  };

  const clearHosts = () => {
    setFormData((prev) => ({ ...prev, hostTags: [] }));
  };

  const handleSubmitForm = async () => {
    if (!canSubmitReportForm(formData, submitting)) return;
    setSubmitting(true);
    const hostTags =
      formData.hostTags.length > 0
        ? formData.hostTags
        : serverHosts.map((h) => h.tag).filter(Boolean);
    const res = await createReportRequest(
      {
        name: formData.name.trim(),
        description: formData.description.trim(),
        reportType: formData.reportType,
        fileType: formData.fileType,
        hostTags,
        hideCredentials: formData.reportType === "activity" ? formData.hideCredentials : false,
      },
      formData.server,
    );
    setSubmitting(false);
    if (res?.status !== "success") {
      toast.error(res?.message ?? "Failed to create report");
      return;
    }
    toast.success(res?.message ?? "Report created");
    setPanelMode(null);
    await refreshReports();
  };

  const handleRowClick = (rowId: string) => {
    setSelectedRowId(rowId);
  };

  const handleListMouseDown = (e: React.MouseEvent) =>
    listRowMouseDown(e, () => setSelectedRowId(null));

  const handleDownload = async () => {
    if (!selected?.tag || !selected.server) return;
    setSubmitting(true);
    const res = await downloadReportRequest(selected.tag, selected.server);
    setSubmitting(false);
    if (res?.status !== "success" || !res.content) {
      toast.error(res?.message ?? "Failed to download report");
      return;
    }
    const fileType = resolveReportFileType(selected, res);
    saveReportFile(
      res.content,
      res.file || `${selected.name}.${fileType}`,
      fileType,
    );
    toast.success("Report downloaded");
  };

  const openReportView = useCallback(
    async (report: ReportEntry) => {
      if (!report.tag || !report.server || viewLoading) return;
      setViewTitle(report.name || "Report");
      setViewHtml(null);
      setViewOpen(true);
      setViewLoading(true);
      const res = await viewReportRequest(report.tag, report.server);
      setViewLoading(false);
      if (res?.status !== "success" || !res.html) {
        toast.error(res?.message ?? "Failed to load report");
        handleCloseView();
        return;
      }
      setViewHtml(res.html);
    },
    [viewLoading, handleCloseView],
  );

  const handleView = async () => {
    if (!selected) return;
    await openReportView(selected);
  };

  const handleRowDoubleClick = (rowId: string) => {
    setSelectedRowId(rowId);
    const report = reports.find((r) => getReportRowId(r) === rowId);
    if (report) void openReportView(report);
  };

  const handleConfirmRemove = async () => {
    if (!selected?.tag || !selected.server) return;
    setSubmitting(true);
    const res = await deleteReportRequest(selected.tag, selected.server);
    setSubmitting(false);
    setShowRemoveConfirm(false);
    if (res?.status !== "success") {
      toast.error(res?.message ?? "Failed to remove report");
      return;
    }
    setSelectedRowId(null);
    toast.success(res?.message ?? "Report removed");
    await refreshReports();
  };
  confirmRemoveRef.current = () => {
    void handleConfirmRemove();
  };

  const handleOpenRemoveConfirm = () => {
    if (selected) setShowRemoveConfirm(true);
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightWidth;
    setIsDragging(true);
    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      const containerW =
        splitContainerRef.current?.getBoundingClientRect().width ?? 0;
      const maxWidth = splitPanelMaxWidth(containerW, splitPanelMinWidth);
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

  const formatDate = (raw?: string) => formatUtcDateOnly(raw);

  const panelStyle =
    panelMode !== null
      ? ({
          "--panel-width": `${rightWidth}px`,
          ...(isDragging ? { transition: "none" } : {}),
        } as React.CSSProperties)
      : {};

  return {
    reports,
    loading,
    hostsLoading,
    serverHosts,
    panelMode,
    formData,
    submitting,
    selected,
    selectedRowId,
    showRemoveConfirm,
    viewOpen,
    viewLoading,
    viewHtml,
    viewTitle,
    panelStyle,
    setPanelMode,
    setShowRemoveConfirm,
    handleCloseView,
    handleAdd,
    handleFormChange,
    handleServerChange,
    toggleHost,
    selectAllHosts,
    clearHosts,
    handleSubmitForm,
    handleRowClick,
    handleRowDoubleClick,
    handleListMouseDown,
    handleDownload,
    handleView,
    handleOpenRemoveConfirm,
    handleConfirmRemove,
    handleResizeStart,
    handleRefresh: refreshReports,
    formatDate,
    splitContainerRef,
  };
}
