import { Eye, RefreshCw, Trash2 } from "lucide-react";
import type { KeyloggerMenuRuntime, PanelEditMenuBridge } from "./types.ts";
import { menuAction, pathInput } from "./util.ts";

export const keyloggerMenuRuntimeRef: { current: KeyloggerMenuRuntime | null } = { current: null };

function keyloggerCanRemoveSelected() {
  return keyloggerMenuRuntimeRef.current?.canRemoveSelected() ?? false;
}

function keyloggerRemoveSelected() {
  const rt = keyloggerMenuRuntimeRef.current;
  if (!rt?.canRemoveSelected()) return;
  rt.removeSelected();
}

function keyloggerCanRemoveAll() {
  return keyloggerMenuRuntimeRef.current?.canRemoveAll() ?? false;
}

function keyloggerRemoveAll() {
  const rt = keyloggerMenuRuntimeRef.current;
  if (!rt?.canRemoveAll()) return;
  rt.removeAll();
}

export function createKeyloggerBridge(): PanelEditMenuBridge | null {
  const rt = keyloggerMenuRuntimeRef.current;
  if (!rt) return null;
  return {
    resolveEditable: (t) => pathInput(t, "[data-keylogger-search-input]", "[data-keylogger-search-field]"),
    readValue: () => rt.getSearch(),
    writeValue: (_, v) => rt.setSearch(v),
    getCustomMenuItems: () => [
      menuAction("View", Eye, () => rt.view(), () => !rt.canUseSelection()),
      menuAction("Update", RefreshCw, () => rt.refresh()),
      {
        kind: "action",
        label: "Remove",
        icon: Trash2,
        disabled: () => !keyloggerCanRemoveSelected() && !keyloggerCanRemoveAll(),
        items: [
          {
            kind: "action",
            label: "Selected",
            onClick: () => keyloggerRemoveSelected(),
            disabled: () => !keyloggerCanRemoveSelected(),
          },
          {
            kind: "action",
            label: "All",
            onClick: () => keyloggerRemoveAll(),
            disabled: () => !keyloggerCanRemoveAll(),
          },
        ],
      },
    ],
  };
}
