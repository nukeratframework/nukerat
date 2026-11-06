import { useRef } from "react";
import type { IDockviewPanelProps } from "dockview";
import { Download, Pencil, RefreshCw, Trash2, Upload, X } from "lucide-react";
import AgentModelFilter from "@/components/canva/workspace/agent/components/model-filter";
import { Button } from "@/components/ui/button";
import FetchToast from "@/components/canva/utils/toast_rules";
import { PanelEmptyState } from "@/components/canva/utils/panel-empty-state";
import { UtcTableColumnHeader } from "@/components/canva/utils/utc-date";
import { tableColumns, useFileServerPanel } from "./components/logic";
import { FileServerDockviewShell } from "./components/rigth-click-menu";

const fileServerSelectTriggerClass =
  "h-[29px] w-[16.25rem] shrink-0 rounded border border-[#363636] bg-[#212121] py-0 text-[13.5px] text-[#cecece] focus:border-[#555] focus-visible:ring-0";

const rowActionIconBtn =
  "button-default size-7 shrink-0 border-none bg-transparent p-0 text-[#888] shadow-none hover:bg-transparent hover:text-[#cecece] disabled:opacity-25";

const FileServerPanel = (props: IDockviewPanelProps) => {
  const uploadRef = useRef<HTMLInputElement>(null);
  const {
    servers,
    search,
    files,
    tag,
    selectedTargetId,
    selectedTargetLabel,
    tagOpen,
    tagsLoading,
    loading,
    response,
    selectedFileId,
    serverLabel,
    setTagOpen,
    refreshTags,
    clearTagFilter,
    selectFileServerTarget,
    getTagsForServer,
    setSearch,
    handleRefresh,
    handleRowSelect,
    handleListPointerDown,
    handleOpenDelete,
    handleConfirmDelete,
    handleOpenRename,
    handleConfirmRename,
    handleDownload,
    handleUpload,
    setDeleteTarget,
    setRenameDraft,
    deleteTarget,
    renameDraft,
    submitting,
  } = useFileServerPanel({
    onRequestUpload: () => uploadRef.current?.click(),
  });

  return (
    <FileServerDockviewShell api={props.api}>
    <div className="flex flex-col h-full bg-[#171717] text-[#d4d4d4] font-mono text-[12px] overflow-hidden">
      <FetchToast response={response} />
      <div className="shrink-0 min-w-0 overflow-x-auto border-b border-[#252525] bg-[#171717]">
        <div className="box-border flex w-full flex-nowrap items-center gap-2 p-2">
          <AgentModelFilter
            servers={servers}
            getAgentsForServer={getTagsForServer}
            serverLabel={serverLabel}
            loading={tagsLoading}
            model={tag}
            displayLabel={selectedTargetLabel}
            selectedId={selectedTargetId}
            open={tagOpen}
            triggerClassName={`button-default justify-between gap-1 px-2.5 font-normal outline-none hover:bg-[#212121] disabled:cursor-not-allowed disabled:opacity-50 ${fileServerSelectTriggerClass} ${tag ? "pr-7" : ""}`}
            onOpen={setTagOpen}
            onRefresh={refreshTags}
            onSelectItem={(option, s) => selectFileServerTarget(s.id, option.id)}
            onClear={clearTagFilter}
            placeholder="Select a server"
            searchPlaceholder="Search server..."
            emptyLabel="No server found."
            clearAriaLabel="Clear server"
          />
          <div className="relative min-w-[8rem] flex-1 shrink-0" data-file-server-search-input>
            <input
              data-file-server-search-field="search"
              className="box-border h-[29px] w-full rounded border border-[#363636] bg-[#212121] py-0 pl-3 pr-8 text-[13.5px] text-[#cecece] outline-none transition-colors placeholder:text-[#444] focus:border-[#555]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files..."
              autoComplete="off"
              spellCheck={false}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="button-default absolute right-2 top-1/2 -translate-y-1/2 border-none bg-transparent p-0 text-[#555] hover:text-[#cecece] cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div
        className="flex-1 overflow-auto flex flex-col min-h-0"
        onMouseDown={(e) => handleListPointerDown(e.target)}
      >
        {loading ? (
          <div className="flex items-center justify-center h-16 text-[#444] text-[13.5px]">
            <RefreshCw size={14} className="animate-spin mr-2" />
            Loading...
          </div>
        ) : (
          <>
            <table className="w-full border-collapse shrink-0">
              <thead>
                <tr className="bg-[#171717] border-b border-[#252525]">
                  {tableColumns.map((col) => (
                    <th
                      key={col}
                      className={`px-3 py-2 text-[12px] text-[#888888] font-medium uppercase tracking-widest whitespace-nowrap ${
                        col === "Name"
                          ? "!text-left !pl-[.9rem]"
                          : col === "Actions"
                            ? "!text-center"
                            : ""
                      }`}
                    >
                      <UtcTableColumnHeader label={col} />
                    </th>
                  ))}
                </tr>
              </thead>
              {files.length > 0 && (
                <tbody id="file-server-file-list">
                  {files.map((file) => {
                    const isSelected = selectedFileId === file.id;
                    return (
                  <tr
                    key={file.id}
                    data-file-id={file.id}
                    onMouseEnter={() => handleRowSelect(file.id)}
                    className={`border-b border-[#222] cursor-pointer transition-colors ${
                      isSelected ? "bg-[#3a3a3a]" : "hover:bg-[#232323]"
                    }`}
                  >
                    <td className="px-3 py-2 text-[13px] text-[#9b9b9b] whitespace-nowrap">
                      {file.upload_date?.trim() || "-"}
                    </td>
                    <td className="px-3 py-2 !text-left !pl-[.9rem] text-[13.5px] text-[#cecece] truncate" title={file.name}>
                      {file.name}
                    </td>
                    <td className="px-3 py-2 text-[13px] text-[#9b9b9b] whitespace-nowrap">
                      {file.size || "-"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-center">
                      <div
                        className="inline-flex items-center justify-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Download"
                          disabled={loading || !tag}
                          onClick={() => handleDownload(file.name)}
                          className={rowActionIconBtn}
                        >
                          <Download size={14} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Rename"
                          disabled={loading || !tag}
                          onClick={() => handleOpenRename(file.name)}
                          className={rowActionIconBtn}
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Delete"
                          disabled={loading || !tag}
                          onClick={() => handleOpenDelete(file.name)}
                          className={`${rowActionIconBtn} hover:text-[#c97070]`}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                    );
                  })}
                </tbody>
              )}
            </table>
            {files.length === 0 && (
              <PanelEmptyState>
                {!tag ? "Select a server to view files" : "No files found"}
              </PanelEmptyState>
            )}
          </>
        )}
      </div>

      <div className="flex min-w-0 w-full shrink-0 flex-nowrap items-center gap-2 overflow-x-auto border-t border-[#292929] p-2">
        <button
          type="button"
          onClick={() => uploadRef.current?.click()}
          disabled={!tag || loading}
          className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
        >
          <Upload size={11} />
          Upload
        </button>
        <input
          ref={uploadRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            if (uploadRef.current) uploadRef.current.value = "";
          }}
        />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || !tag}
            className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
          >
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
            Update
          </button>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div style={{ borderRadius: "8px" }} className="bg-[#191919] border border-[#2f2f2f] p-5 max-w-sm w-[90%] shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Trash2 size={14} className="text-[#c97070] mb-0.5" />
              <span className="text-[13.5px] font-semibold text-[#cecece]">
                Delete File
              </span>
            </div>
            <p className="text-[13px] text-[#9b9b9b] mb-5 leading-relaxed">
              Delete{" "}
              <span className="text-[#d4d4d4] text-[13px] font-semibold">
                "{deleteTarget.length > 80 ? `${deleteTarget.slice(0, 80)}...` : deleteTarget}"
              </span>
              ? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="button-default flex items-center gap-1.5 px-3 py-1 rounded bg-[#232323] text-[#cecece] text-[13px] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] transition-colors border border-[#333] cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={submitting}
                className="button-default flex items-center gap-1.5 px-3 py-1 rounded text-[12px] text-white bg-[#8b2020] hover:bg-[#a83232] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting && <RefreshCw size={10} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {renameDraft && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div style={{ borderRadius: "8px" }} className="bg-[#191919] border border-[#2f2f2f] p-5 max-w-sm w-[90%] shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Pencil size={14} className="text-[#c8c8c8] mb-0.5" />
              <span className="text-[13.5px] font-semibold text-[#cecece]">
                Rename File
              </span>
            </div>
            <input
              autoFocus
              value={renameDraft.next}
              onChange={(e) =>
                setRenameDraft((prev) =>
                  prev ? { ...prev, next: e.target.value } : null
                )
              }
              className="w-full bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] transition-colors"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setRenameDraft(null)}
                className="button-default px-3 py-1 rounded text-[12px] text-[#9b9b9b] hover:text-[#d4d4d4] hover:bg-[#252525] transition-colors border border-[#333] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRename}
                disabled={
                  submitting ||
                  !renameDraft.next.trim() ||
                  renameDraft.next.trim() === renameDraft.old
                }
                className="button-default flex items-center gap-1.5 px-3 py-1 rounded text-[12px] text-white bg-[#232323] hover:bg-[#2b2b2b] transition-colors border border-[#333] disabled:opacity-50 cursor-pointer"
              >
                {submitting && <RefreshCw size={10} className="animate-spin" />}
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </FileServerDockviewShell>
  );
};

export default FileServerPanel;
