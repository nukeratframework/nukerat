import { Edit, Plus, Trash2, RefreshCw } from "lucide-react";
import { PanelEmptyState } from "@/components/canva/utils/panel-empty-state";
import { PanelPortal } from "@/components/canva/utils/panel-portal";
import AgentFormPanel from "./components/edit";
import { table_columns, truncateTableCell, useAgentsPanel } from "./components/logic";

const AgentsPanel = () => {
  const {
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
    handleRefresh,
    splitContainerRef,
  } = useAgentsPanel();

  return (
    <div className="flex flex-col h-full bg-[#171717] text-[#d4d4d4] font-mono text-[12px] select-none overflow-hidden">
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
              <div className="flex-1 flex flex-col items-center justify-center h-full text-[#555]">
                <svg className="animate-spin" width="36" height="36" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                  <path d="M2 12a10 10 0 0 1 10 -10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span
                  onClick={handleCancelLoading}
                  className="mt-2 text-[13.5px] text-[#3a3a3a] cursor-pointer select-none hover:text-[#4a4a4a]"
                >
                  Cancel
                </span>
              </div>
            ) : (
              <>
                <table className="w-full border-separate border-spacing-0 shrink-0">
                  <thead>
                    <tr>
                      {table_columns.map((col) => (
                        <th
                          key={col}
                          className="sticky top-0 z-10 bg-[#171717] text-left px-4 py-2 text-[12px] text-[#888888] font-medium uppercase tracking-widest whitespace-nowrap border-b border-[#252525]"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  {agents.length > 0 && (
                    <tbody>
                      {agents.map((a) => (
                      <tr
                        key={a.id}
                        onClick={() => handleRowClick(a.id)}
                        onDoubleClick={() => openEdit(a.id)}
                        className={`border-b border-[#222] cursor-pointer transition-colors ${
                          selectedId === a.id ? "bg-[#282828]" : "hover:bg-[#212121]"
                        }`}
                      >
                        <td className="px-4 py-2 text-[13.5px] text-[#d4d4d4] whitespace-nowrap font-medium">
                          {truncateTableCell(a.name)}
                        </td>
                        <td className="cursor-text select-text px-4 py-2 text-[13.5px] text-[#9b9b9b] whitespace-nowrap">
                          {truncateTableCell(a.tag)}
                        </td>
                        <td className="px-4 py-2 text-[13.5px] text-[#cecece] whitespace-nowrap capitalize">
                          {truncateTableCell(a.type)}
                        </td>
                        <td className="px-4 py-2 text-[13.5px] text-[#9b9b9b] whitespace-nowrap">
                          {truncateTableCell(a.apiKey)}
                        </td>
                        <td className="px-4 py-2 text-[13.5px] text-[#9b9b9b] whitespace-nowrap">
                          {truncateTableCell(a.server)}
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  )}
                </table>
                {agents.length === 0 && <PanelEmptyState>No agents configured</PanelEmptyState>}
              </>
            )}
          </div>

          <div className="flex min-w-0 w-full shrink-0 flex-nowrap items-center gap-2 overflow-x-auto border-t border-[#292929] p-2">
            <button
              type="button"
              onClick={handleNew}
              className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] cursor-pointer"
            >
              <Plus size={11} />
              New
            </button>
            <button
              type="button"
              onClick={() => selected && openEdit(selected.id)}
              disabled={!selected}
              className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
            >
              <Edit size={11} />
              Edit
            </button>
            <button
              type="button"
              onClick={() => selected && setShowRemoveConfirm(true)}
              disabled={!selected}
              className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#c97070] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
            >
              <Trash2 size={11} />
              Delete
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
          style={panelStyle}
        >
          {panelMode !== null && (
            <AgentFormPanel
              mode={panelMode}
              selectedName={selected?.name}
              formData={formData}
              editBaseline={editBaseline}
              submitting={submitting}
              handleClosePanel={() => setPanelMode(null)}
              handleSubmitForm={handleSubmitForm}
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
              <span className="text-[13.5px] font-semibold text-[#d4d4d4]">Delete agent</span>
            </div>
            <p className="text-[13.5px] text-[#9b9b9b] mb-5 leading-relaxed">
              Remove <span className="text-[#d4d4d4] font-semibold">"{selected?.name}"</span>? This cannot be undone.
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
                {submitting && <RefreshCw size={10} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
        </PanelPortal>
      )}
    </div>
  );
};

export default AgentsPanel;
