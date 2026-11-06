import { Copy, Trash2 } from "lucide-react";
import type { AgentMenuRuntime, PanelEditMenuBridge } from "./types.ts";
import { html, menuAction } from "./util.ts";

export const agentMenuRuntimeRef: { current: AgentMenuRuntime | null } = { current: null };

export function createAgentBridge(): PanelEditMenuBridge | null {
  const rt = agentMenuRuntimeRef.current;
  if (!rt) return null;
  return {
    resolveEditable: (t) => (html(t)?.closest("[data-agent-input]") ? rt.inputRef.current : null),
    readValue: () => rt.getInput(),
    writeValue: (_, v) => rt.setInput(v),
    canEdit: () => rt.canEditInput(),
    getCustomMenuItems: () => [
      menuAction("Copy history", Copy, () => rt.copyHistory(), () => !rt.hasHistory()),
      menuAction("Clear history", Trash2, () => rt.clearHistory(), () => !rt.hasHistory()),
    ],
  };
}
