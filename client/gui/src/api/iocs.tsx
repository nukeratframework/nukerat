import { getServers, type ServerEntry } from "@/api/system/config";
import { addBearer } from "@/api/system/auth";
import { httpStatusMessage, responseErrorMessage, thrownErrorMessage, unreachableHost } from "@/api/http_status";

export type IocItem = {
  tag: string;
  type: string;
  value: string;
  hostTag: string;
  createdAt: string;
  server?: string;
};

const ok = (s?: string) => s === "success" || s === "successfull";

function matchServer(entry: ServerEntry, target?: string) {
  const ip = entry.ip?.trim().replace(/\/$/, "");
  const port = entry.port?.trim();
  if (!ip || !port) return false;
  const base = `${ip}:${port}`;
  if (!target?.trim()) return true;
  const t = target.trim().replace(/\/+$/, "").replace(/\/api\/iocs\/?$/i, "");
  return base === t;
}

function parseErrorBody(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function mapIocItem(item: any, server: string): IocItem {
  const rest = { ...item };
  delete rest.id;
  delete rest.session_id;
  return {
    ...rest,
    tag: item?.tag ?? "",
    type: item?.type ?? "",
    value: item?.value ?? "",
    hostTag: item?.hostTag ?? "",
    createdAt: item?.createdAt ?? "",
    server: item?.server || server || "",
  };
}

function buildQuery(params?: {
  search?: string;
  hostTags?: string[];
  page?: number;
  pageSize?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.search?.trim()) qs.set("search", params.search.trim());
  for (const tag of params?.hostTags ?? []) {
    const text = tag.trim();
    if (text) qs.append("hostTags", text);
  }
  if (params?.page) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  const query = qs.toString();
  return query ? `?${query}` : "";
}

export const fetchIocs = async (params?: {
  search?: string;
  hostTags?: string[];
  page?: number;
  pageSize?: number;
}): Promise<{
  status: string;
  content?: IocItem[];
  total?: number;
  message?: string;
}> => {
  try {
    const servers = await getServers();
    if (servers.length === 0) {
      return { status: "failure", message: "No servers configured" };
    }

    const query = buildQuery(params);
    const responses = (
      await Promise.all(
        servers.map(async (server) => {
          const ip = server.ip?.trim().replace(/\/$/, "");
          const port = server.port?.trim();
          if (!ip || !port) return null;

          try {
            const response = await fetch(`${ip}:${port}/api/iocs/${query}`, {
              method: "GET",
              headers: addBearer(server),
            });
            const text = await response.text();
            if (!response.ok) {
              return {
                status: "failure",
                message: `${server.name}: ${httpStatusMessage(response.status)}`,
              };
            }
            const data = JSON.parse(text);
            return { ...data, server: `${ip}:${port}` };
          } catch {
            return { status: "ERR_conn", message: `${server.name}: Unreachable host` };
          }
        }),
      )
    ).filter((r) => r !== null);

    const loaded = responses.filter((r) => ok(r.status));
    if (loaded.length === 0) {
      return responses[0] ?? { status: "failure", message: unreachableHost(servers[0]?.name) };
    }

    return {
      status: "success",
      content: loaded.flatMap((res) =>
        (Array.isArray(res?.content) ? res.content : []).map((item: any) =>
          mapIocItem(item, res.server),
        ),
      ),
      total: loaded.reduce((n, r) => n + (Number(r.total) || 0), 0),
    };
  } catch (error) {
    const message = thrownErrorMessage(error);
    return { status: "error", message };
  }
};

export const deleteIocRequest = async (
  tag: string,
  server?: string,
): Promise<{ status: string; message?: string }> => {
  const servers = (await getServers()).filter((s) => matchServer(s, server));
  if (servers.length === 0) {
    return {
      status: "failure",
      message: server ? "Server not found" : "No servers configured",
    };
  }

  let lastError: { status: string; message?: string } = {
    status: "failure",
    message: "Request failed",
  };

  for (const entry of servers) {
    const ip = entry.ip?.trim().replace(/\/$/, "");
    const port = entry.port?.trim();
    if (!ip || !port) continue;

    try {
      const response = await fetch(
        `${ip}:${port}/api/iocs/${encodeURIComponent(tag)}`,
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
