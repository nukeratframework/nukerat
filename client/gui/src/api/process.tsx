import { getServers, type ServerEntry } from "@/api/system/config";
import { addBearer } from "@/api/system/auth";
import { responseErrorMessage, thrownErrorMessage } from "@/api/http_status";

const PROCESS_REQUEST = "process";

export interface ProcessNode {
  pid: number;
  name: string;
  path: string;
  cpu: number;
  memory: number;
  user: string;
  integrity: string;
  session: number;
  arch: string;
  network: string;
  privilege: string;
  children?: ProcessNode[];
}

function matchServer(server: ServerEntry, selectedServer?: string): boolean {
  const ip = server.ip?.trim().replace(/\/$/, "");
  const port = server.port?.trim();
  if (!ip || !port) return false;

  const normalized = selectedServer
    ?.trim()
    .replace(/\/+$/, "")
    .replace(/\/api\/process\/?$/i, "");
  if (!normalized) return false;

  return `${ip}:${port}` === normalized;
}

function buildPayload(tag?: string): Record<string, unknown> {
  const host = (tag || "").trim();
  return host ? { host, session: host } : {};
}

function normalizeProcessResponse(data: any): any {
  if (!data || typeof data !== "object") return data;
  const message = data.message ?? data.error;
  if (message && !data.message) {
    return { ...data, message };
  }
  return data;
}

export function parseProcessTree(data: any): ProcessNode[] | null {
  const value = data?.tree ?? data?.hosts?.[0]?.tree ?? data?.processes;

  if (Array.isArray(value)) {
    return value as ProcessNode[];
  }

  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as ProcessNode[]) : null;
  } catch {
    return null;
  }
}

export const DataFetch = async (
  server?: string,
  tag?: string,
  signal?: AbortSignal
): Promise<any> => {
  const payload = buildPayload(tag);

  try {
    const servers = (await getServers()).filter((s) => matchServer(s, server));
    if (servers.length === 0) {
      return {
        status: "failure",
        request: PROCESS_REQUEST,
        message: "No servers configured",
      };
    }

    const post = async (entry: ServerEntry): Promise<any> => {
      const ip = entry.ip?.trim().replace(/\/$/, "");
      const port = entry.port?.trim();
      if (!ip || !port) return null;
      const endpoint = `${ip}:${port}/api/process/`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 99999999999999999_000);
      const onExternalAbort = () => controller.abort();
      signal?.addEventListener("abort", onExternalAbort, { once: true });

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...(await addBearer(entry)),
          },
          body: JSON.stringify(payload),
        });
        const text = await response.text();
        if (!response.ok) {
          let json: any = null;
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }
          return {
            status: json?.status ?? "failure",
            message: `${entry.name}: ${responseErrorMessage(response.status, json?.message)}`,
            request: PROCESS_REQUEST,
            endpoint,
          };
        }
        const data = normalizeProcessResponse(JSON.parse(text));
        return { ...data, endpoint };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          if (signal?.aborted) {
            return { status: "aborted" };
          }
          return {
            status: "error",
            message: `${entry.name}:Connection timed out`,
            request: PROCESS_REQUEST,
          };
        }
        return {
          status: "ERR_conn",
          message: `${entry.name}: Unreachable host`,
          request: PROCESS_REQUEST,
        };
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onExternalAbort);
      }
    };

    let lastError: any = null;
    for (const entry of servers) {
      const response = await post(entry);
      if (response === null) continue;
      if (response?.status === "success") return response;
      if (response?.status === "aborted") return response;
      if (!response?.request) return response;
      lastError = response;
    }

    return (
      lastError ?? {
        status: "failure",
        request: PROCESS_REQUEST,
        message: "Request failed",
      }
    );
  } catch (error) {
    const errorMessage = thrownErrorMessage(error);
    return {
      status: "error",
      request: PROCESS_REQUEST,
      message: errorMessage,
      error: errorMessage,
    };
  }
};
