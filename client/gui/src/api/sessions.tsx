import { getServers, type ServerEntry } from "@/api/system/config";
import { addBearer } from "@/api/system/auth";
import { responseErrorMessage, thrownErrorMessage, unreachableHost } from "@/api/http_status";

export interface Session {
  id: number;
  tag: string;
  ip: string;
  internal?: string;
  external_ip?: string;
  listener?: string;
  privilege?: string | null;
  notes?: string | null;
  process?: string | null;
  pid?: number | null;
  arch?: string;
  os: string;
  user?: string;
  hostname?: string;
  first_seen: string;
  last_seen: string;
  last_activity?: string;
  delay: number;
  host_server?: string;
  host_port?: string;
  implant_config: string;
  _server?: string;
}

export type SessionListMode = "default" | "graphs" | "sessions_lp";

export type SessionsFetchOpts = {
  signal?: AbortSignal;
  selectedServer?: string;
  onPartial?: (sessions: Session[]) => void;
};

function matchServer(entry: ServerEntry, target?: string) {
  const ip = entry.ip?.trim().replace(/\/$/, "");
  const port = entry.port?.trim();
  if (!ip || !port) return false;
  const base = `${ip}:${port}`;
  if (!target?.trim()) return true;
  return base === target.trim().replace(/\/+$/, "");
}

function parseErrorBody(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildQuery(mode: SessionListMode, longPolling?: boolean) {
  const qs = new URLSearchParams({ mode });
  if (mode === "graphs" && longPolling === false) {
    qs.set("long_polling", "false");
  }
  const query = qs.toString();
  return query ? `?${query}` : "";
}

async function getSessionsFromServer(
  server: ServerEntry,
  query: string,
  signal?: AbortSignal,
  onPartial?: (sessions: Session[]) => void,
) {
  const ip = server.ip?.trim().replace(/\/$/, "");
  const port = server.port?.trim();
  if (!ip || !port) return null;
  const base = `${ip}:${port}`;

  const response = await fetch(`${base}/api/sessions/${query}`, {
    method: "GET",
    signal,
    headers: addBearer(server),
  });
  const text = await response.text();
  if (!response.ok) {
    const json = parseErrorBody(text);
    return {
      status: json?.status ?? "failure",
      message: `${server.name}: ${responseErrorMessage(response.status, json?.message)}`,
      server: base,
    };
  }

  const data = JSON.parse(text);
  if (data?.status === "success" && Array.isArray(data?.sessions)) {
    onPartial?.(data.sessions.map((h: Session) => ({ ...h, _server: base })));
  }
  return { ...data, server: base };
}

export const fetchSessions = async (
  mode: SessionListMode = "default",
  signal?: AbortSignal,
  longPolling?: boolean,
  opts: SessionsFetchOpts = {},
): Promise<any> => {
  const { selectedServer, onPartial } = opts;

  try {
    const servers = (await getServers()).filter((s) => matchServer(s, selectedServer));
    if (servers.length === 0) {
      return {
        status: "failure",
        message: selectedServer ? "Server not found" : "No servers configured",
      };
    }

    const query = buildQuery(mode, longPolling);
    const responses = (
      await Promise.all(
        servers.map((server) =>
          getSessionsFromServer(server, query, signal, onPartial).catch((error) => {
            if (error instanceof Error && error.name === "AbortError") {
              return { status: "error", message: `${server.name}:Connection timed out` };
            }
            return {
              status: "ERR_conn",
              name: server.name,
              message: `${server.name}: Unreachable host`,
            };
          }),
        ),
      )
    ).filter((r) => r !== null);

    const hasSuccess = responses.some((r) => r?.status === "success");
    if (!hasSuccess) {
      return responses[0] ?? { status: "failure", message: unreachableHost(servers[0]?.name) };
    }

    if (mode === "graphs") {
      return {
        status: "success",
        graphs: responses
          .filter((r) => r?.status === "success")
          .map((res) => ({
            server: res.server ?? "",
            chains: Array.isArray(res.chains) ? res.chains : [],
            data: Object.fromEntries(
              Object.entries(res.data ?? {}).map(([tag, session]) => [
                tag,
                { ...(session as Session), _server: res.server ?? "" },
              ]),
            ),
          })),
      };
    }

    return {
      status: "success",
      sessions: responses.flatMap((res) =>
        (Array.isArray(res?.sessions) ? res.sessions : []).map((h: Session) => ({
          ...h,
          _server: h._server ?? res.server ?? "",
        })),
      ),
    };
  } catch (error) {
    const msg = thrownErrorMessage(error);
    return { status: "error", message: msg, error: msg };
  }
};

export const DataFetch = async (
  onPartial?: (sessions: Session[]) => void,
): Promise<any> => {
  const res = await fetchSessions("default", undefined, undefined, { onPartial });
  if (res?.status !== "success") return res;
  return { status: "success" };
};

export const DeleteSession = async (tag: string, server: string): Promise<any> => {
  const servers = (await getServers()).filter((s) => matchServer(s, server));
  if (servers.length === 0) {
    return { status: "failure", message: "Server not found" };
  }

  let lastError: any = { status: "failure", message: "Request failed" };
  for (const entry of servers) {
    const ip = entry.ip?.trim().replace(/\/$/, "");
    const port = entry.port?.trim();
    if (!ip || !port) continue;

    try {
      const response = await fetch(
        `${ip}:${port}/api/sessions/${encodeURIComponent(tag)}`,
        {
          method: "DELETE",
          headers: addBearer(entry),
        },
      );
      const text = await response.text();
      const json = parseErrorBody(text);
      if (response.ok && json?.status === "success") {
        return json;
      }
      lastError = {
        status: json?.status ?? "failure",
        message: `${entry.name}: ${responseErrorMessage(response.status, json?.message)}`,
      };
    } catch {
      lastError = {
        status: "ERR_conn",
        message: `${entry.name}: Unreachable host`,
      };
    }
  }

  return lastError;
};

export const EditSession = async (
  tag: string,
  notes: string,
  server: string,
): Promise<any> => {
  const servers = (await getServers()).filter((s) => matchServer(s, server));
  if (servers.length === 0) {
    return { status: "failure", message: "Server not found" };
  }

  let lastError: any = { status: "failure", message: "Request failed" };
  for (const entry of servers) {
    const ip = entry.ip?.trim().replace(/\/$/, "");
    const port = entry.port?.trim();
    if (!ip || !port) continue;

    try {
      const response = await fetch(
        `${ip}:${port}/api/sessions/${encodeURIComponent(tag)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(await addBearer(entry)),
          },
          body: JSON.stringify({ notes }),
        },
      );
      const text = await response.text();
      const json = parseErrorBody(text);
      if (response.ok && json?.status === "success") {
        return json;
      }
      lastError = {
        status: json?.status ?? "failure",
        message: `${entry.name}: ${responseErrorMessage(response.status, json?.message)}`,
      };
    } catch {
      lastError = {
        status: "ERR_conn",
        message: `${entry.name}: Unreachable host`,
      };
    }
  }

  return lastError;
};
