import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { DockviewApi } from "dockview";
import type { Session } from "@/api/sessions";
import i18n, { translate } from "@/i18n";
import { PANEL_TITLE_KEY, type PanelId } from "../panels";

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

/** Dockview panel params: the host selection plus the stable panel identity. */
export type PanelParams = PanelOpenParams & { panelId?: string };

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

/** Translated title for a panel id. Unknown ids fall back to the raw id. */
export function panelTitle(panelId: string | null | undefined): string {
  const key = panelId ? PANEL_TITLE_KEY[panelId as PanelId] : undefined;
  return key ? translate(key) : (panelId ?? "");
}

export function panelIdFromParams(params: unknown): string | undefined {
  return (params as PanelParams | undefined)?.panelId;
}

export function useWorkspace(
  { setWindows, pendingWindow, pendingPanelParams, onWindowOpen }: WorkspaceProps,
  ref: Ref<WorkspaceHandle>
) {
  const dockviewRef = useRef<DockviewApi | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  // Titles are baked in at addPanel time, so a language switch has to rewrite
  // the headers of panels that are already open.
  useEffect(() => {
    const relabel = () => {
      const api = dockviewRef.current;
      if (!api) return;
      for (const panel of api.panels) {
        const panelId = panelIdFromParams(panel.params);
        if (panelId) panel.api.setTitle(panelTitle(panelId));
      }
    };
    i18n.on("languageChanged", relabel);
    return () => i18n.off("languageChanged", relabel);
  }, []);

  const addPanel = (windowType: string, panelParams?: PanelOpenParams | null) => {
    if (!dockviewRef.current) return;
    const params = panelParams ?? pendingPanelParamsRef.current;
    pendingPanelParamsRef.current = null;
    dockviewRef.current.addPanel({
      id: `${windowType}-${Date.now()}`,
      component: windowType,
      tabComponent: "header",
      title: panelTitle(windowType) || translate("common.unknown"),
      position: { direction: "right" },
      params: { panelId: windowType, ...(params ?? {}) },
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
