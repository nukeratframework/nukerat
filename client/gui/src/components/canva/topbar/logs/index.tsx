import { ChevronLeft, ChevronRight, Eye, RefreshCw } from "lucide-react";
import FetchToast from "@/components/canva/utils/toast_rules";
import { PanelEmptyState, panelEmptyTextClass } from "@/components/canva/utils/panel-empty-state";
import LogTopBar from "./components/filters";
import MainList from "./components/main";
import SplitPanel from "./components/split";
import { useLogsPanel } from "./components/logic";

const LogsPanel = () => {
  const p = useLogsPanel();

  const listBody = () => {
    if (p.loading && !p.hasFetched) {
      return (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-[#555] bg-[#171717]">
          <svg className="animate-spin" width="36" height="36" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
            <path d="M2 12a10 10 0 0 1 10 -10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span
            onClick={p.cancelLoading}
            className="mt-2 text-[13.5px] text-[#3a3a3a] cursor-pointer select-none hover:text-[#4a4a4a]"
          >
            Cancel
          </span>
        </div>
      );
    }
    if (p.loading) {
      return (
        <div className="flex-1 min-h-0 flex items-center justify-center text-[#444] text-[13.5px] bg-[#171717]">
          <RefreshCw size={14} className="animate-spin mr-2" />
          Loading...
        </div>
      );
    }
    if (!p.serverId) {
      return <PanelEmptyState>Select a server to view logs</PanelEmptyState>;
    }
    if (p.entries.length === 0) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center min-h-0 gap-1">
          <span className={panelEmptyTextClass}>No log entries</span>
          {p.hasActiveFilters && (
            <button
              type="button"
              onClick={p.clearFilters}
              className="button-default text-[12px] text-[#555] hover:text-[#aaa] transition-colors cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>
      );
    }
    return (
      <MainList
        entries={p.entries}
        selectedKey={p.selectedKey}
        onPick={p.pickRow}
        onOpen={p.openRow}
        onListMouseDown={p.handleListMouseDown}
      />
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#171717] text-[#d4d4d4] font-mono text-[12px] select-none overflow-hidden">
      <FetchToast response={p.response} />
      <LogTopBar
        filters={p.filters}
        total={p.total}
        servers={p.servers}
        serverId={p.serverId}
        serverLabel={p.serverLabel}
        hasActiveFilters={p.hasActiveFilters}
        setFilter={p.setFilter}
        setServer={p.setServer}
        clearFilters={p.clearFilters}
      />
      <div ref={p.splitContainerRef} className="flex flex-1 min-h-0 min-w-0 relative overflow-hidden bg-[#171717]">
        <div className="flex flex-col min-w-0 flex-1 min-h-0 bg-[#171717]">
          {listBody()}
          <div className="flex min-w-0 w-full shrink-0 flex-nowrap items-center gap-2 overflow-x-auto border-t border-[#292929] p-2">
            <button
              type="button"
              disabled={!p.selected}
              onClick={() => p.setPanelOpen(true)}
              className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
            >
              <Eye size={11} /> View
            </button>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {p.total > 0 && !p.loading && (
                <span className="text-nowrap text-[13px] tabular-nums text-[#444]">
                  Page {p.page} / {p.pageCount}
                </span>
              )}
              <button
                type="button"
                disabled={p.loading || !p.serverId || p.page <= 1}
                onClick={() => p.setPage((n) => Math.max(1, n - 1))}
                className="button-default flex h-[29px] shrink-0 items-center justify-center rounded border border-[#333] bg-[#232323] px-2 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                type="button"
                disabled={p.loading || !p.serverId || p.page >= p.pageCount}
                onClick={() => p.setPage((n) => n + 1)}
                className="button-default flex h-[29px] shrink-0 items-center justify-center rounded border border-[#333] bg-[#232323] px-2 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
              >
                <ChevronRight size={13} />
              </button>
              <button
                type="button"
                onClick={p.handleRefresh}
                disabled={p.loading || !p.serverId}
                className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
              >
                <RefreshCw size={11} className={p.loading ? "animate-spin" : ""} />
                Update
              </button>
            </div>
          </div>
        </div>

        {p.panelOpen && (
          <div
            style={{ backgroundColor: "#171717" }}
            className="hidden md:flex w-2 shrink-0 cursor-col-resize border-l border-l-[#2a2a2a] bg-[#171717]"
            onMouseDown={p.resize}
          />
        )}
        <div
          className={`flex flex-col h-full min-h-0 min-w-0 bg-[#181818] overflow-x-auto overflow-y-hidden absolute inset-0 md:relative md:inset-auto md:max-w-full shrink transition-transform md:transition-[width] duration-300 ease-in-out z-999 ${
            p.panelOpen
              ? "translate-x-0 md:w-[var(--panel-width,720px)] border-l border-[#2a2a2a]"
              : "translate-x-full md:translate-x-0 md:w-0 pointer-events-none overflow-hidden"
          }`}
          style={p.panelStyle}
        >
          {p.selected && p.panelOpen && (
            <SplitPanel entry={p.selected} onClose={() => p.setPanelOpen(false)} />
          )}
        </div>
      </div>
    </div>
  );
};

export default LogsPanel;
