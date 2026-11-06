import { ChevronLeft, ChevronRight, Eye, RefreshCw, Search, Trash2, X } from "lucide-react";
import FetchToast from "@/components/canva/utils/toast_rules";
import { PanelPortal } from "@/components/canva/utils/panel-portal";
import MainList from "./components/main";
import IocHostFilter from "./components/host-filter";
import SplitPanel from "./components/split";
import { useIocPanel } from "./components/logic";

export default function IocPanel() {
  const p = useIocPanel();

  return (
    <div className="flex flex-col h-full bg-[#171717] text-[#d4d4d4] text-[12px] select-none overflow-hidden">
      <FetchToast response={p.response} />
      <div className="shrink-0 min-w-0 overflow-x-auto border-b border-[#252525] bg-[#171717]">
        <div className="box-border flex w-max min-w-full flex-nowrap items-center gap-2 p-2">
          <button
            type="button"
            onClick={p.applyFilter}
            disabled={p.loading}
            title="Search"
            className="button-default h-[29px] shrink-0 rounded-[5px] border border-[#ffffff26] px-2 text-[#cecece] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Search size={14} />
          </button>
          <div className="relative w-[14rem] min-w-[8rem] shrink-0">
            <input
              className="box-border h-[29px] w-full rounded border border-[#363636] bg-[#212121] py-0 pl-3 pr-8 text-[13.5px] text-[#cecece] outline-none transition-colors placeholder:text-[#444] focus:border-[#555]"
              value={p.search}
              onChange={(e) => p.setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") p.applyFilter();
              }}
              placeholder="Search..."
              autoComplete="off"
              spellCheck={false}
            />
            {p.search && (
              <button
                type="button"
                onClick={() => p.setSearch("")}
                className="button-default absolute right-2 top-1/2 -translate-y-1/2 border-none bg-transparent p-0 text-[#555] hover:text-[#cecece] cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <IocHostFilter
            groups={p.hostGroups}
            loading={p.hostsLoading}
            hostId={p.hostId}
            selected={p.selectedHost}
            open={p.hostOpen}
            onOpen={p.setHostOpen}
            onRefresh={p.refreshHosts}
            onSelect={p.selectHost}
          />
        </div>
      </div>

      <div ref={p.splitContainerRef} className="flex flex-1 min-h-0 min-w-0 relative overflow-hidden">
        <div className="flex flex-col min-w-0 flex-1">
          <MainList
            loading={p.loading}
            entries={p.visible}
            selectedKey={p.selectedKey}
            onPick={p.pickRow}
            onOpen={p.openRow}
            onListMouseDown={p.handleListMouseDown}
          />
          <div className="flex min-w-0 w-full shrink-0 flex-nowrap items-center gap-2 overflow-x-auto border-t border-[#292929] p-2">
            <button
              type="button"
              disabled={!p.selected}
              onClick={() => p.setPanelOpen(true)}
              className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
            >
              <Eye size={11} /> View
            </button>
            <button
              type="button"
              disabled={!p.selected}
              onClick={p.handleOpenRemoveConfirm}
              className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#c97070] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
            >
              <Trash2 size={11} /> Remove
            </button>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {p.total > 0 && !p.loading && (
                <span className="text-nowrap text-[13px] tabular-nums text-[#444]">
                  Page {p.page} / {p.pageCount}
                </span>
              )}
              <button
                type="button"
                disabled={p.loading || p.page <= 1}
                onClick={() => p.setPage((n) => Math.max(1, n - 1))}
                className="button-default flex h-[29px] shrink-0 items-center justify-center rounded border border-[#333] bg-[#232323] px-2 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                type="button"
                disabled={p.loading || p.page >= p.pageCount}
                onClick={() => p.setPage((n) => n + 1)}
                className="button-default flex h-[29px] shrink-0 items-center justify-center rounded border border-[#333] bg-[#232323] px-2 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
              >
                <ChevronRight size={13} />
              </button>
              <button
                type="button"
                onClick={p.refresh}
                disabled={p.loading}
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
          {p.selected && p.panelOpen && <SplitPanel entry={p.selected} onClose={() => p.setPanelOpen(false)} />}
        </div>
      </div>

      {p.showRemoveConfirm && (
        <PanelPortal>
          <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-[#00000085]">
            <div
              style={{ borderRadius: "8px" }}
              className="bg-[#191919] border border-[#2f2f2f] p-5 max-w-sm w-[90%] shadow-2xl"
            >
              <div className="flex items-center gap-2 mb-3">
                <Trash2 size={14} className="text-[#c97070] mb-0.5" />
                <span className="text-[13.5px] font-semibold text-[#cecece]">Remove IOC</span>
              </div>
              <p className="text-[13px] text-[#9b9b9b] mb-5 leading-relaxed">
                Remove{" "}
                <span className="text-[#d4d4d4] text-[13px] font-semibold">
                  "{p.selected?.tag || p.selected?.value}"
                </span>
                ? This cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => p.setShowRemoveConfirm(false)}
                  className="button-default px-3 py-1 rounded text-[12px] text-[#9b9b9b] hover:text-[#d4d4d4] hover:bg-[#252525] transition-colors border border-[#333] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={p.handleConfirmRemove}
                  disabled={p.deleting}
                  className="button-default flex items-center gap-1.5 px-3 py-1 rounded text-[12px] text-white bg-[#8b2020] hover:bg-[#a83232] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {p.deleting && <RefreshCw size={10} className="animate-spin" />}
                  Remove
                </button>
              </div>
            </div>
          </div>
        </PanelPortal>
      )}
    </div>
  );
}
