import { Bot, LayoutGrid, RefreshCw } from "lucide-react";
import type { PanelEditMenuBridge, ProcessMenuRuntime } from "./types.ts";
import { menuAction, pathInput } from "./util.ts";
import { translate } from "@/i18n";

export const processMenuRuntimeRef: { current: ProcessMenuRuntime | null } = { current: null };

export function createProcessBridge(): PanelEditMenuBridge | null {
  const rt = processMenuRuntimeRef.current;
  if (!rt) return null;
  const off = () => rt.controlsDisabled();
  return {
    resolveEditable: (t) => pathInput(t, "[data-process-search-input]", "[data-process-search-field]"),
    readValue: () => rt.getSearch(),
    writeValue: (_, v) => rt.setSearch(v),
    canEdit: () => !off(),
    getCustomMenuItems: () => [
      menuAction(translate("clickMenu.refresh"), RefreshCw, () => rt.refresh(), off),
      {
        kind: "action",
        label: translate("clickMenu.viewMode"),
        icon: LayoutGrid,
        disabled: off,
        items: [
          { kind: "action", label: translate("clickMenu.tree"), onClick: () => rt.setTreeView() },
          { kind: "action", label: translate("clickMenu.flat"), onClick: () => rt.setFlatView() },
        ],
      },
    ],
    getFooterMenuItems: () => [
      menuAction(translate("clickMenu.copyContext"), Bot, () => rt.copyContext(), () => off() || !rt.canCopyContext()),
    ],
  };
}
