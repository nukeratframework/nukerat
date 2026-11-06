import { Download, FileIcon, FolderOpen, Trash2, X } from "lucide-react";
import { TbDownloadOff } from "react-icons/tb";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  cancelUserDownload,
  deleteDownloadEntry,
  showDownloadInFolder,
} from "@/components/ui/downloads_activity";
import { formatBytesCompact, type DownloadItem } from "./logic";

type PanelState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  items: DownloadItem[];
  running: DownloadItem[];
  history: DownloadItem[];
};

function ActiveDownloadRow({ item }: { item: DownloadItem }) {
  const hasByteProgress = item.total > 0;
  const pct = hasByteProgress
    ? Math.min(100, Math.round((item.received / item.total) * 100))
    : 0;
  const mbLeft = hasByteProgress
    ? Math.max(0, (item.total - item.received) / (1024 * 1024))
    : 0;
  return (
    <li className="group px-3 py-2.5">
      <div className="flex gap-2">
        <FileIcon className="mt-0.5 size-5 shrink-0 text-[#9b9b9b]" strokeWidth={1.5} />
        <div className="min-w-0 flex-1">
          <p className="max-w-[10ch] truncate text-[13px] text-[#cecece]" title={item.fileName}>
            {item.fileName}
          </p>
          <p className="mt-0.5 text-[12px] text-[#9b9b9b]">
            {hasByteProgress
              ? `${pct}% · ${mbLeft.toFixed(1)} MB left`
              : "Requesting bytes..."}
          </p>
          <div className="relative mt-2 h-1 w-full overflow-hidden rounded-full bg-[#3a3a3a]">
            {hasByteProgress ? (
              <div
                className="h-full rounded-full bg-[#e8e8e8] transition-[width] duration-150"
                style={{ width: `${pct}%` }}
              />
            ) : (
              <div
                className="absolute left-0 h-full w-[30%] rounded-full bg-[#e8e8e8]/80"
                style={{ animation: "download-progress-indeterminate 1.15s ease-in-out infinite" }}
              />
            )}
          </div>
        </div>
        <button
          type="button"
          aria-label="Cancel download"
          className="button-default shrink-0 p-1 rounded text-[#888888] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 cursor-pointer"
          onClick={() => {
            void cancelUserDownload(item.id);
          }}
        >
          <X size={13} />
        </button>
      </div>
    </li>
  );
}

const historyActionBtn =
  "button-default shrink-0 p-1 rounded text-[#888888] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 cursor-pointer";

function HistoryDownloadRow({ item }: { item: DownloadItem }) {
  const size = item.total > 0 ? item.total : item.received;
  const completed = item.status === "completed";
  const showDelete =
    item.status === "completed" ||
    item.status === "cancelled" ||
    item.status === "failed";
  return (
    <li className="group px-3 py-2">
      <div className="flex gap-2">
        {item.status === "cancelled" ? (
          <TbDownloadOff className="mt-0.5 size-5 shrink-0 text-[#8a8a8a]" aria-hidden />
        ) : (
          <FileIcon className="mt-0.5 size-5 shrink-0 text-[#8a8a8a]" strokeWidth={1.5} />
        )}
        <div className="min-w-0 flex-1">
          <p className="max-w-[10ch] truncate text-[13px] text-[#cecece]" title={item.fileName}>
            {item.fileName}
          </p>
          <p className="mt-0.5 text-[12px] text-[#8a8a8a]">
            {formatBytesCompact(size)}
            {item.status === "cancelled" ? " • Cancelled" : ""}
            {item.status === "failed" ? " • Failed" : ""}
          </p>
        </div>
        {(completed || showDelete) && (
          <div className="flex shrink-0 items-start gap-0.5">
            {completed && (
              <button
                type="button"
                aria-label="Show in folder"
                className={historyActionBtn}
                onClick={() => showDownloadInFolder(item.dest)}
              >
                <FolderOpen size={13} />
              </button>
            )}
            {showDelete && (
              <button
                type="button"
                aria-label="Remove from list"
                className={historyActionBtn}
                onClick={() => deleteDownloadEntry(item.id)}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

const MAX_VISIBLE_DOWNLOADS = 5;

export default function DownloadsMain(panel: PanelState) {
  const { open, setOpen, items } = panel;
  const recentItems = items.slice(0, MAX_VISIBLE_DOWNLOADS);
  const visibleRunning = recentItems.filter((i) => i.status === "running");
  const visibleHistory = recentItems.filter((i) => i.status !== "running");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="button-default hover:underline cursor-pointer flex items-center gap-1.5 px-3 py-2 text-[1rem] primary-text rounded font-medium"
            >
              <Download size={18.5} />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="bg-[#3A3A3A] flex flex-col items-start gap-1 text-left"
          style={{ borderRadius: "7px" }}
        >
          <div className="font-semibold text-xs text-left w-full">Downloads</div>
          <div className="text-xs opacity-90 text-left w-full">Recent download history</div>
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="downloads-popover text-[#d4d4d4] w-[13rem] overflow-hidden p-0 !ring-0"
      >
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 select-none">
          <span className="cursor-default text-[13px] font-medium text-[#cecece]">Downloads</span>
          <button
            type="button"
            aria-label="Close downloads"
            className="button-default shrink-0 p-1 rounded text-[#888888] hover:text-[#d4d4d4] hover:bg-[#2a2a2a] transition-colors cursor-pointer outline-none focus:outline-none focus-visible:ring-0"
            onClick={() => setOpen(false)}
          >
            <X size={13} />
          </button>
        </div>
        <div className="downloads-popover-list max-h-[13rem] overflow-y-auto overflow-x-hidden select-none cursor-default">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-[12px] text-[#8a8a8a]">No downloads</p>
          ) : (
            <>
              {visibleRunning.map((item) => <ActiveDownloadRow key={item.id} item={item} />)}
              {/* {visibleRunning.length > 0 && visibleHistory.length > 0 && (
                <div className="mx-3 border-t border-[#404040]" />
              )} */}
              <ul>
                {visibleHistory.map((item) => <HistoryDownloadRow key={item.id} item={item} />)}
              </ul>
            </>
          )}
        </div>
        {/* {history.length > 0 && (
          <div className="border-t border-[#404040] px-3 py-1.5 select-none">
            <button
              type="button"
              className="text-[12px] text-[#9b9b9b] hover:text-[#d4d4d4] hover:underline cursor-pointer"
              onClick={() => clearCompletedDownloads()}
            >
              Clear finished
            </button>
          </div>
        )} */}
      </PopoverContent>
    </Popover>
  );
}

