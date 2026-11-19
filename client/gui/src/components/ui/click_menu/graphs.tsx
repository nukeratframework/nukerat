import { Maximize2, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import type { GraphsMenuRuntime, PanelEditMenuBridge } from "./types.ts";
import { menuAction, readOnlyInputBridge } from "./util.ts";
import { translate } from "@/i18n";

export const graphsMenuRuntimeRef: { current: GraphsMenuRuntime | null } = { current: null };

export function createGraphsBridge(): PanelEditMenuBridge | null {
  const rt = graphsMenuRuntimeRef.current;
  if (!rt) return null;
  return {
    ...readOnlyInputBridge(),
    getCustomMenuItems: () => [
      menuAction(translate("clickMenu.update"), RefreshCw, () => rt.refresh()),
      menuAction(translate("clickMenu.zoomIn"), ZoomIn, () => rt.zoomIn()),
      menuAction(translate("clickMenu.zoomOut"), ZoomOut, () => rt.zoomOut()),
      menuAction(translate("clickMenu.fitView"), Maximize2, () => rt.fitView()),
    ],
  };
}
