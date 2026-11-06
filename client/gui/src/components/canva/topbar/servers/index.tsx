import type { CSSProperties } from "react";
import { Edit, Plus, Trash2, RefreshCw } from "lucide-react";
import FetchToast from "@/components/canva/utils/toast_rules";
import { PanelEmptyState } from "@/components/canva/utils/panel-empty-state";
import { PanelPortal } from "@/components/canva/utils/panel-portal";
import ServerFormPanel from "./components/add";
import {
  formatServerHost,
  formatServerProtocol,
  useServerPanel,
  type ConnectionStatus,
} from "./components/logic";

const StatusDot = ({ status }: { status: ConnectionStatus }) => (
  <span
    title={status === "checking" ? "Checking..." : status.charAt(0).toUpperCase() + status.slice(1)}
    className="inline-flex items-center justify-center w-4 h-4"
  >
    {status === "checking" ? (
      <RefreshCw size={9} className="animate-spin text-[#555]" />
    ) : (
      <span
        className={`w-2 h-2 rounded-full ${
          status === "online" ? "bg-[#4caf75]" : status === "unauthorized" ? "bg-[#e89b3c]" : "bg-[#c97070]"
        }`}
      />
    )}
  </span>
);

const ServerPanel = () => {
  const {
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
    response,
    splitContainerRef,
  } = useServerPanel();

  return (
    <div className="flex flex-col h-full bg-[#171717] text-[#d4d4d4] font-mono text-[12px] select-none overflow-hidden">
      <FetchToast response={response} />
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
                      {["Status", "Name", "Protocol", "IP", "Port"].map((col) => (
                        <th
                          key={col}
                          className="sticky top-0 z-10 bg-[#171717] text-left px-4 py-2 text-[12px] text-[#888888] font-medium uppercase tracking-widest whitespace-nowrap border-b border-[#252525]"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  {servers.length > 0 && (
                    <tbody>
                      {servers.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => handleRowClick(s.id)}
                        onDoubleClick={() => openEditPanel(s)}
                        className={`border-b border-[#222] cursor-pointer transition-colors ${
                          selectedId === s.id
                            ? "bg-[#282828]"
                            : "hover:bg-[#212121]"
                        }`}
                      >
                        <td className="px-4 py-2 w-7 text-[13.5px] text-center">
                          <StatusDot status={statuses[s.id] ?? "idle"} />
                        </td>
                        <td className="px-4 py-2 text-[13.5px] text-[#d4d4d4] font-medium">
                          <span title={s.name} className="block max-w-[25ch] truncate">
                            {s.name}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-[13.5px] lowercase text-[#cecece]">
                          <span title={formatServerProtocol(s)} className="block max-w-[25ch] truncate">
                            {formatServerProtocol(s)}
                          </span>
                        </td>
                        <td className="cursor-text select-text px-4 py-2 text-[13.5px] text-[#cecece]">
                          <span title={formatServerHost(s)} className="block max-w-[25ch] truncate">
                            {formatServerHost(s)}
                          </span>
                        </td>
                        <td className="cursor-text select-text px-4 py-2 text-[13.5px] text-[#cecece]">
                          <span title={String(s.port)} className="block max-w-[25ch] truncate">
                            {s.port}
                          </span>
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  )}
                </table>
                {servers.length === 0 && <PanelEmptyState>No servers configured</PanelEmptyState>}
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
              onClick={handleEdit}
              disabled={!selected}
              className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
            >
              <Edit size={11} />
              Edit
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={!selected}
              className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] font-medium text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#c97070] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
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
            className="z-10 bg-[#171717] hidden md:flex w-2 shrink-0 cursor-col-resize items-center justify-center group transition-colors border-l border-l-[#2a2a2a]"
            onMouseDown={handleResizeStart}
          />
        )}

        <div
          className={`flex flex-col h-full min-h-0 min-w-0 bg-[#181818] overflow-x-auto overflow-y-hidden absolute inset-0 md:relative md:inset-auto md:max-w-full shrink transition-transform md:transition-[width] duration-300 ease-in-out z-999 ${
            panelMode !== null
              ? "translate-x-0 md:w-[var(--panel-width,720px)] border-l border-[#2a2a2a]"
              : "translate-x-full md:translate-x-0 md:w-0 pointer-events-none overflow-hidden"
          }`}
          style={{
            zIndex: 10,
            ...(panelMode !== null
              ? ({ "--panel-width": `${rightWidth}px` } as CSSProperties)
              : {}),
            ...(isDragging ? { transition: "none" } : {}),
          }}
        >
          {panelMode !== null && (
            <ServerFormPanel
              mode={panelMode}
              selectedName={selected?.name}
              formData={formData}
              submitting={submitting}
              handleClosePanel={() => setPanelMode(null)}
              handleAuth={handleAuth}
              handleClearAuth={handleClearAuth}
              canClearAuth={canClearAuth}
              handleFormChange={handleFormChange}
            />
          )}
        </div>
      </div>

      {showRemoveConfirm && (
        <PanelPortal>
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-[#00000085]">
          <div style={{ borderRadius: "8px" }} className="bg-[#191919] border border-[#2f2f2f] p-5 max-w-sm w-[90%] shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Trash2 size={13} className="text-[#c97070]" />
              <span className="text-[13.5px] font-semibold text-[#d4d4d4]">
                Remove server
              </span>
            </div>
            <p className="text-[13.5px] text-[#9b9b9b] mb-5 leading-relaxed">
              Remove{" "}
              <span className="inline-block max-w-[180px] align-bottom overflow-hidden text-ellipsis whitespace-nowrap text-[#d4d4d4] font-semibold">
                "{selected?.name}"
              </span>
              ? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowRemoveConfirm(false)}
                className="button-default px-3 py-1 rounded text-[13px] text-[#9b9b9b] hover:text-[#d4d4d4] hover:bg-[#252525] transition-colors border border-[#333] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemove}
                disabled={submitting}
                className="button-default flex items-center gap-1.5 px-3 py-1 rounded text-[13px] text-white bg-[#852b2b] hover:bg-[#a83232] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting && (
                  <RefreshCw size={10} className="animate-spin" />
                )}
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

export default ServerPanel;
