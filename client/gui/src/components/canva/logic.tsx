import { useState, useRef, useEffect, useCallback } from "react";
import type { LooseT } from "@/i18n";
import { getServers, subscribeServers } from "@/api/system/config";
import { fetchServerNotifications, fetchServerCustomNotifications, type NotifyHost, type NotifyCustom } from "@/api/notification";
import { DataFetch, type Session } from "@/api/sessions";
import { pendingPanelParamsRef, type PanelOpenParams, type SessionSelectData } from "./workspace/logic";
import ListenersPanel from "./topbar/listeners/index";
import NetworkPanel from "./topbar/network/index";
import ServersPanel from "./topbar/servers/index";
import ImplantsPanel from "./topbar/implants/index";
import LogsPanel from "./topbar/logs/index";
import AgentsPanel from "./topbar/agents/index";
import QueuePanel from "./topbar/queue/index";
import IocPanel from "./topbar/iocs/index";
import ScriptsPanel from "./topbar/nukescripts/index";
import ReportsPanel from "./topbar/reports/index";
import AboutPanel from "./topbar/about/index";
import PreferencesPanel from "./topbar/preferences/index";


export const floatComponents: Record<string, React.ComponentType> = {
  listeners: ListenersPanel,
  network: NetworkPanel,
  servers: ServersPanel,
  implants: ImplantsPanel,
  logs: LogsPanel,
  agents: AgentsPanel,
  queue: QueuePanel,
  iocs: IocPanel,
  nukescripts: ScriptsPanel,
  reports: ReportsPanel,
  about: AboutPanel,
  preferences: PreferencesPanel,
};

export interface WorkspaceTab {
  id: string;
  /** 1-based ordinal shown as `workspace.tabName` until the user renames it. */
  tabNumber: number;
  /** User-supplied name; `null` means "show the translated default". */
  customName: string | null;
  hasWindows: boolean;
  pendingWindow: string | null;
  pendingPanelParams: PanelOpenParams | null;
}

export function workspaceTabLabel(
  tab: Pick<WorkspaceTab, "tabNumber" | "customName">,
  t: LooseT,
): string {
  return tab.customName ?? t("workspace.tabName", { n: tab.tabNumber });
}

const mkTab = (n: number): WorkspaceTab => ({
  id: String(Date.now()),
  tabNumber: n,
  customName: null,
  hasWindows: false,
  pendingWindow: null,
  pendingPanelParams: null,
});

const initial = mkTab(1);

export const notifyDurationSecs = 3;

export function useCanva() {
  const [tabs, setTabs] = useState<WorkspaceTab[]>([initial]);
  const [activeId, setActiveId] = useState(initial.id);
  const [floatType, setFloatType] = useState<string | null>(null);
  const [notifyBatch, setNotifyBatch] = useState<(NotifyHost | NotifyCustom)[]>([]);
  const refs = useRef<Map<string, any>>(new Map());

  const updateTab = (id: string, patch: Partial<WorkspaceTab>) =>
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const openWindow = useCallback((type: string, panelParams?: PanelOpenParams | null) => {
    let openExisting = false;
    setTabs((prev) => {
      const tab = prev.find((t) => t.id === activeId);
      if (!tab) return prev;
      if (!tab.hasWindows) {
        return prev.map((t) =>
          t.id === activeId
            ? {
                ...t,
                hasWindows: true,
                pendingWindow: type,
                pendingPanelParams: panelParams ?? null,
              }
            : t
        );
      }
      openExisting = true;
      return prev;
    });
    if (openExisting) {
      pendingPanelParamsRef.current = panelParams ?? null;
      refs.current.get(activeId)?.openWindow?.(type);
    }
  }, [activeId]);

  const openWindowForNotify = useCallback((type: string, n: NotifyHost) => {
    const collected: Session[] = [];
    void DataFetch((partial) => collected.push(...partial)).then(() => {
      const match =
        collected.find((s) => n.tag && s.tag === n.tag) ??
        collected.find((s) => s.ip === n.ip);
      if (!match) return;
      const selectedHost: SessionSelectData = {
        host: match,
        server: match._server ?? "Unknown",
      };
      openWindow(type, { selectedHost });
    });
  }, [openWindow]);

  const openTerminalForNotify = useCallback(
    (n: NotifyHost) => openWindowForNotify("terminal", n),
    [openWindowForNotify],
  );

  const addTab = () => {
    let newId = "";
    setTabs((prev) => {
      const nextN = prev.reduce((max, t) => Math.max(max, t.tabNumber), 0) + 1;
      const t = mkTab(nextN);
      newId = t.id;
      return [...prev, t];
    });
    if (newId) setActiveId(newId);
  };

  const closeTab = (id: string) => {
    if (tabs.length <= 1) return;
    const next = tabs.filter((t) => t.id !== id);
    if (activeId === id) setActiveId(next[next.length - 1].id);
    refs.current.delete(id);
    setTabs(next);
  };

  useEffect(() => {
    const hasAnyWindow = tabs.some((tab) => tab.hasWindows);
    window.electronAPI.send("app:setHasWindows", hasAnyWindow);
  }, [tabs]);

  useEffect(() => {
    let alive = true;
    let ticket = 0;
    const running = new Map<string, AbortController>();

    const pull = () => {
      const mine = ++ticket;
      void getServers().then((servers) => {
        if (!alive || mine !== ticket) return;
        const keys = new Set<string>();
        for (const server of servers) {
          if (!server.token?.trim() || !server.ip?.trim() || !server.port?.trim()) continue;
          const key = `${server.id}\0${server.ip}\0${server.port}\0${server.token}`;
          keys.add(key);
          if (running.has(key)) continue;
          const ctrl = new AbortController();
          running.set(key, ctrl);
          (async () => {
            while (alive && !ctrl.signal.aborted) {
              try {
                const res = await fetchServerNotifications(server, ctrl.signal);
                if (!alive || ctrl.signal.aborted) break;
                if (res.hosts.length) setNotifyBatch((p) => [...p, ...res.hosts].slice(-5));
              } catch (e) {
                if (!alive || ctrl.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) break;
                await new Promise((r) => setTimeout(r, 8000));
              }
            }
          })();
          (async () => {
            while (alive && !ctrl.signal.aborted) {
              try {
                const res = await fetchServerCustomNotifications(server, ctrl.signal);
                if (!alive || ctrl.signal.aborted) break;
                if (res.custom.length) setNotifyBatch((p) => [...p, ...res.custom].slice(-5));
              } catch (e) {
                if (!alive || ctrl.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) break;
                await new Promise((r) => setTimeout(r, 8000));
              }
            }
          })();
        }
        for (const [key, ctrl] of running) {
          if (keys.has(key)) continue;
          ctrl.abort();
          running.delete(key);
        }
      });
    };

    const stop = subscribeServers(pull);
    pull();
    return () => {
      alive = false;
      stop();
      running.forEach((c) => c.abort());
    };
  }, []);

  const FloatComp = floatType ? floatComponents[floatType] : null;

  return {
    tabs,
    activeId,
    floatType,
    notifyBatch,
    setNotifyBatch,
    FloatComp,
    refs,
    setActiveId,
    setFloatType,
    openWindow,
    openTerminalForNotify,
    openWindowForNotify,
    addTab,
    closeTab,
    updateTab,
  };
}
