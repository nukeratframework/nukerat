import type { CSSProperties } from "react";
import type { IDockviewPanelProps } from "dockview";
import { Edit, Plus, Trash2, RefreshCw } from "lucide-react";
import { PanelEmptyState } from "@/components/canva/utils/panel-empty-state";
import SplitPanel from "./components/split";
import ViewPanel from "./components/view";
import { TABLE_COLUMNS, tableCellTruncate, useCredentialsPanel } from "./components/logic";
import { CredentialsDockviewShell } from "./components/rigth-click-menu";

const CredentialsPanel = (props: IDockviewPanelProps) => {
  const {
    credentials,
    loading,
    selectedTag,
    panelMode,
    formData,
    showRemoveConfirm,
    removeConfirmMode,
    credentialCount,
    submitting,
    editBaseline,
    selected,
    panelStyle,
    setShowRemoveConfirm,
    closePanel,
    handleRowClick,
    handleListMouseDown,
    handleRowDoubleClick,
    handleAdd,
    handleEdit,
    handleRemove,
    handleConfirmRemove,
    handleRefresh,
    handleFormChange,
    handleServerChange,
    handleSubmitForm,
    handleResizeStart,
  } = useCredentialsPanel();

  return (
    <CredentialsDockviewShell api={props.api}>
    <div
      id="credentials-panel"
      className="flex flex-col h-full bg-[#171717] text-[#d4d4d4] font-mono text-[12px] select-text overflow-hidden"
    >
      <div className="flex flex-1 min-h-0 min-w-0 relative overflow-hidden">
        <div className="flex flex-col min-w-0 flex-1">
          <div
            className="flex-1 overflow-auto flex flex-col min-h-0"
            onMouseDown={handleListMouseDown}
          >
            {loading ? (
              <div className="flex items-center justify-center h-16 text-[#444] text-[13.5px]">
                <RefreshCw size={14} className="animate-spin mr-2" />
                Loading...
              </div>
            ) : (
              <>
                <table id="credentials-table" className="w-full border-collapse shrink-0 select-none">
                  <thead>
                    <tr className="bg-[#171717] border-b border-[#252525]">
                      {TABLE_COLUMNS.map((col) => (
                        <th
                          key={col}
                          className="text-left px-4 py-2 text-[12px] text-[#888888] font-medium uppercase tracking-widest whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  {credentials.length > 0 && (
                    <tbody>
                      {credentials.map((c) => (
                      <tr
                        key={c.tag}
                        data-credential-tag={c.tag}
                        onClick={() => handleRowClick(c.tag)}
                        onDoubleClick={() => handleRowDoubleClick(c.tag)}
                        className={`border-b border-[#222] cursor-pointer transition-colors ${
                          selectedTag === c.tag ? "bg-[#282828]" : "hover:bg-[#212121]"
                        }`}
                      >
                        <td className="px-4 py-2 text-[13.5px] text-[#cecece]">
                          <span title={c.name || undefined} className={tableCellTruncate}>{c.name || "-"}</span>
                        </td>
                        <td className="px-4 py-2 text-[13.5px] text-[#cecece] max-w-[160px] truncate">{c.server || "-"}</td>
                        <td className="px-4 py-2 text-[13.5px] text-[#cecece]">
                          <span className={`${tableCellTruncate} font-mona-mono`}>{c.host || "-"}</span>
                        </td>
                        <td className="px-4 py-2 text-[13.5px] text-[#9b9b9b]">
                          <span title={c.desc || undefined} className={tableCellTruncate}>{c.desc || "-"}</span>
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  )}
                </table>
                {credentials.length === 0 && <PanelEmptyState>No content found</PanelEmptyState>}
              </>
            )}
          </div>

          <div className="flex min-w-0 w-full shrink-0 flex-nowrap items-center gap-2 overflow-x-auto border-t border-[#292929] p-2">
            <button
              type="button"
              onClick={handleAdd}
              className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] cursor-pointer"
            >
              <Plus size={11} />
              Add
            </button>
            <button
              type="button"
              onClick={handleEdit}
              disabled={!selected}
              className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
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
            style={{ backgroundColor: "#171717" }}
            className="hidden md:flex w-2 shrink-0 cursor-col-resize items-center justify-center border-l border-l-[#2a2a2a] bg-[#171717]"
            onMouseDown={handleResizeStart}
          />
        )}

        <div
          className={`flex flex-col h-full min-h-0 min-w-0 bg-[#171717] overflow-x-auto overflow-y-hidden absolute inset-0 z-999 md:relative md:inset-auto md:z-auto md:max-w-full shrink transition-transform md:transition-[width] duration-300 ease-in-out ${
            panelMode !== null
              ? "translate-x-0 md:w-[var(--panel-width,360px)] border-l border-[#2a2a2a]"
              : "translate-x-full md:translate-x-0 w-0 shrink-0 pointer-events-none overflow-hidden"
          }`}
          style={panelStyle as CSSProperties}
        >
          {panelMode === "view" && <ViewPanel credential={selected} onClose={closePanel} />}
          {(panelMode === "add" || panelMode === "edit") && (
            <SplitPanel
              mode={panelMode}
              selectedName={selected?.name}
              formData={formData}
              editBaseline={editBaseline}
              submitting={submitting}
              onClose={closePanel}
              onSubmit={handleSubmitForm}
              onChange={handleFormChange}
              onServerChange={handleServerChange}
            />
          )}
        </div>
      </div>

      {showRemoveConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div style={{ borderRadius: "8px" }} className="bg-[#191919] border border-[#2f2f2f] p-5 max-w-sm w-[90%] shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Trash2 size={13} className="text-[#c97070]" />
              <span className="text-[13.5px] font-semibold text-[#d4d4d4]">Remove credential</span>
            </div>
            <p className="text-[13.5px] text-[#9b9b9b] mb-5 leading-relaxed">
              {removeConfirmMode === "all" ? (
                <>
                  Remove all{" "}
                  <span className="text-[#d4d4d4] font-semibold">{credentialCount}</span>{" "}
                  credential{credentialCount === 1 ? "" : "s"}? This cannot be undone.
                </>
              ) : (
                <>
                  Remove{" "}
                  <span className="inline-block max-w-[180px] truncate text-[#d4d4d4] font-semibold align-bottom">
                    "{selected?.name}"
                  </span>
                  ? This cannot be undone.
                </>
              )}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setShowRemoveConfirm(false)} className="button-default flex items-center gap-1.5 px-3 py-1 rounded bg-[#232323] text-[#9b9b9b] text-[13px] hover:bg-[#252525] hover:text-[#d4d4d4] transition-colors border border-[#333] cursor-pointer">
                Cancel
              </button>
              <button
                onClick={handleConfirmRemove}
                disabled={submitting}
                className="button-default flex items-center gap-1.5 px-3 py-1 rounded text-[13px] text-white bg-[#852b2b] hover:bg-[#a83232] disabled:opacity-50 cursor-pointer"
              >
                {submitting && <RefreshCw size={10} className="animate-spin" />}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </CredentialsDockviewShell>
  );
};

export default CredentialsPanel;
