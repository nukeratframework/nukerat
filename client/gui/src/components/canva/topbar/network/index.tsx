import { Plus, Trash2, RefreshCw, Eye } from "lucide-react";
import { PanelEmptyState } from "@/components/canva/utils/panel-empty-state";
import { PanelPortal } from "@/components/canva/utils/panel-portal";
import {
  TABLE_COLUMNS,
  formatForward,
  formatProtocol,
  getRowId,
  typeLabel,
  useNetworkPanel,
} from "./components/logic";
import AddNetworkPanel from "./components/add";
import ViewNetworkPanel from "./components/view";

const NetworkPanel = () => {
  const {
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
    handleAdd,
    handleFormChange,
    handleSubmitForm,
    handleConfirmRemove,
    handleResizeStart,
    handleOpenRemoveConfirm,
    handleOpenView,
    handleRefresh,
    hostGroups,
    hostsLoading,
    splitContainerRef,
  } = useNetworkPanel();

  return (
    <div className="flex flex-col h-full bg-[#171717] text-[#d4d4d4] text-[12px] select-none overflow-hidden">
      <div
        ref={splitContainerRef}
        className="flex flex-1 min-h-0 min-w-0 relative overflow-hidden"
      >
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
                <table className="w-full border-separate border-spacing-0 shrink-0">
                  <thead>
                    <tr>
                      {TABLE_COLUMNS.map((col) => (
                        <th
                          key={col}
                          className="sticky top-0 z-10 bg-[#171717] text-left px-4 py-2 text-[12px] text-[#888888] font-medium uppercase tracking-widest whitespace-nowrap border-b border-[#252525]"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  {items.length > 0 && (
                    <tbody>
                      {items.map((c, index) => {
                        const rowId = getRowId(c, index);
                        const isSelected = selectedRowId === rowId;
                        const hostLabel = c.hostTag?.trim() || "-";
                        const type = typeLabel(c.networkType);
                        const portLabel = c.targetPort || "-";
                        const forwardLabel = formatForward(c);
                        const protocolLabel = formatProtocol(c);
                        const serverLabel = c.server ?? "-";
                        return (
                          <tr
                            key={rowId}
                            onClick={() => handleRowClick(rowId)}
                            onDoubleClick={() => handleRowDoubleClick(rowId)}
                            className={`border-b border-[#222] cursor-pointer transition-colors ${
                              isSelected ? "bg-[#3a3a3a]" : "hover:bg-[#232323]"
                            }`}
                          >
                            <td className="px-4 py-2 text-[13.5px] text-[#cecece] font-medium">
                              <span title={hostLabel} className="block max-w-[25ch] truncate">
                                {hostLabel}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-[13.5px] text-[#cecece]">
                              <span title={type} className="block max-w-[25ch] truncate">
                                {type}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-[13.5px] text-[#cecece]">
                              <span title={String(portLabel)} className="block max-w-[25ch] truncate">
                                {portLabel}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-[13.5px] text-[#cecece]">
                              <span title={forwardLabel} className="block max-w-[25ch] truncate">
                                {forwardLabel}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-[13.5px] text-[#cecece]">
                              <span title={protocolLabel} className="block max-w-[25ch] truncate">
                                {protocolLabel}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-[13.5px] text-[#9b9b9b]">
                              <span title={serverLabel} className="block max-w-[25ch] truncate">
                                {serverLabel}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  )}
                </table>
                {items.length === 0 && <PanelEmptyState>No connections configured</PanelEmptyState>}
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
              Add
            </button>
            <button
              type="button"
              onClick={handleOpenView}
              disabled={!selected}
              className="button-default z-10 flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
            >
              <Eye size={11} />
              View
            </button>
            <button
              type="button"
              onClick={handleOpenRemoveConfirm}
              disabled={!selected}
              className="button-default z-10 flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#c97070] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
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
          style={{
            zIndex: 10,
            ...panelStyle,
          }}
        >
          {panelMode === "add" && (
            <AddNetworkPanel
              formData={formData}
              handleFormChange={handleFormChange}
              submitting={submitting}
              handleClosePanel={() => setPanelMode(null)}
              handleSubmitForm={handleSubmitForm}
              hostGroups={hostGroups}
              hostsLoading={hostsLoading}
            />
          )}
          {panelMode === "view" && (
            <ViewNetworkPanel
              connection={selected}
              handleClosePanel={() => setPanelMode(null)}
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
              <span className="text-[13.5px] font-semibold text-[#cecece]">
                Remove Connection
              </span>
            </div>
            <p className="text-[13px] text-[#9b9b9b] mb-5 leading-relaxed">
              Remove{" "}
              <span className="text-[#d4d4d4] text-[13px] font-semibold">
                "{typeLabel(selected?.networkType)}"
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
    </div>
  );
};

export default NetworkPanel;
