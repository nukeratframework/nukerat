import { buildEmptyWorkspaceMenuItems } from "@/components/canva/empty/rigth-click-menu.tsx";
import type { PanelEditMenuBridge } from "./types.ts";
import { readOnlyInputBridge } from "./util.ts";

export function createEmptyWorkspaceBridge(): PanelEditMenuBridge {
  return {
    ...readOnlyInputBridge(),
    getCustomMenuItems: () => buildEmptyWorkspaceMenuItems(),
  };
}
