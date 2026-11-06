import type { IDockviewPanelProps } from "dockview";
import type { Session } from "@/api/sessions";
import LeftSide, { EXPLORER_LEFT_SIDE_MAX_WIDTH } from "./components/left-side";
import RightSide from "./components/right-side";
import { useExplorerWindow } from "./components/logic";
import { ExplorerDockviewShell } from "./components/rigth-click-menu";

type ExplorerPanelParams = {
  selectedHost?: { host: Session; server: string } | null;
};

const ExplorerWindow = (props: IDockviewPanelProps<ExplorerPanelParams>) => {
  const selectedHost = props.params?.selectedHost ?? null;
  const {
    hostUnavailable,
    explorerTree,
    leftWidth,
    startResize,
    currentPath,
    viewMode,
    loading,
    fileContent,
    autoRefresh,
    setautoRefresh,
    setViewMode,
    onExpand,
    onFileClick,
    onPathSubmit,
    goBack,
    goForward,
    canBack,
    canForward,
    canDownloadFile,
    onDownloadFile,
    fetchExplorer,
    setLoading,
    pathInputValue,
    setPathInputValue,
    handlePathSubmitAction,
    clearFileContent,
  } = useExplorerWindow(selectedHost, EXPLORER_LEFT_SIDE_MAX_WIDTH);

  return (
    <ExplorerDockviewShell api={props.api}>
      <div className="flex w-full min-w-0 h-full dv-bg-window font-mono overflow-hidden select-text">
        <LeftSide
          explorerTree={explorerTree}
          currentPath={currentPath}
          width={leftWidth}
          loading={loading}
          disabled={hostUnavailable}
          onFileClick={onFileClick}
          onExpand={onExpand}
        />
        <div
          className="shrink-0 w-[2px] px-[6px] -mx-[6px] cursor-col-resize relative z-10 bg-transparent"
          onMouseDown={startResize}
        >
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] dv-bg-border" />
        </div>
        <RightSide
          explorerTree={explorerTree}
          currentPath={currentPath}
          viewMode={viewMode}
          loading={loading}
          disabled={hostUnavailable}
          autoRefresh={autoRefresh}
          onautoRefreshChange={setautoRefresh}
          fileContent={fileContent}
          onExpand={onExpand}
          onFileClick={onFileClick}
          onViewModeChange={setViewMode}
          onRefresh={() => fetchExplorer(currentPath)}
          pathInputValue={pathInputValue}
          setPathInputValue={setPathInputValue}
          onPathSubmit={handlePathSubmitAction}
          onBack={goBack}
          onForward={goForward}
          canBack={canBack}
          canForward={canForward}
          canDownload={canDownloadFile}
          onDownload={onDownloadFile}
          onCancelLoading={() => setLoading(false)}
          onDismissOversizedFile={clearFileContent}
        />
      </div>
    </ExplorerDockviewShell>
  );
};

export default ExplorerWindow;
