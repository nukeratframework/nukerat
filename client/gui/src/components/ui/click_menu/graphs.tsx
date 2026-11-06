import { Maximize2, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import type { GraphsMenuRuntime, PanelEditMenuBridge } from "./types.ts";
import { menuAction, readOnlyInputBridge } from "./util.ts";

export const graphsMenuRuntimeRef: { current: GraphsMenuRuntime | null } = { current: null };

export function createGraphsBridge(): PanelEditMenuBridge | null {
  const rt = graphsMenuRuntimeRef.current;
  if (!rt) return null;
  return {
    ...readOnlyInputBridge(),
    getCustomMenuItems: () => [
      menuAction("Update", RefreshCw, () => rt.refresh()),
      menuAction("Zoom in", ZoomIn, () => rt.zoomIn()),
      menuAction("Zoom out", ZoomOut, () => rt.zoomOut()),
      menuAction("Fit view", Maximize2, () => rt.fitView()),
    ],
  };
}
