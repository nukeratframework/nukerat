import { useState, useRef, useEffect, useCallback } from "react";
import { getServers } from "@/api/system/config";
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
};

export interface WorkspaceTab {
  id: string;
  name: string;
  hasWindows: boolean;
  pendingWindow: string | null;
  pendingPanelParams: PanelOpenParams | null;
}

const mkTab = (n: number): WorkspaceTab => ({
  id: String(Date.now()),
  name: `Workspace ${n}`,
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
      const nums = prev.map(
        (t) => parseInt(t.name.replace("Workspace ", ""), 10) || 0
      );
      const nextN = Math.max(0, ...nums) + 1;
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
    const ctrls: AbortController[] = [];

    getServers().then((servers) => {
      for (const server of servers) {
        const ctrl = new AbortController();
        ctrls.push(ctrl);
        (async () => {
          while (alive) {
            try {
              const res = await fetchServerNotifications(server, ctrl.signal);
              if (!alive) break;
              if (res.hosts.length) setNotifyBatch((p) => [...p, ...res.hosts].slice(-5));
            } catch (e) {
              if (!alive || (e instanceof DOMException && e.name === "AbortError")) break;
              await new Promise((r) => setTimeout(r, 8000));
            }
          }
        })();
        (async () => {
          while (alive) {
            try {
              const res = await fetchServerCustomNotifications(server, ctrl.signal);
              if (!alive) break;
              if (res.custom.length) setNotifyBatch((p) => [...p, ...res.custom].slice(-5));
            } catch (e) {
              if (!alive || (e instanceof DOMException && e.name === "AbortError")) break;
              await new Promise((r) => setTimeout(r, 8000));
            }
          }
        })();
      }
    });

    return () => {
      alive = false;
      ctrls.forEach((c) => c.abort());
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
