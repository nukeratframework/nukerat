import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchListeners } from "@/api/listeners";
import {
  listFilesRequest,
  deleteFileRequest,
  updateFileRequest,
  uploadFileRequest,
  downloadFileRequest,
} from "@/api/file_server";
import { getServers, type ServerEntry } from "@/api/system/config";
import {
  getServerOptionLabel,
  truncateServerLabel,
} from "@/components/canva/topbar/listeners/components/logic";
import { fileServerMenuRuntimeRef } from "@/components/ui/rigth-click-menu.tsx";
import { utcTableColumnTitle } from "@/components/canva/utils/utc-date";
import { tryConfirmDialogEnter } from "@/components/canva/utils/confirm-dialog-keydown";

export interface FileEntry {
  id: string;
  name: string;
  size?: string;
  upload_date?: string;
}

export const tableColumns = [
  utcTableColumnTitle("Date"),
  "Name",
  "Size",
  "Actions",
] as const;

const serverBaseKey = (ip: string, port: string) =>
  `${ip.trim().replace(/\/$/, "")}:${port.trim()}`;

export const fileServerTargetId = (serverId: string, tag: string) => `${serverId}:${tag}`;

export const tagFromFileServerTargetId = (serverId: string, targetId: string) => {
  const prefix = `${serverId}:`;
  if (!targetId.startsWith(prefix)) return "";
  return targetId.slice(prefix.length);
};

type FileServerTarget = { tag: string; label: string };

const formatFileServerTargetLabel = (listener: {
  host?: string;
  port?: string | number;
  tag?: string;
}) => {
  const host = listener.host?.trim().replace(/^https?:\/\//i, "") || "";
  const port =
    listener.port !== undefined && listener.port !== null && String(listener.port).trim() !== ""
      ? String(listener.port)
      : "";
  if (host && port) return `${host}:${port}`;
  if (host) return host;
  if (port) return port;
  return listener.tag?.trim() || "";
};

type FileServerPanelOptions = {
  onRequestUpload?: () => void;
};

export function useFileServerPanel(options?: FileServerPanelOptions) {
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [serverId, setServerId] = useState("");
  const [search, setSearch] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [targetsByServerId, setTargetsByServerId] = useState<Record<string, FileServerTarget[]>>(
    {},
  );
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState<{ old: string; next: string } | null>(null);
  const [tagOpen, setTagOpen] = useState(false);
  const [tagsLoading, setTagsLoading] = useState(false);
  const submittingRef = useRef(submitting);
  const confirmDeleteRef = useRef<() => void>(() => {});
  submittingRef.current = submitting;

  const server = servers.find((s) => s.id === serverId);
  const selectedTargetId = serverId && tag ? fileServerTargetId(serverId, tag) : "";
  const selectedTargetLabel = useMemo(() => {
    if (!serverId || !tag) return "";
    return targetsByServerId[serverId]?.find((t) => t.tag === tag)?.label ?? "";
  }, [serverId, tag, targetsByServerId]);

  useEffect(() => {
    getServers()
      .then((list) => setServers(list))
      .catch(() => {});
  }, []);

  const listenerByTargetRef = useRef<
    Record<string, { host?: string; port?: string | number; protocol?: string }>
  >({});

  const loadAllTags = useCallback(async (serverList: ServerEntry[]) => {
    setTagsLoading(true);
    try {
      const channels = await fetchListeners();
      const byServer: Record<string, FileServerTarget[]> = {};
      const listeners: Record<
        string,
        { host?: string; port?: string | number; protocol?: string }
      > = {};

      for (const s of serverList) {
        if (!s.ip?.trim() || !s.port?.trim()) continue;
        const base = serverBaseKey(s.ip, s.port);
        const matching = channels.filter(
          (l) => l?.listenerType === "file_server" && l?.tag && l?.server === base,
        );
        byServer[s.id] = matching.map((l) => ({
          tag: l.tag as string,
          label: formatFileServerTargetLabel(l),
        }));
        for (const l of matching) {
          if (!l.tag) continue;
          listeners[fileServerTargetId(s.id, l.tag)] = {
            host: l.host,
            port: l.port,
            protocol: l.protocol,
          };
        }
      }

      listenerByTargetRef.current = listeners;
      setTargetsByServerId(byServer);
      setResponse({ status: "success" });
    } finally {
      setTagsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (servers.length === 0) return;
    void loadAllTags(servers);
  }, [servers, loadAllTags]);

  useEffect(() => {
    if (!serverId && !tag) return;
    const valid = Boolean(
      serverId && tag && targetsByServerId[serverId]?.some((t) => t.tag === tag),
    );
    if (!valid) {
      setServerId("");
      setTag("");
    }
  }, [targetsByServerId]);

  const loadFiles = useCallback(async (ip: string, port: string, activeTag: string) => {
    if (!activeTag) {
      setFiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await listFilesRequest(ip, port, activeTag);
    setResponse(res);
    setFiles(Array.isArray(res?.files) ? res.files : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!server?.ip || !server?.port || !tag) {
      setFiles([]);
      setLoading(false);
      return;
    }
    loadFiles(server.ip, server.port, tag);
  }, [server?.ip, server?.port, tag, loadFiles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, search]);

  const selected = filtered.find((f) => f.id === selectedFileId) ?? null;

  useEffect(() => {
    setSelectedFileId((prev) =>
      prev && filtered.some((f) => f.id === prev) ? prev : null
    );
  }, [filtered]);

  const run = async (action: () => Promise<any>) => {
    if (!server?.ip || !server?.port || !tag) return;
    setLoading(true);
    const res = await action();
    setResponse(res);
    if (res?.status === "success") await loadFiles(server.ip, server.port, tag);
    else setLoading(false);
  };

  const searchRef = useRef(search);
  const tagRef = useRef(tag);
  const serverIdRef = useRef(serverId);
  const loadingRef = useRef(loading);
  const selectedRef = useRef(selected);
  const filesRef = useRef(filtered);
  const menuFileRef = useRef<FileEntry | null>(null);
  searchRef.current = search;
  tagRef.current = tag;
  serverIdRef.current = serverId;
  loadingRef.current = loading;
  selectedRef.current = selected;
  filesRef.current = filtered;

  const activeFile = () => menuFileRef.current ?? selectedRef.current;

  const handleRowSelect = useCallback((fileId: string) => {
    menuFileRef.current = null;
    setSelectedFileId(fileId);
  }, []);

  const handleClearSelection = useCallback(() => {
    menuFileRef.current = null;
    setSelectedFileId(null);
  }, []);

  const handleListPointerDown = useCallback(
    (target: EventTarget | null) => {
      const el = target instanceof HTMLElement ? target : null;
      if (el?.closest("tr[data-file-id]")) return;
      handleClearSelection();
    },
    [handleClearSelection],
  );

  const handleRefresh = useCallback(() => {
    if (server?.ip && server?.port) loadFiles(server.ip, server.port, tag);
  }, [server?.ip, server?.port, tag, loadFiles]);

  const refreshTags = useCallback(() => {
    void loadAllTags(servers);
  }, [loadAllTags, servers]);

  const getTagsForServer = useCallback(
    (s: ServerEntry) =>
      (targetsByServerId[s.id] ?? []).map((t) => ({
        id: fileServerTargetId(s.id, t.tag),
        name: t.label,
      })),
    [targetsByServerId],
  );

  const filterServers = useMemo(
    () => servers.filter((s) => s.ip?.trim() && s.port?.trim()),
    [servers],
  );

  const handleOpenDelete = useCallback(
    (fileName?: string) => {
      const target = fileName ?? activeFile()?.name;
      if (target) setDeleteTarget(target);
    },
    []
  );

  const handleOpenRename = useCallback(
    (fileName?: string) => {
      const target = fileName ?? activeFile()?.name;
      if (target) setRenameDraft({ old: target, next: target });
    },
    []
  );

  const handleDownload = useCallback(
    async (fileName?: string) => {
      const target = fileName ?? activeFile()?.name;
      if (!target || !server?.ip || !server?.port || !tag || !window.electronAPI) return;
      const dest = (await window.electronAPI.invoke("file:pickSavePath", {
        defaultName: target,
      })) as string | null;
      if (!dest) return;
      setLoading(true);
      const res = await downloadFileRequest(server.ip, server.port, tag, target, dest);
      setLoading(false);
      if (res?.status === "success") {
        toast.success(res.message ?? "File downloaded");
        return;
      }
      setResponse(res);
    },
    [server?.ip, server?.port, tag]
  );

  const confirm = async (action: () => Promise<any>) => {
    if (!server?.ip || !server?.port || !tag) return;
    setSubmitting(true);
    const res = await action();
    setResponse(res);
    setSubmitting(false);
    if (res?.status === "success") {
      setDeleteTarget(null);
      setRenameDraft(null);
      setLoading(true);
      await loadFiles(server.ip, server.port, tag);
    }
  };

  const controlsDisabled = () => loadingRef.current;

  const buildFileLink = () => {
    const name = activeFile()?.name?.trim();
    const targetId = fileServerTargetId(serverIdRef.current, tagRef.current);
    const listener = listenerByTargetRef.current[targetId];
    const host = listener?.host?.trim();
    const port = listener?.port;
    if (!name || !host || port === undefined || port === "") return null;
    const proto = listener?.protocol === "https" ? "https" : "http";
    return `${proto}://${host}:${port}/${encodeURIComponent(name)}`;
  };

  fileServerMenuRuntimeRef.current = {
    getSearch: () => searchRef.current,
    setSearch,
    controlsDisabled,
    canUpload: () => Boolean(tagRef.current && serverIdRef.current),
    canUseSelection: () => Boolean(activeFile()),
    canCopyLink: () => Boolean(buildFileLink()),
    copyLink: () => {
      const link = buildFileLink();
      if (link) void navigator.clipboard.writeText(link);
    },
    prepareFromTarget: (target) => {
      const el = target instanceof HTMLElement ? target : null;
      const row = el?.closest("tr[data-file-id]");
      const id = row?.getAttribute("data-file-id");
      if (!id) {
        menuFileRef.current = null;
        return;
      }
      const file = filesRef.current.find((f) => f.id === id) ?? null;
      menuFileRef.current = file;
      if (file) setSelectedFileId(file.id);
    },
    upload: () => options?.onRequestUpload?.(),
    rename: () => handleOpenRename(),
    download: () => void handleDownload(),
    deleteFile: () => handleOpenDelete(),
    refresh: handleRefresh,
  };

  useEffect(() => {
    return () => {
      fileServerMenuRuntimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!deleteTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setDeleteTarget(null);
        return;
      }
      tryConfirmDialogEnter(
        e,
        () => confirmDeleteRef.current(),
        () => submittingRef.current,
      );
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [deleteTarget]);

  useEffect(() => {
    if (!renameDraft) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setRenameDraft(null);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [renameDraft]);

  confirmDeleteRef.current = () => {
    if (!deleteTarget) return;
    void confirm(() => deleteFileRequest(server!.ip, server!.port, tag, deleteTarget));
  };

  return {
    servers: filterServers,
    serverId,
    search,
    files: filtered,
    tag,
    selectedTargetId,
    selectedTargetLabel,
    tagOpen,
    tagsLoading,
    loading,
    submitting,
    response,
    selected,
    selectedFileId,
    deleteTarget,
    renameDraft,
    serverLabel: (s: ServerEntry) => truncateServerLabel(getServerOptionLabel(s)),
    setTagOpen,
    refreshTags,
    clearTagFilter: () => {
      setServerId("");
      setTag("");
      setTagOpen(false);
    },
    selectFileServerTarget: (nextServerId: string, targetId: string) => {
      const tagName = tagFromFileServerTargetId(nextServerId, targetId);
      if (!tagName) return;
      setServerId(nextServerId);
      setTag(tagName);
      setTagOpen(false);
    },
    getTagsForServer,
    setSearch,
    setDeleteTarget,
    setRenameDraft,
    handleRefresh,
    handleRowSelect,
    handleClearSelection,
    handleListPointerDown,
    handleOpenDelete,
    handleConfirmDelete: () => {
      if (!deleteTarget) return;
      confirm(() => deleteFileRequest(server!.ip, server!.port, tag, deleteTarget));
    },
    handleOpenRename,
    handleConfirmRename: () => {
      if (!renameDraft) return;
      const next = renameDraft.next.trim();
      if (!next || next === renameDraft.old) return;
      confirm(() =>
        updateFileRequest(server!.ip, server!.port, tag, renameDraft.old, next)
      );
    },
    handleDownload,
    handleUpload: (file: File) =>
      run(() => uploadFileRequest(server!.ip, server!.port, tag, file.name, file)),
  };
}
