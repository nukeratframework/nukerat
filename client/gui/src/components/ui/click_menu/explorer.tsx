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
import { translate } from "@/i18n";

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
      menuAction(translate("clickMenu.back"), ArrowLeft, () => rt.goBack(), () => !rt.canBack() || off()),
      menuAction(translate("clickMenu.forward"), ArrowRight, () => rt.goForward(), () => !rt.canForward() || off()),
      menuAction(translate("clickMenu.refresh"), RefreshCw, () => rt.refresh(), off),
      menuAction(translate("clickMenu.download"), ArrowDownToLine, () => rt.download(), () => !rt.canDownload() || off()),
      {
        kind: "action",
        label: translate("clickMenu.gridView"),
        icon: LayoutGrid,
        disabled: off,
        items: [
          { kind: "action", label: translate("clickMenu.grid"), onClick: () => rt.setGridView() },
          { kind: "action", label: translate("clickMenu.list"), onClick: () => rt.setListView() },
        ],
      },
      menuAction(translate("clickMenu.copyContext"), Bot, () => rt.copyContext(), () => off() || !rt.canCopyContext()),
    ],
  };
}
