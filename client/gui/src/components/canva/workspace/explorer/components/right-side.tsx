import { ArrowLeft, ArrowRight, RefreshCw, LayoutGrid, List, Folder, File, ArrowDownToLine, ChevronsRight, ChevronDown, ChevronUp } from "lucide-react";
import { FileFallbackIcon, getFileIconSrc, getFolderIconSrc, NameTooltip, useTruncatedNames } from "./utils";
import { PanelEmptyState } from "@/components/canva/utils/panel-empty-state";
import ContentView from "./content-view";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UtcTableColumnHeader } from "@/components/canva/utils/utc-date";
import {
  explorerTableColumns,
  getItemSubtitle,
  isFile,
  isImage,
  useRightSideItems,
  type ExplorerColumn,
  type FileContentData,
  type ViewMode,
} from "./logic";

const RightSide = ({
  explorerTree,
  currentPath,
  viewMode,
  loading,
  disabled,
  autoRefresh: _autoRefresh,
  fileContent,
  onExpand,
  onFileClick,
  onautoRefreshChange: _onautoRefreshChange,
  onViewModeChange,
  onRefresh,
  pathInputValue,
  setPathInputValue,
  onPathSubmit,
  onBack,
  onForward,
  canBack,
  canForward,
  canDownload,
  onDownload,
  onCancelLoading,
  onDismissOversizedFile,
}: {
  explorerTree: unknown[];
  currentPath: string[];
  viewMode: ViewMode;
  loading: boolean;
  disabled: boolean;
  autoRefresh: boolean;
  fileContent: FileContentData | null;
  onExpand: (path: string[]) => void;
  onFileClick: (path: string[]) => void;
  onautoRefreshChange: (value: boolean) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onRefresh: () => void;
  pathInputValue: string;
  setPathInputValue: (value: string) => void;
  onPathSubmit: () => Promise<void>;
  onBack: () => void;
  onForward: () => void;
  canBack: boolean;
  canForward: boolean;
  canDownload: boolean;
  onDownload: () => void;
  onCancelLoading: () => void;
  onDismissOversizedFile: () => void;
}) => {
  const { items, sortCol, sortAsc, handleSortColumn } = useRightSideItems(explorerTree, currentPath);
  const controlsDisabled = loading || disabled;
  const { attachNameRef, isTruncated } = useTruncatedNames([items, viewMode, currentPath]);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div
        style={{ borderColor: "#222323" }}
        className="shrink-0 min-w-0 overflow-x-auto border-b dv-bg-window"
      >
        <div className="box-border flex w-max min-w-full flex-nowrap items-center gap-2 p-2">
          <button
            type="button"
            onClick={onBack}
            disabled={controlsDisabled || !canBack}
            className="button-default flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[3px] border-none bg-transparent text-[#cecece] disabled:cursor-not-allowed disabled:opacity-50 disabled:text-[#444]"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            type="button"
            onClick={onForward}
            disabled={controlsDisabled || !canForward}
            className="button-default flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[3px] border-none bg-transparent text-[#cecece] disabled:cursor-not-allowed disabled:opacity-50 disabled:text-[#444]"
          >
            <ArrowRight size={18} />
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={controlsDisabled}
            className="button-default flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded-[3px] border-none bg-transparent text-[#cecece] disabled:cursor-not-allowed disabled:opacity-50 disabled:text-[#444]"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <div className="relative min-w-[4rem] flex-1 shrink-0" data-explorer-path-input>
            <input
              data-explorer-path-field="path"
              value={pathInputValue}
              disabled={controlsDisabled}
              onChange={(e) => setPathInputValue(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key !== "Enter") return;
                await onPathSubmit();
              }}
              className="box-border h-[29px] w-full min-w-0 rounded border border-[#363636] bg-[#212121] py-0 pl-3 pr-7 text-[13.5px] text-[#cecece] outline-none transition-colors focus:border-[#555] disabled:opacity-50"
            />
            {pathInputValue.trim().length > 0 ? (
              <button
                type="button"
                onClick={() => void onPathSubmit()}
                disabled={controlsDisabled}
                className="button-default absolute right-1 top-1/2 flex -translate-y-1/2 items-center border-none bg-transparent p-0 text-[#cecece] disabled:cursor-not-allowed disabled:opacity-50 disabled:text-[#444]"
              >
                <ChevronsRight size={18} />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onDownload}
            disabled={controlsDisabled || !canDownload}
            title="Download"
            className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded-[6px] border border-[#ffffff26] bg-[#191819] px-2 text-[13.5px] whitespace-nowrap text-[#bdbdbd] select-none hover:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:border-[#2a2a2a] disabled:text-[#555] disabled:opacity-50"
          >
            <ArrowDownToLine size={10} />
            <span>Download</span>
          </button>
          <button
            type="button"
            title="Icon view"
            onClick={() => onViewModeChange("grid")}
            className={`button-default flex h-[29px] shrink-0 items-center rounded-[5px] border px-2 ${viewMode === "grid" ? "border-[#ffffff26] text-[#cecece]" : "border-transparent text-[#555]"}`}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            type="button"
            title="List view"
            onClick={() => onViewModeChange("list")}
            className={`button-default flex h-[29px] shrink-0 items-center rounded-[5px] border px-2 ${viewMode === "list" ? "border-[#ffffff26] text-[#cecece]" : "border-transparent text-[#555]"}`}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div
          className="flex-1 flex flex-col items-center justify-center text-[#555]"
          onDragStart={(e) => e.preventDefault()}
        >
          <svg className="animate-spin" width="36" height="36" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
            <path d="M2 12a10 10 0 0 1 10 -10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span
            onClick={onCancelLoading}
            className="mt-2 text-[13.5px] text-[#3a3a3a] cursor-pointer select-none hover:text-[#4a4a4a]"
          >
            Cancel
          </span>
        </div>
      ) : fileContent !== null ? (
        isImage(fileContent.contentB64) ? (
          <div className="flex-1 overflow-auto p-3 flex items-center justify-center">
            <img
              src={`data:${isImage(fileContent.contentB64)!};base64,${fileContent.contentB64}`}
              alt={fileContent.fileName}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        ) : (
          <ContentView
            content={fileContent.content}
            fileKey={fileContent.fileName}
            oversizedOnly={fileContent.oversizedOnly}
            onDismissOversized={onDismissOversizedFile}
          />
        )
      ) : items.length === 0 ? (
        <PanelEmptyState>No content found</PanelEmptyState>
      ) : viewMode === "grid" ? (
        <div id="explorer-grid-view" className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
          <TooltipProvider delayDuration={500}>
            <div className="flex flex-wrap content-start gap-1">
              {items.map(([name, nodeVal]) => {
                const fileNode = isFile(nodeVal);
                const fileIconSrc = fileNode ? getFileIconSrc(name) : null;
                const folderIconSrc = !fileNode ? getFolderIconSrc() : null;
                const nameKey = `grid:${currentPath.join("/")}:${name}`;
                const subtitle = getItemSubtitle(name, nodeVal, fileNode);

                const itemCard = (
                  <div
                    onClick={() => fileNode && onFileClick([...currentPath, name])}
                    onDoubleClick={() => !fileNode && onExpand([...currentPath, name])}
                    onDragStart={(e) => e.preventDefault()}
                    className="flex flex-col items-center justify-start w-[100px] h-[114px] px-1 pt-2 pb-1.5 rounded select-none border bg-transparent border-transparent cursor-pointer hover:bg-[#1a1a1a] overflow-hidden"
                  >
                    {fileNode ? (
                      fileIconSrc ? (
                        <img
                          src={fileIconSrc}
                          alt={name}
                          className="w-[40px] h-[40px] object-contain"
                          loading="lazy"
                          draggable={false}
                        />
                      ) : (
                        <FileFallbackIcon size={42} />
                      )
                    ) : folderIconSrc ? (
                      <img
                        src={folderIconSrc}
                        alt={name}
                        className="w-[40px] h-[40px] object-contain"
                        loading="lazy"
                        draggable={false}
                      />
                    ) : null}
                    <span
                      ref={attachNameRef(nameKey)}
                      className="mt-1.5 text-[13.5px] text-center w-full text-[#cecece] overflow-hidden text-ellipsis whitespace-nowrap"
                    >
                      {name}
                    </span>
                    <span className="mt-0.5 text-[.8rem] font-normal text-[#5E5D5F] text-center w-full overflow-hidden text-ellipsis whitespace-nowrap">
                      {subtitle}
                    </span>
                  </div>
                );

                return (
                  <NameTooltip key={name} name={name} enabled={isTruncated(nameKey)}>
                    {itemCard}
                  </NameTooltip>
                );
              })}
            </div>
          </TooltipProvider>
        </div>
      ) : (
        <div id="explorer-list-view" className="flex-1 overflow-y-auto overflow-x-auto p-0">
          <div className="ml-[0.1px] min-w-[480px]">
            <div className="ml-0.5 grid grid-cols-[1fr_90px_90px_90px] px-3 py-1 font-[400] text-[13px] select-none sticky top-0 bg-[#161616] z-10 border-b border-[#252525]">
              {explorerTableColumns.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => handleSortColumn(col as ExplorerColumn)}
                  className={`inline-flex items-center gap-0.5 text-left uppercase tracking-widest text-[12px] font-medium cursor-pointer transition-colors hover:text-[#b0b0b0] ${sortCol === col ? "text-[#b8b8b8]" : "text-[#888888]"}`}
                >
                  <UtcTableColumnHeader label={col} />
                  {sortCol === col ? (
                    sortAsc ? (
                      <ChevronUp size={13} strokeWidth={2.25} className="shrink-0 opacity-80" />
                    ) : (
                      <ChevronDown size={13} strokeWidth={2.25} className="shrink-0 opacity-80" />
                    )
                  ) : null}
                </button>
              ))}
            </div>
            <TooltipProvider delayDuration={500}>
              {items.map(([name, nodeVal]) => {
                const fileNode = isFile(nodeVal);
                const nameKey = `list:${currentPath.join("/")}:${name}`;
                const nv = nodeVal as { size?: unknown; modified?: string };

                const row = (
                  <div
                    onClick={() => fileNode && onFileClick([...currentPath, name])}
                    onDoubleClick={() => !fileNode && onExpand([...currentPath, name])}
                    onDragStart={(e) => e.preventDefault()}
                    className="grid grid-cols-[1fr_90px_90px_90px] px-3 py-[3px] select-none border-l-3 bg-transparent border-transparent cursor-pointer hover:bg-[#1a1a1a]"
                  >
                    <span className="flex items-center gap-1.5 overflow-hidden">
                      <span className="text-[#cecece] shrink-0 flex items-center">
                        {fileNode ? <File size={16} /> : <Folder size={16} />}
                      </span>
                      <span
                        ref={attachNameRef(nameKey)}
                        className="text-[13.5px] font-[400] overflow-hidden text-ellipsis whitespace-nowrap text-[#d4d4d4]"
                      >
                        {name}
                      </span>
                    </span>
                    <span className="text-[13.5px] text-[#929193] self-center">{fileNode ? "File" : "Folder"}</span>
                    <span className="text-[13.5px] text-[#929193] self-center">{String(nv.size ?? "-")}</span>
                    <span className="text-[13.5px] text-[#929193] self-center whitespace-nowrap">
                      {nv.modified?.slice?.(0, 10) ?? nv.modified ?? "-"}
                    </span>
                  </div>
                );

                return (
                  <NameTooltip key={name} name={name} enabled={isTruncated(nameKey)}>
                    {row}
                  </NameTooltip>
                );
              })}
            </TooltipProvider>
          </div>
        </div>
      )}
    </div>
  );
};

export default RightSide;
