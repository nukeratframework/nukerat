import { getServers, type ServerEntry } from "@/api/system/config";
import { addBearer } from "@/api/system/auth";
import { responseErrorMessage, thrownErrorMessage } from "@/api/http_status";

export type LogsQuery = {
  search?: string;
  logType?: string;
  category?: string;
  page?: number;
  pageSize?: number;
  ip?: string;
  port?: string;
};

function buildQuery(query: LogsQuery = {}) {
  const qs = new URLSearchParams();
  if (query.search?.trim()) qs.set("search", query.search.trim());
  if (query.logType && query.logType !== "all") qs.set("logType", query.logType);
  if (query.category && query.category !== "all") qs.set("category", query.category);
  if (query.page) qs.set("page", String(query.page));
  if (query.pageSize) qs.set("pageSize", String(query.pageSize));
  const built = qs.toString();
  return built ? `?${built}` : "";
}

export const fetchLogs = async (query: LogsQuery = {}): Promise<any> => {
  let serverName: string | undefined;
  try {
    const { ip, port, ...params } = query;
    const targetIp = ip?.trim().replace(/\/$/, "");
    const targetPort = port?.trim();
    const servers = (await getServers()).filter((s) => {
      if (!targetIp || !targetPort) return true;
      const sip = s.ip?.trim().replace(/\/$/, "");
      const sport = s.port?.trim();
      return sip === targetIp && sport === targetPort;
    });

    if (servers.length === 0) {
      return { status: "failure", message: "No servers configured" };
    }

    const entry = servers[0];
    serverName = entry.name;
    const serverIp = entry.ip?.trim().replace(/\/$/, "");
    const serverPort = entry.port?.trim();
    if (!serverIp || !serverPort) {
      return { status: "failure", message: "Invalid server address" };
    }

    const qs = buildQuery(params);
    const response = await fetch(`${serverIp}:${serverPort}/api/logs/${qs}`, {
      method: "GET",
      headers: addBearer(entry),
    });
    const text = await response.text();
    const json = (() => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    })();

    if (!response.ok) {
      return {
        status: json?.status ?? "failure",
        message: responseErrorMessage(response.status, json?.message),
      };
    }

    return json ?? { status: "failure", message: "Invalid response" };
  } catch (error) {
    const message = thrownErrorMessage(error, serverName);
    return { status: "error", message };
  }
};
