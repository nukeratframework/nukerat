import { toast } from "sonner";
import type { PanelCustomMenuItem, PanelEditMenuBridge, TerminalMenuRuntime } from "./types.ts";
import { html, pathInput } from "./util.ts";

export const terminalMenuRuntimeRef: { current: TerminalMenuRuntime | null } = { current: null };

export function terminalCanCopyContext() {
  const rt = terminalMenuRuntimeRef.current;
  return rt?.canCopyContext() ?? false;
}

export function copyTerminalContext() {
  const rt = terminalMenuRuntimeRef.current;
  if (!rt?.canCopyContext()) return;
  void navigator.clipboard.writeText(
    JSON.stringify({ terminal: ["terminal", ...rt.getOutput()] }),
  );
  toast.success("Terminal context copied");
}

export function buildTerminalStyleMenuItems(): PanelCustomMenuItem[] {
  const rt = terminalMenuRuntimeRef.current;
  if (!rt) return [];

  return [
    {
      kind: "action",
      label: "Style",
      items: [
        {
          kind: "action",
          label: "Font",
          items: [
            {
              kind: "header",
              label: `${rt.getFontSize()}px`,
            },
            { kind: "separator" },
            {
              kind: "action",
              label: "Increase",
              shortcutId: "terminal_font_increase",
              onClick: () => rt.increaseFont(),
              disabled: () => !rt.canIncreaseFont(),
            },
            {
              kind: "action",
              label: "Decrease",
              shortcutId: "terminal_font_decrease",
              onClick: () => rt.decreaseFont(),
              disabled: () => !rt.canDecreaseFont(),
            },
            { kind: "separator" },
            {
              kind: "action",
              label: "Reset",
              shortcutId: "terminal_font_reset",
              onClick: () => rt.resetFont(),
              disabled: () => !rt.canResetFont(),
            },
          ],
        },
      ],
    },
  ];
}

export function createTerminalBridge(): PanelEditMenuBridge {
  const rt = terminalMenuRuntimeRef.current;
  return {
    resolveEditable: (t) => pathInput(t, "[data-terminal-input]", "[data-terminal-input-field]"),
    resolveStaticTextRegion: (t) => {
      const r = html(t)?.closest("[data-terminal-output]");
      return r instanceof HTMLElement ? r : null;
    },
    readValue: () => rt?.getInput() ?? "",
    writeValue: (_, v) => rt?.setInput(v),
    canEdit: () => rt?.canEditInput() ?? false,
    getFooterMenuItems: () => buildTerminalStyleMenuItems(),
  };
}
