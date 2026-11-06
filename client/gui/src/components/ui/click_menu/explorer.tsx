import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Bot,
  LayoutGrid,
  RefreshCw,
} from "lucide-react";
import type { ExplorerMenuRuntime, PanelEditMenuBridge } from "./types.ts";
import { menuAction, pathInput } from "./util.ts";

export const explorerMenuRuntimeRef: { current: ExplorerMenuRuntime | null } = { current: null };

export function createExplorerBridge(): PanelEditMenuBridge | null {
  const rt = explorerMenuRuntimeRef.current;
  if (!rt) return null;
  const off = () => rt.controlsDisabled();
  return {
    resolveEditable: (t) => pathInput(t, "[data-explorer-path-input]", "[data-explorer-path-field]"),
    readValue: () => rt.getPathInput(),
    writeValue: (_, v) => rt.setPathInput(v),
    canEdit: () => !off(),
    getCustomMenuItems: () => [
      menuAction("Back", ArrowLeft, () => rt.goBack(), () => !rt.canBack() || off()),
      menuAction("Forward", ArrowRight, () => rt.goForward(), () => !rt.canForward() || off()),
      menuAction("Refresh", RefreshCw, () => rt.refresh(), off),
      menuAction("Download", ArrowDownToLine, () => rt.download(), () => !rt.canDownload() || off()),
      {
        kind: "action",
        label: "Grid view",
        icon: LayoutGrid,
        disabled: off,
        items: [
          { kind: "action", label: "Grid", onClick: () => rt.setGridView() },
          { kind: "action", label: "List", onClick: () => rt.setListView() },
        ],
      },
      menuAction("Copy context", Bot, () => rt.copyContext(), () => off() || !rt.canCopyContext()),
    ],
  };
}
