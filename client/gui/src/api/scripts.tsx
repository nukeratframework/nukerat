import { getServers, type ServerEntry } from "@/api/system/config";
import { addBearer } from "@/api/system/auth";
import { responseErrorMessage, thrownErrorMessage, unreachableHost } from "@/api/http_status";

export type ScriptAction = "list" | "add" | "delete" | "edit" | "change_status";

export interface ScriptEntry {
  tag: string;
  name: string;
  description: string;
  content?: string;
  status?: number;
  last_run?: string;
  errors_count?: number;
  success_count?: number;
  created_at?: string;
  server: string;
}

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

type ScriptRequestOptions = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path?: string;
  body?: Record<string, unknown>;
};

export const scriptsFetch = async (
  type: ScriptAction,
  data: Record<string, unknown> = {},
  targetServer?: string,
  signal?: AbortSignal
): Promise<any> => {
  try {
    const servers = (await getServers()).filter((s) => matchServer(s, targetServer));
    if (servers.length === 0) {
      return { status: "failure", type, message: targetServer ? "Server not found" : "No servers configured" };
    }

    const request = async (server: ServerEntry, options: ScriptRequestOptions): Promise<any> => {
      const ip = server.ip?.trim().replace(/\/$/, "");
      const port = server.port?.trim();
      if (!ip || !port) return null;
      const endpoint = `${ip}:${port}/api/scripts/${options.path ?? ""}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 99999999999999999_000);
      const onAbort = () => controller.abort();
      signal?.addEventListener("abort", onAbort);
      try {
        const headers: Record<string, string> = {
          ...(await addBearer(server)),
        };
        let body: string | undefined;
        if (options.body !== undefined) {
          body = JSON.stringify(options.body);
          headers["Content-Type"] = "application/json";
        }
        const response = await fetch(endpoint, {
          method: options.method,
          signal: controller.signal,
          headers,
          body,
        });
        const text = await response.text();
        if (!response.ok) {
          const json = parseErrorBody(text);
          return {
            status: json?.status ?? "failure",
            message: `${server.name}: ${responseErrorMessage(response.status, json?.message)}`,
            type,
          };
        }
        const res = JSON.parse(text);
        return { ...res, server: `${ip}:${port}` };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return { status: "error", message: "Cancelled", type };
        return { status: "ERR_conn", message: `${server.name}: Unreachable host`, type };
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
    };

    if (type === "list") {
      const responses = (await Promise.all(servers.map((server) => request(server, { method: "GET" })))).filter(
        (r) => r !== null
      );
      if (!responses.some((res) => ok(res?.status))) {
        return responses[0] ?? { status: "failure", type, message: unreachableHost(servers[0]?.name) };
      }
      return {
        status: "success",
        content: responses.flatMap((res) =>
          (Array.isArray(res?.content) ? res.content : []).map((s: ScriptEntry) => ({
            ...s,
            server: s.server || res.server || "",
          }))
        ),
      };
    }

    const server = servers[0];
    const tag = data.tag !== undefined ? String(data.tag) : "";
    if (type === "add") {
      const { tag: _tag, ...payload } = data;
      return (await request(server, { method: "POST", body: payload })) ?? { status: "failure", type, message: "Request failed" };
    }
    if (type === "edit") {
      const { tag: _tag, ...payload } = data;
      return (
        (await request(server, { method: "PATCH", path: tag, body: payload })) ??
        { status: "failure", type, message: "Request failed" }
      );
    }
    if (type === "delete") {
      const { tag: _tag, content, ...rest } = data;
      return (
        (await request(server, { method: "DELETE", path: tag, body: { content, ...rest } })) ??
        { status: "failure", type, message: "Request failed" }
      );
    }
    if (type === "change_status") {
      const { tag: _tag, status } = data;
      return (
        (await request(server, { method: "PATCH", path: tag, body: { status } })) ??
        { status: "failure", type, message: "Request failed" }
      );
    }

    return { status: "failure", type, message: "Unknown action" };
  } catch (error) {
    const message = thrownErrorMessage(error);
    return { status: "error", type, message, error: message };
  }
};

export const fetchScripts = (signal?: AbortSignal) => scriptsFetch("list", {}, undefined, signal);

export const addScriptRequest = (data: Record<string, unknown>, server?: string) =>
  scriptsFetch("add", data, server);

export const editScriptRequest = (data: Record<string, unknown>, server?: string) =>
  scriptsFetch("edit", data, server);

export const deleteScriptRequest = (tag: string, content: string, server?: string) =>
  scriptsFetch("delete", { tag, content }, server);

export const changeStatusScriptRequest = (tag: string, status: number, server?: string) =>
  scriptsFetch("change_status", { tag, status }, server);
