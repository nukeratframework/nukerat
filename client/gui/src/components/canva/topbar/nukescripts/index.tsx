import type { CSSProperties } from "react";
import { Edit, Plus, Trash2, RefreshCw, Pause, Play } from "lucide-react";
import { PanelEmptyState } from "@/components/canva/utils/panel-empty-state";
import { PanelPortal } from "@/components/canva/utils/panel-portal";
import ScriptErrorBar from "./components/error-bar";
import SplitPanel from "./components/split";
import { UtcTableColumnHeader } from "@/components/canva/utils/utc-date";
import { TABLE_COLUMNS, useScriptsPanel, formatUtc } from "./components/logic";

const StatusDot = ({ status }: { status?: number }) => (
  <span className="inline-flex items-center justify-center w-4 h-4">
    <span className={`w-2 h-2 rounded-full ${status === 1 ? "bg-[#4caf75]" : "bg-[#444]"}`} />
  </span>
);

const ScriptsPanel = () => {
  const p = useScriptsPanel();

  return (
    <div className="flex flex-col h-full bg-[#171717] text-[#d4d4d4] font-mono text-[12px] select-none overflow-hidden">
      <div
        ref={p.splitContainerRef}
        className="flex flex-1 min-h-0 min-w-0 relative overflow-hidden"
      >
        <div className="flex flex-col min-w-0 flex-1">
          <div
            className="flex-1 min-w-0 overflow-auto flex flex-col min-h-0"
            onMouseDown={p.handleListMouseDown}
          >
            {p.loading ? (
              <div className="flex items-center justify-center h-16 text-[#444] text-[13.5px]">
                <RefreshCw size={14} className="animate-spin mr-2" />
                Loading...
              </div>
            ) : (
              <>
                <table className="w-full border-collapse shrink-0">
                  <thead>
                    <tr className="bg-[#171717] border-b border-[#252525]">
                      {TABLE_COLUMNS.map((col) => (
                        <th key={col} className="text-left px-4 py-2 text-[12px] text-[#888888] font-medium uppercase tracking-widest whitespace-nowrap">
                          <UtcTableColumnHeader label={col} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  {p.scripts.length > 0 && (
                    <tbody>
                      {p.scripts.map((s) => (
                      <tr
                        key={s.tag}
                        onClick={() => p.handleRowClick(s.tag)}
                        onDoubleClick={() => p.openEdit(s)}
                        className={`border-b border-[#222] cursor-pointer transition-colors ${p.selectedTag === s.tag ? "bg-[#282828]" : "hover:bg-[#212121]"}`}
                      >
                        <td className="px-4 py-2 w-7 text-[13.5px] text-center"><StatusDot status={s.status} /></td>
                        <td className="px-4 py-2 text-[13.5px] text-[#cecece] whitespace-nowrap max-w-[140px] truncate">{s.name}</td>
                        <td className="px-4 py-2 text-[13.5px] text-[#9b9b9b] whitespace-nowrap max-w-[160px] truncate">{s.server || "-"}</td>
                        <td className="px-4 py-2 text-[13.5px] text-[#9b9b9b] max-w-[180px] truncate">{(s.description || "-").slice(0, 100)}</td>
                        <td className="px-4 py-2 text-[13.5px] text-[#9b9b9b] whitespace-nowrap">{s.errors_count ?? 0}</td>
                        <td className="px-4 py-2 text-[13.5px] text-[#9b9b9b] whitespace-nowrap">{formatUtc(s.last_run)}</td>
                        <td className="px-4 py-2 text-[13.5px] text-[#9b9b9b] whitespace-nowrap">{formatUtc(s.created_at)}</td>
                      </tr>
                    ))}
                    </tbody>
                  )}
                </table>
                {p.scripts.length === 0 && <PanelEmptyState>No scripts configured</PanelEmptyState>}
              </>
            )}
          </div>
          <div className="flex shrink-0 flex-nowrap items-center gap-2 border-t border-[#292929] p-2">
            <button type="button" onClick={p.handleAdd} className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] cursor-pointer">
              <Plus size={11} /> Add
            </button>
            <button type="button" onClick={p.handleEdit} disabled={!p.selected} className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25">
              <Edit size={11} /> Edit
            </button>
            <button type="button" onClick={p.handleChangeStatus} disabled={!p.selected || p.submitting} className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25">
              {p.selected?.status === 1 ? <Pause size={11} /> : <Play size={11} />}
              {p.selected?.status === 1 ? "Disable" : "Enable"}
            </button>
            <button type="button" onClick={() => p.selected && p.setShowRemoveConfirm(true)} disabled={!p.selected} className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] font-medium text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#c97070] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25">
              <Trash2 size={11} /> Remove
            </button>
            <div className="min-w-2 flex-1 shrink" aria-hidden />
            <button type="button" onClick={p.handleRefresh} className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] cursor-pointer">
              <RefreshCw size={11} /> Update
            </button>
          </div>
        </div>
        {p.panelMode !== null && (
          <div 
          style={{ zIndex: 900 }}
          className="bg-[#171717] hidden md:flex w-2 shrink-0 cursor-col-resize items-center justify-center border-l border-l-[#2a2a2a]" onMouseDown={p.handleResizeStart} />
        )}
        <div
          className={`flex flex-col h-full min-h-0 min-w-0 bg-[#181818] overflow-x-auto overflow-y-hidden absolute inset-0 md:relative md:inset-auto md:max-w-full shrink transition-transform md:transition-[width] duration-300 ease-in-out z-999 ${
            p.panelMode !== null
              ? "translate-x-0 md:w-[var(--panel-width,720px)] border-l border-[#2a2a2a]"
              : "translate-x-full md:translate-x-0 md:w-0 pointer-events-none overflow-hidden"
          }`}
          style={p.panelStyle as CSSProperties}
        >
          {p.panelMode !== null && (
            <SplitPanel
              mode={p.panelMode}
              selectedName={p.selected?.name}
              formData={p.formData}
              editBaseline={p.editBaseline}
              submitting={p.submitting}
              onClose={p.closePanel}
              onSubmit={p.handleSubmitForm}
              onChange={p.handleFormChange}
              onServerChange={p.handleServerChange}
              onFormat={p.handleFormat}
            />
          )}
        </div>
      </div>
      <ScriptErrorBar error={p.scriptError} onClear={() => p.setScriptError(null)} />
      {p.showRemoveConfirm && (
        <PanelPortal>
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-[#00000085]">
          <div style={{ borderRadius: "8px" }} className="bg-[#191919] border border-[#2f2f2f] p-5 max-w-sm w-[90%] shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Trash2 size={13} className="text-[#c97070]" />
              <span className="text-[13.5px] font-semibold text-[#d4d4d4]">Remove script</span>
            </div>
            <p className="text-[13.5px] text-[#9b9b9b] mb-5 leading-relaxed">
              Remove <span className="inline-block max-w-[180px] align-bottom overflow-hidden text-ellipsis whitespace-nowrap text-[#d4d4d4] font-semibold">"{p.selected?.name}"</span>? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => p.setShowRemoveConfirm(false)} className="button-default px-3 py-1 rounded text-[13px] text-[#9b9b9b] hover:text-[#d4d4d4] hover:bg-[#252525] transition-colors border border-[#333] cursor-pointer">Cancel</button>
              <button onClick={p.handleConfirmRemove} disabled={p.submitting} className="button-default flex items-center gap-1.5 px-3 py-1 rounded text-[13px] text-white bg-[#852b2b] hover:bg-[#a83232] transition-colors disabled:opacity-50 cursor-pointer">
                {p.submitting && <RefreshCw size={10} className="animate-spin" />} Remove
              </button>
            </div>
          </div>
        </div>
        </PanelPortal>
      )}
    </div>
  );
};

export default ScriptsPanel;
