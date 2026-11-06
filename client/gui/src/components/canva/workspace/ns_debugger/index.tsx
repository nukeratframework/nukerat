import type { IDockviewPanelProps } from "dockview";
import { RefreshCw, Trash2, X } from "lucide-react";
import AgentModelFilter from "@/components/canva/workspace/agent/components/model-filter";
import FetchToast from "@/components/canva/utils/toast_rules";
import { PanelEmptyState } from "@/components/canva/utils/panel-empty-state";
import NsDebugger from "./components/content-view";
import { useNsDebuggerPanel } from "./components/logic";
import { NsDebuggerDockviewShell } from "./components/rigth-click-menu";

const nsDebuggerSelectTriggerClass =
  "h-[29px] w-[16.25rem] shrink-0 rounded border border-[#363636] bg-[#212121] py-0 text-[13.5px] text-[#cecece] focus:border-[#555] focus-visible:ring-0";

export default function NsDebuggerPanel(props: IDockviewPanelProps) {
  const {
    servers,
    search,
    lines,
    displayLines,
    tag,
    hasServer,
    selectedTargetId,
    selectedTargetLabel,
    targetOpen,
    serversLoading,
    response,
    serverLabel,
    setSearch,
    setTargetOpen,
    refreshServers,
    clearServerFilter,
    selectNsDebuggerTarget,
    getTargetsForServer,
    handleRefresh,
    handleClear,
  } = useNsDebuggerPanel();

  return (
    <NsDebuggerDockviewShell api={props.api}>
      <div className="flex flex-col h-full bg-[#171717] text-[#d4d4d4] font-mono text-[12px] overflow-hidden">
        <FetchToast response={response} />
        <div className="shrink-0 min-w-0 overflow-x-auto border-b border-[#252525] bg-[#171717]">
          <div className="box-border flex w-full flex-nowrap items-center gap-2 p-2">
            <AgentModelFilter
              servers={servers}
              getAgentsForServer={getTargetsForServer}
              serverLabel={serverLabel}
              loading={serversLoading}
              model={tag}
              displayLabel={selectedTargetLabel}
              selectedId={selectedTargetId}
              open={targetOpen}
              triggerClassName={`button-default justify-between gap-1 px-2.5 font-normal outline-none hover:bg-[#212121] disabled:cursor-not-allowed disabled:opacity-50 ${nsDebuggerSelectTriggerClass} ${hasServer ? "pr-7" : ""}`}
              onOpen={setTargetOpen}
              onRefresh={refreshServers}
              onSelectItem={(option, s) => selectNsDebuggerTarget(s.id, option.id)}
              onClear={clearServerFilter}
              placeholder="Select a server"
              searchPlaceholder="Search server..."
              emptyLabel="No server found."
              clearAriaLabel="Clear server"
            />
            <div className="relative min-w-[8rem] flex-1 shrink-0" data-ns-debugger-search-input>
              <input
                data-ns-debugger-search-field="search"
                className="box-border h-[29px] w-full rounded border border-[#363636] bg-[#212121] py-0 pl-3 pr-8 text-[13.5px] text-[#cecece] outline-none transition-colors placeholder:text-[#444] focus:border-[#555]"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search output..."
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

        <div className="mK2vP flex min-h-0 flex-1 flex-col overflow-hidden !py-2 !px-3">
          {!hasServer ? (
            <PanelEmptyState className="h-full px-6 text-center">
              Select a server to view output
            </PanelEmptyState>
          ) : lines.length === 0 ? (
            <PanelEmptyState className="h-full px-6 text-center">
              No content found
            </PanelEmptyState>
          ) : displayLines.length === 0 ? (
            <PanelEmptyState className="h-full px-6 text-center">
              No matching output
            </PanelEmptyState>
          ) : (
            <div data-ns-debugger-output className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <NsDebugger
                lines={displayLines}
                searchQuery={search.trim() || undefined}
              />
            </div>
          )}
        </div>

        <div className="flex min-w-0 w-full shrink-0 flex-nowrap items-center gap-2 overflow-x-auto border-t border-[#292929] p-2 select-none">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={!hasServer}
            className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
          >
            <RefreshCw size={11} />
            Update
          </button>
          <div className="min-w-2 flex-1 shrink" aria-hidden />
          <button
            type="button"
            onClick={handleClear}
            disabled={!hasServer || lines.length === 0}
            className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#c97070] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
          >
            <Trash2 size={11} />
            Clear
          </button>
        </div>
      </div>
    </NsDebuggerDockviewShell>
  );
}
