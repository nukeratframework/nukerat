import { RefreshCw, Trash2 } from "lucide-react";
import type { NsDebuggerMenuRuntime, PanelEditMenuBridge } from "./types.ts";
import { html, menuAction, readOnlyInputBridge } from "./util.ts";
import { translate } from "@/i18n";

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
      menuAction(translate("clickMenu.update"), RefreshCw, () => nsDebuggerMenuRuntimeRef.current?.refresh()),
      menuAction(
        translate("clickMenu.clear"),
        Trash2,
        () => nsDebuggerMenuRuntimeRef.current?.clear(),
        () => !nsDebuggerMenuRuntimeRef.current?.canClear(),
      ),
    ],
  };
}
