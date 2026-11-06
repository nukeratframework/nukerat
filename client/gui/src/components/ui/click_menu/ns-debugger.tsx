import { RefreshCw, Trash2 } from "lucide-react";
import type { NsDebuggerMenuRuntime, PanelEditMenuBridge } from "./types.ts";
import { html, menuAction, readOnlyInputBridge } from "./util.ts";

export const nsDebuggerMenuRuntimeRef: { current: NsDebuggerMenuRuntime | null } = { current: null };

export function createNsDebuggerBridge(): PanelEditMenuBridge {
  return {
    ...readOnlyInputBridge(),
    resolveStaticTextRegion: (t) => {
      const rt = nsDebuggerMenuRuntimeRef.current;
      const r = html(t)?.closest("[data-ns-debugger-output]");
      if (!(r instanceof HTMLElement) || !rt?.hasOutput()) return null;
      return r;
    },
    getCustomMenuItems: () => [
      menuAction("Update", RefreshCw, () => nsDebuggerMenuRuntimeRef.current?.refresh()),
      menuAction(
        "Clear",
        Trash2,
        () => nsDebuggerMenuRuntimeRef.current?.clear(),
        () => !nsDebuggerMenuRuntimeRef.current?.canClear(),
      ),
    ],
  };
}
