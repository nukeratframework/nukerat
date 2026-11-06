import type { IDockviewPanelProps } from "dockview";
import type { Session } from "@/api/sessions";
import { useScreenshot } from "./components/logic";
import { PanelEmptyState } from "@/components/canva/utils/panel-empty-state";
import { ScreenshotDockviewShell } from "./components/rigth-click-menu";

type ScreenshotPanelParams = {
  selectedHost?: { host: Session; server: string } | null;
};

const ScreenshotWindow = (props: IDockviewPanelProps<ScreenshotPanelParams>) => {
  const selectedHost = props.params?.selectedHost ?? null;
  const { src } = useScreenshot(selectedHost);

  return (
    <ScreenshotDockviewShell api={props.api}>
      <div
        data-screenshot-panel
        className="w-full h-full dv-bg-window flex items-center justify-center overflow-hidden relative"
      >
        {src ? (
          <>
            <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-50" />
            <img src={src} alt="" className="relative max-w-full max-h-full object-contain z-10" />
          </>
        ) : (
          <PanelEmptyState>No screenshot to display</PanelEmptyState>
        )}
      </div>
    </ScreenshotDockviewShell>
  );
};

export default ScreenshotWindow;
