import { useImperativeHandle, useRef, type Ref } from "react";
import type { DockviewApi } from "dockview";
import type { Session } from "@/api/sessions";

function panelAtPointer(api: DockviewApi, clientX: number, clientY: number) {
  const hit = document.elementFromPoint(clientX, clientY);
  if (!hit) return undefined;

  for (const panel of api.panels) {
    const content = panel.view?.content?.element;
    const tab = panel.view?.tab?.element;
    if (content && (content === hit || content.contains(hit))) return panel;
    if (tab && (tab === hit || tab.contains(hit))) return panel;
  }

  for (const group of api.groups) {
    const el = (group as { element?: HTMLElement }).element;
    if (el?.contains(hit)) return group.activePanel;
  }

  return undefined;
}

export type SessionSelectData = { host: Session; server: string } | null;

export type PanelOpenParams = { selectedHost?: SessionSelectData };

export const pendingPanelParamsRef = {
  current: null as PanelOpenParams | null,
};

export interface WorkspaceProps {
  setWindows: (hasWindows: boolean) => void;
  pendingWindow?: string | null;
  pendingPanelParams?: PanelOpenParams | null;
  onWindowOpen?: () => void;
}

export type WorkspaceHandle = {
  openWindow: (windowType: string) => void;
  closeHoveredPanel: () => void;
};

const hostless_titles = new Set([
  "Docs",
  "Graphs",
  "Sessions",
  "File Server",
  "AI Agent",
  "Keylogger",
  "Queue",
  "NukeScripts",
  "Credentials",
  "NS Debugger",
  "Listeners",
  "Network",
  "Servers",
  "Implants",
  "Logs",
  "Agents",
  "IOCs",
  "Reports",
  "About",
]);

export function getPanelTitle(windowType: string): string {
  if (windowType === "agent") return "AI Agent";
  if (windowType === "explorer") return "File Browser";
  if (windowType === "fileServer") return "File Server";
  if (windowType === "nukescripts_output") return "NS Debugger";
  if (windowType === "nukescripts") return "NukeScripts";
  if (windowType === "iocs") return "IOCs";
  return windowType.charAt(0).toUpperCase() + windowType.slice(1);
}

export function shouldShowHostSelect(title: string | undefined): boolean {
  return !hostless_titles.has(title ?? "");
}

export function getPanelHeaderJustify(title: string | undefined): "left" | "between" {
  return hostless_titles.has(title ?? "") ? "left" : "between";
}

export function useWorkspace(
  { setWindows, pendingWindow, pendingPanelParams, onWindowOpen }: WorkspaceProps,
  ref: Ref<WorkspaceHandle>
) {
  const dockviewRef = useRef<DockviewApi | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  const addPanel = (windowType: string, panelParams?: PanelOpenParams | null) => {
    if (!dockviewRef.current) return;
    const params = panelParams ?? pendingPanelParamsRef.current;
    pendingPanelParamsRef.current = null;
    dockviewRef.current.addPanel({
      id: `${windowType}-${Date.now()}`,
      component: windowType,
      tabComponent: "header",
      title: getPanelTitle(windowType),
      position: { direction: "right" },
      ...(params ? { params } : {}),
    });
  };

  const closeHoveredPanel = () => {
    const api = dockviewRef.current;
    if (!api) return;
    const { x, y } = pointerRef.current;
    const panel = panelAtPointer(api, x, y) ?? api.activePanel ?? undefined;
    panel?.api.close();
  };

  useImperativeHandle(ref, () => ({
    openWindow: addPanel,
    closeHoveredPanel,
  }));

  const onWorkspacePointerMove = (e: React.PointerEvent) => {
    pointerRef.current = { x: e.clientX, y: e.clientY };
  };

  const onDockviewReady = (e: { api: any }) => {
    dockviewRef.current = e.api;
    e.api.onDidAddPanel(() => setWindows(e.api.panels.length > 0));
    e.api.onDidRemovePanel(() => setWindows(e.api.panels.length > 0));

    if (pendingWindow) {
      addPanel(pendingWindow, pendingPanelParams);
      onWindowOpen?.();
    }
  };

  return { onDockviewReady, onWorkspacePointerMove };
}
