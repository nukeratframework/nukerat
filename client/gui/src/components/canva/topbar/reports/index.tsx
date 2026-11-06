import { Plus, RefreshCw, Trash2, Download, Eye } from "lucide-react";
import { PanelEmptyState } from "@/components/canva/utils/panel-empty-state";
import { UtcTableColumnHeader } from "@/components/canva/utils/utc-date";
import { PanelPortal } from "@/components/canva/utils/panel-portal";
import CreateReportPanel from "./components/create";
import ReportViewDialog from "./components/view-dialog";
import {
  getReportRowId,
  table_columns,
  tableHeaderClassName,
  reportFileTypeLabel,
  reportTypeLabel,
  useReportsPanel,
} from "./components/logic";

const ReportsPanel = () => {
  const {
    reports,
    loading,
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
    handleRefresh,
    formatDate,
    splitContainerRef,
  } = useReportsPanel();

  return (
    <div className="flex flex-col h-full bg-[#171717] text-[#d4d4d4] font-mono text-[12px] select-none overflow-hidden">
      <div ref={splitContainerRef} className="flex flex-1 min-h-0 relative overflow-hidden">
        <div className="flex flex-col min-w-0 flex-1">
          <div
            className="flex-1 min-w-0 overflow-auto flex flex-col min-h-0"
            onMouseDown={handleListMouseDown}
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
                      {table_columns.map((col) => (
                        <th key={col} className={tableHeaderClassName(col)}>
                          <UtcTableColumnHeader label={col} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  {reports.length > 0 && (
                    <tbody>
                      {reports.map((r) => {
                        const rowId = getReportRowId(r);
                        const isSelected = selectedRowId === rowId;
                        return (
                          <tr
                            key={rowId}
                            onClick={() => handleRowClick(rowId)}
                            onDoubleClick={() => handleRowDoubleClick(rowId)}
                            className={`border-b border-[#222] cursor-pointer transition-colors ${
                              isSelected ? "bg-[#3a3a3a]" : "hover:bg-[#232323]"
                            }`}
                          >
                            <td className="px-4 py-2 text-[13.5px] text-[#cecece] whitespace-nowrap max-w-[180px] truncate">
                              {r.name}
                            </td>
                            <td className="px-4 py-2 text-[13.5px] text-[#9b9b9b] whitespace-nowrap lowercase tabular-nums">
                              {reportFileTypeLabel(r)}
                            </td>
                            <td className="px-4 py-2 text-[13.5px] text-[#9b9b9b] whitespace-nowrap">
                              {reportTypeLabel(r.reportType)}
                            </td>
                            <td className="px-4 py-2 text-[13.5px] text-[#9b9b9b] whitespace-nowrap max-w-[160px] truncate">
                              {r.server || "-"}
                            </td>
                            <td className="px-4 py-2 text-[13.5px] text-[#9b9b9b] whitespace-nowrap">
                              {Array.isArray(r.hosts) ? r.hosts.length : 0}
                            </td>
                            <td className="px-4 py-2 text-[13.5px] text-[#9b9b9b] whitespace-nowrap">
                              {formatDate(r.created_at)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  )}
                </table>
                {reports.length === 0 && <PanelEmptyState>No reports generated yet</PanelEmptyState>}
              </>
            )}
          </div>

          <div className="flex min-w-0 w-full shrink-0 flex-nowrap items-center gap-2 overflow-x-auto border-t border-[#292929] p-2">
            <button
              type="button"
              onClick={handleAdd}
              className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] cursor-pointer"
            >
              <Plus size={11} />
              New
            </button>
            <button
              type="button"
              onClick={handleView}
              disabled={!selected || viewLoading}
              className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
            >
              {viewLoading ? <RefreshCw size={11} className="animate-spin" /> : <Eye size={11} />}
              View
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!selected || submitting}
              className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
            >
              <Download size={11} />
              Download
            </button>
            <button
              type="button"
              onClick={handleOpenRemoveConfirm}
              disabled={!selected}
              className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#c97070] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
            >
              <Trash2 size={11} />
              Remove
            </button>
            <div className="min-w-2 flex-1 shrink" aria-hidden />
            <button
              type="button"
              onClick={handleRefresh}
              className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] cursor-pointer"
            >
              <RefreshCw size={11} />
              Update
            </button>
          </div>
        </div>

        {panelMode !== null && (
          <div
            style={{ backgroundColor: "#171717" }}
            className="z-20 bg-[#171717] hidden md:flex w-2 shrink-0 cursor-col-resize items-center justify-center group transition-colors border-l border-l-[#2a2a2a]"
            onMouseDown={handleResizeStart}
          />
        )}

        <div
          className={`flex flex-col h-full min-h-0 min-w-0 bg-[#181818] overflow-x-auto overflow-y-hidden absolute inset-0 md:relative md:inset-auto md:max-w-full shrink transition-transform md:transition-[width] duration-300 ease-in-out z-20 ${
            panelMode !== null
              ? "translate-x-0 md:w-[var(--panel-width,720px)] border-l border-[#2a2a2a]"
              : "translate-x-full md:translate-x-0 md:w-0 pointer-events-none overflow-hidden"
          }`}
          style={{ zIndex: 10, ...panelStyle }}
        >
          {panelMode === "add" && (
            <CreateReportPanel
              formData={formData}
              submitting={submitting}
              serverHosts={serverHosts}
              handleFormChange={handleFormChange}
              handleServerChange={handleServerChange}
              toggleHost={toggleHost}
              selectAllHosts={selectAllHosts}
              clearHosts={clearHosts}
              handleClosePanel={() => setPanelMode(null)}
              handleSubmitForm={handleSubmitForm}
            />
          )}
        </div>
      </div>

      {showRemoveConfirm && (
        <PanelPortal>
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-[#00000085]">
          <div
            style={{ borderRadius: "8px" }}
            className="bg-[#191919] border border-[#2f2f2f] p-5 max-w-sm w-[90%] shadow-2xl"
          >
            <div className="flex items-center gap-2 mb-3">
              <Trash2 size={14} className="text-[#c97070] mb-0.5" />
              <span className="text-[13.5px] font-semibold text-[#cecece]">Remove Report</span>
            </div>
            <p className="text-[13px] text-[#9b9b9b] mb-5 leading-relaxed">
              Remove{" "}
              <span className="text-[#d4d4d4] text-[13px] font-semibold">
                "
                {selected?.name && selected.name.length > 20
                  ? `${selected.name.slice(0, 20)}...`
                  : selected?.name}
                "
              </span>
              ? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowRemoveConfirm(false)}
                className="button-default px-3 py-1 rounded text-[12px] text-[#9b9b9b] hover:text-[#d4d4d4] hover:bg-[#252525] transition-colors border border-[#333] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemove}
                disabled={submitting}
                className="button-default flex items-center gap-1.5 px-3 py-1 rounded text-[12px] text-white bg-[#8b2020] hover:bg-[#a83232] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting && <RefreshCw size={10} className="animate-spin" />}
                Remove
              </button>
            </div>
          </div>
        </div>
        </PanelPortal>
      )}

      <ReportViewDialog
        open={viewOpen}
        loading={viewLoading}
        title={viewTitle}
        html={viewHtml}
        onOpenChange={(open) => {
          if (!open) handleCloseView();
        }}
      />
    </div>
  );
};

export default ReportsPanel;
