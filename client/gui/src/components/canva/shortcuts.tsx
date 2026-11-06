import { useEffect, useRef } from "react";
import type { WorkspaceTab } from "./logic";
import type { WorkspaceHandle } from "./workspace/logic";

let closeTopbarDropdowns: (() => void) | null = null;

export const topbarFloatEscapeBlockRef = { current: false };

export function registerTopbarDropdownCloser(fn: (() => void) | null) {
  closeTopbarDropdowns = fn;
}

export function dismissTopbarDropdowns() {
  closeTopbarDropdowns?.();
}

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPod|iPad/i.test(navigator.platform);

const modToken = () => (isMac ? "⌘" : "Ctrl");
const altToken = () => (isMac ? "⌥" : "Alt");

function chord(parts: string[]) {
  return parts.join("+");
}

const ctrlToken = () => "Ctrl";

const shiftOnly = (key: string) => chord(["Shift", key]);
const ctrlShift = (key: string) => chord([modToken(), "Shift", key]);
const tabsAlt = (key: string) => chord([altToken(), key]);
const shiftAlt = (key: string) => chord(["Shift", altToken(), key]);

export type ShortcutActionId =
  | "terminal"
  | "explorer"
  | "process"
  | "sessions"
  | "agent"
  | "credentials"
  | "docs"
  | "servers"
  | "listeners"
  | "implants"
  | "network"
  | "queue"
  | "logs"
  | "workspace_new"
  | "workspace_close_tab"
  | "workspace_close_panel"
  | "quit"
  | "view_zoom_in"
  | "view_zoom_out"
  | "view_zoom_reset"
  | "view_reload"
  | "view_fullscreen"
  | "view_devtools"
  | "terminal_font_increase"
  | "terminal_font_decrease"
  | "terminal_font_reset";

export const SHORTCUT_HINTS: Partial<Record<ShortcutActionId, string>> = {
  terminal: tabsAlt("T"),
  explorer: tabsAlt("F"),
  process: tabsAlt("R"),
  sessions: tabsAlt("S"),
  agent: tabsAlt("A"),
  credentials: tabsAlt("K"),
  workspace_new: ctrlShift("W"),
  workspace_close_tab: shiftAlt("W"),
  workspace_close_panel: chord([modToken(), "W"]),
  servers: shiftOnly("S"),
  listeners: shiftOnly("L"),
  implants: shiftOnly("I"),
  network: shiftOnly("N"),
  queue: shiftOnly("Q"),
  logs: shiftOnly("E"),
  docs: "F1",
  quit: ctrlShift("Q"),
  view_zoom_in: `${modToken()} +`,
  view_zoom_out: `${modToken()} -`,
  view_zoom_reset: chord([modToken(), "0"]),
  view_reload: chord([modToken(), "R"]),
  view_fullscreen: "F11",
  view_devtools: ctrlShift("I"),
  terminal_font_increase: `${chord([ctrlToken(), "Scroll"])} ↑`,
  terminal_font_decrease: `${chord([ctrlToken(), "Scroll"])} ↓`,
  terminal_font_reset: chord([ctrlToken(), altToken(), "0"]),
};

export function shortcutHint(id: ShortcutActionId): string | undefined {
  return SHORTCUT_HINTS[id];
}

export function ShortcutHint({ id }: { id: ShortcutActionId }) {
  const label = SHORTCUT_HINTS[id];
  if (!label) return null;
  return <span className="canva-shortcut-hint">{label}</span>;
}

export function shortcutTooltipSuffix(id: ShortcutActionId): string {
  const label = SHORTCUT_HINTS[id];
  return label ? ` <span class="canva-shortcut-hint">${label}</span>` : "";
}

export function workspaceTabHint(tabIndex: number): string | null {
  if (tabIndex < 0 || tabIndex > 8) return null;
  return tabsAlt(String(tabIndex + 1));
}

export function workspaceNewTabHint(): string {
  return SHORTCUT_HINTS.workspace_new ?? ctrlShift("W");
}

export type CanvaShortcutsProps = {
  tabs: WorkspaceTab[];
  activeId: string;
  floatType: string | null;
  setActiveId: (id: string) => void;
  setFloatType: (type: string | null) => void;
  addTab: () => void;
  closeTab: (id: string) => void;
  openWindow: (type: string) => void;
  floatWindow: (type: string) => void;
  workspaceRefs: React.MutableRefObject<Map<string, WorkspaceHandle>>;
};

const isMod = (e: KeyboardEvent) => e.ctrlKey || e.metaKey;

// const isTypingTarget = (target: EventTarget | null) => {
//   if (!(target instanceof HTMLElement)) return false;
//   const tag = target.tagName;
//   if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
//   return target.isContentEditable;
// };

const TAB_PANEL_BY_KEY: Record<string, string> = {
  t: "terminal",
  f: "explorer",
  r: "process",
  s: "sessions",
  a: "agent",
  k: "credentials",
};

const SHIFT_FLOAT_BY_KEY: Record<string, string> = {
  s: "servers",
  l: "listeners",
  i: "implants",
  n: "network",
  q: "queue",
  e: "logs",
};

const sendWindow = (channel: string) => {
  window.electronAPI?.send(channel);
};

const runShortcut = (e: KeyboardEvent, action: () => void) => {
  e.preventDefault();
  dismissTopbarDropdowns();
  action();
};

export function CanvaShortcuts({
  tabs,
  activeId,
  floatType,
  setActiveId,
  setFloatType,
  addTab,
  closeTab,
  openWindow,
  floatWindow,
  workspaceRefs,
}: CanvaShortcutsProps) {
  const tabsRef = useRef(tabs);
  const activeIdRef = useRef(activeId);
  const floatTypeRef = useRef(floatType);
  const addTabRef = useRef(addTab);
  const closeTabRef = useRef(closeTab);
  const openWindowRef = useRef(openWindow);
  const floatWindowRef = useRef(floatWindow);
  tabsRef.current = tabs;
  activeIdRef.current = activeId;
  floatTypeRef.current = floatType;
  addTabRef.current = addTab;
  closeTabRef.current = closeTab;
  openWindowRef.current = openWindow;
  floatWindowRef.current = floatWindow;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismissTopbarDropdowns();
        if (floatTypeRef.current && !topbarFloatEscapeBlockRef.current) {
          setFloatType(null);
        }
        return;
      }

      if (e.key === "F1") {
        // if (isTypingTarget(e.target)) return;
        runShortcut(e, () =>
          window.open("https://nukerat.com/docs", "_blank")
        );
        return;
      }

      if (e.key === "F11") {
        runShortcut(e, () => sendWindow("window:toggleFullscreen"));
        return;
      }

      const mod = isMod(e);

      if (mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === "i") {
        runShortcut(e, () => sendWindow("window:toggleDevTools"));
        return;
      }

      if (mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === "w") {
        runShortcut(e, () => addTabRef.current());
        return;
      }

      if (mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === "q") {
        runShortcut(e, () => window.close());
        return;
      }

      if (e.shiftKey && e.altKey && !mod && e.key.toLowerCase() === "w") {
        runShortcut(e, () => closeTabRef.current(activeIdRef.current));
        return;
      }

      if (mod && !e.shiftKey && !e.altKey) {
        if (e.code === "Digit0" || e.code === "Numpad0") {
          runShortcut(e, () => sendWindow("window:resetZoom"));
          return;
        }
        if (e.key.toLowerCase() === "w") {
          runShortcut(e, () =>
            workspaceRefs.current
              .get(activeIdRef.current)
              ?.closeHoveredPanel?.()
          );
          return;
        }
        if (e.key.toLowerCase() === "r") {
          runShortcut(e, () => sendWindow("window:reload"));
          return;
        }
        if (e.key === "=" || e.key === "+") {
          runShortcut(e, () => sendWindow("window:zoomIn"));
          return;
        }
        if (e.key === "-" || e.key === "_") {
          runShortcut(e, () => sendWindow("window:zoomOut"));
          return;
        }
      }

      if (e.shiftKey && !mod && !e.altKey) {
        // if (isTypingTarget(e.target)) return;
        const floatTypeKey = SHIFT_FLOAT_BY_KEY[e.key.toLowerCase()];
        if (floatTypeKey) {
          runShortcut(e, () => floatWindowRef.current(floatTypeKey));
          return;
        }
      }

      if (e.altKey && !mod && !e.shiftKey) {
        const key = e.key.toLowerCase();
        const panel = TAB_PANEL_BY_KEY[key];
        if (panel) {
          // if (isTypingTarget(e.target)) return;
          runShortcut(e, () => openWindowRef.current(panel));
          return;
        }
        const i = Number(e.key) - 1;
        const list = tabsRef.current;
        if (i >= 0 && i < list.length) {
          runShortcut(e, () => setActiveId(list[i].id));
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [setActiveId, setFloatType, workspaceRefs]);

  return null;
}
