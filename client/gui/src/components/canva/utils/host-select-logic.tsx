import { useEffect, useId, useRef, useState } from "react";
import { DataFetch, type Session } from "@/api/sessions";
import type { SessionSelectData } from "../workspace/logic";

export interface HostSelectBoxProps {
  onSelect?: (data: SessionSelectData) => void;
  hide?: boolean;
  panelSelectedHost?: SessionSelectData | null;
}

export function useHostSelect(
  onSelect?: (data: SessionSelectData) => void,
  panelSelectedHost?: SessionSelectData | null,
) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const pinnedHostRef = useRef<Session | null>(null);
  const [value, setValue] = useState(() =>
    panelSelectedHost?.host != null ? String(panelSelectedHost.host.id) : ""
  );
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);

  const loadSessions = () => {
    setLoading(true);
    const collected: Session[] = [];
    DataFetch((partial) => {
      collected.push(...partial);
    }).then((res) => {
      setResponse(res);
      setSessions((prev) =>
        JSON.stringify(prev) === JSON.stringify(collected) ? prev : collected
      );
      setLoading(false);
    });
  };

  useEffect(() => {
    const host = panelSelectedHost?.host;
    if (!host) {
      pinnedHostRef.current = null;
      setValue("");
      return;
    }
    pinnedHostRef.current = host;
    setValue(String(host.id));
    onSelect?.(panelSelectedHost);
  }, [panelSelectedHost?.host?.id, panelSelectedHost?.server]);

  const groups = sessions.reduce<Record<string, Session[]>>((acc, session) => {
    const key = session._server ?? "Unknown";
    (acc[key] ??= []).push(session);
    return acc;
  }, {});

  const selectedHost =
    value === ""
      ? null
      : (sessions.find((h) => String(h.id) === value) ??
        panelSelectedHost?.host ??
        pinnedHostRef.current ??
        null);

  const selectHost = (host: Session, server: string) => {
    if (value === String(host.id)) {
      pinnedHostRef.current = null;
      setValue("");
      onSelect?.(null);
    } else {
      setValue(String(host.id));
      onSelect?.({ host, server });
    }
    setOpen(false);
  };

  return {
    id,
    open,
    setOpen,
    value,
    loading,
    response,
    groups,
    selectedHost,
    loadHosts: loadSessions,
    selectHost,
  };
}
