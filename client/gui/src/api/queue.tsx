import type { Session } from "@/api/sessions";
import { getServers, type ServerEntry } from "@/api/system/config";
import { addBearer } from "@/api/system/auth";
import { responseErrorMessage, thrownErrorMessage, unreachableHost } from "@/api/http_status";

export type QueueQuery = {
  search?: string;
  hostTag?: string;
  page?: number;
  pageSize?: number;
  server?: string;
};

export type QueueItem = {
  tag: string;
  hostTag: string;
  host: string;
  type: string;
  input: string;
  parameters: string;
  isCompleted: number;
  error: string;
  customResponse?: string;
  captured: number;
  createdAt: string;
  output?: string;
  server?: string;
};

export type QueueListResponse = {
  status: string;
  message?: string;
  content?: QueueItem[];
  hosts?: Session[];
  total?: number;
  page?: number;
  pageSize?: number;
};

export type QueueDeleteResponse = {
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

function buildQuery(query: QueueQuery = {}) {
  const qs = new URLSearchParams();
  if (query.search?.trim()) qs.set("search", query.search.trim());
  if (query.hostTag && query.hostTag !== "all") qs.set("hostTag", query.hostTag);
  if (query.page) qs.set("page", String(query.page));
  if (query.pageSize) qs.set("pageSize", String(query.pageSize));
  const built = qs.toString();
  return built ? `?${built}` : "";
}

function mapQueueItem(item: any, server: string): QueueItem {
  const rest = { ...item };
  delete rest.id;
  delete rest.session_id;
  return {
    ...rest,
    tag: item?.tag ?? "",
    hostTag: item?.hostTag ?? "",
    host: item?.host ?? "",
    type: item?.type ?? "",
    input: item?.input ?? "",
    parameters: item?.parameters ?? "",
    isCompleted: Number(item?.isCompleted ?? 0),
    error: item?.error ?? "",
    customResponse: item?.customResponse ?? "",
    captured: Number(item?.captured ?? 0),
    createdAt: item?.createdAt ?? "",
    output: item?.output ?? "",
    server,
  };
}

export const fetchQueue = async (
  query: QueueQuery = {},
  signal?: AbortSignal,
): Promise<QueueListResponse> => {
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
            const response = await fetch(`${ip}:${port}/api/queue/${qs}`, {
              method: "GET",
              signal,
              headers: addBearer(entry),
            });
            const text = await response.text();
            const json = parseErrorBody(text);
            if (!response.ok) {
              return {
                status: json?.status ?? "failure",
                message: `${entry.name}: ${responseErrorMessage(response.status, json?.message)}`,
              };
            }
            if (!ok(json?.status)) {
              return {
                status: json?.status ?? "failure",
                message: `${entry.name}: ${responseErrorMessage(response.status, json?.message)}`,
              };
            }
            return { ...json, server: `${ip}:${port}` };
          } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
              return { status: "error", message: "Cancelled" };
            }
            return {
              status: "ERR_conn",
              message: `${entry.name}: Unreachable host`,
            };
          }
        }),
      )
    ).filter((r) => r !== null);

    const success = responses.filter((r) => ok(r?.status));
    if (success.length === 0) {
      return responses[0] ?? { status: "failure", message: unreachableHost(servers[0]?.name) };
    }

    const content = success.flatMap((res) =>
      (Array.isArray(res?.content) ? res.content : []).map((item: any) =>
        mapQueueItem(item, res.server),
      ),
    );
    const hosts = success.flatMap((res) => {
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
      total: success.reduce((n, r) => n + (Number(r.total) || 0), 0),
      page: Number(success[0]?.page) || params.page || 1,
      pageSize: Number(success[0]?.pageSize) || params.pageSize || 50,
    };
  } catch (error) {
    const message = thrownErrorMessage(error);
    return { status: "error", message };
  }
};

export const deleteQueue = async (
  tag: string,
  server?: string,
): Promise<QueueDeleteResponse> => {
  const servers = (await getServers()).filter((s) => matchServer(s, server));
  if (servers.length === 0) {
    return {
      status: "failure",
      message: server ? "Server not found" : "No servers configured",
    };
  }

  let lastError: QueueDeleteResponse = {
    status: "failure",
    message: "Request failed",
  };

  for (const entry of servers) {
    const ip = entry.ip?.trim().replace(/\/$/, "");
    const port = entry.port?.trim();
    if (!ip || !port) continue;

    try {
      const response = await fetch(
        `${ip}:${port}/api/queue/${encodeURIComponent(tag)}`,
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
