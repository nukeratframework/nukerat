import { Bot, LayoutGrid, RefreshCw } from "lucide-react";
import type { PanelEditMenuBridge, ProcessMenuRuntime } from "./types.ts";
import { menuAction, pathInput } from "./util.ts";

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
      menuAction("Refresh", RefreshCw, () => rt.refresh(), off),
      {
        kind: "action",
        label: "View mode",
        icon: LayoutGrid,
        disabled: off,
        items: [
          { kind: "action", label: "Tree", onClick: () => rt.setTreeView() },
          { kind: "action", label: "Flat", onClick: () => rt.setFlatView() },
        ],
      },
    ],
    getFooterMenuItems: () => [
      menuAction("Copy context", Bot, () => rt.copyContext(), () => off() || !rt.canCopyContext()),
    ],
  };
}
