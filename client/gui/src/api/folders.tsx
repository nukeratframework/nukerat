import { getServers, type ServerEntry } from "@/api/system/config";
import { addBearer } from "@/api/system/auth";
import { responseErrorMessage, thrownErrorMessage } from "@/api/http_status";

const FOLDERS_REQUEST = "folders";

function matchServer(server: ServerEntry, selectedServer?: string): boolean {
  const ip = server.ip?.trim().replace(/\/$/, "");
  const port = server.port?.trim();
  if (!ip || !port) return false;

  const normalized = selectedServer
    ?.trim()
    .replace(/\/+$/, "")
    .replace(/\/api\/(?:explorer|folders)\/?$/i, "");
  if (!normalized) return false;

  return `${ip}:${port}` === normalized;
}

function extractFileName(rawPath: string): string {
  const normalized = rawPath.trim();
  if (!normalized) return "";
  const parts = normalized.split(/[\\/]+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

function decodeBase64ToText(value: string): string {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function buildPayload(
  host?: string,
  path?: string,
  getContent?: boolean,
  autoRefresh?: boolean
): Record<string, unknown> {
  const body: Record<string, unknown> = { host: host ?? "" };
  if (path !== undefined) body.path = path;
  if (getContent) {
    body.getContent = true;
    body.fileName = extractFileName(path ?? "");
  }
  if (!getContent && autoRefresh) body.autoRefresh = true;
  return body;
}

function normalizeFoldersResponse(data: any): any {
  if (!data || typeof data !== "object") return data;
  const message = data.message ?? data.error;
  if (message && !data.message) {
    return { ...data, message };
  }
  return data;
}

function applyFileContent(
  data: any,
  getContent: boolean,
  path?: string
): any {
  if (!getContent || typeof data?.file_content_b64 !== "string") {
    return data;
  }

  let decoded = "";
  try {
    decoded = decodeBase64ToText(data.file_content_b64);
  } catch {
    decoded = "";
  }

  return {
    ...data,
    file_content: decoded,
    fileName:
      typeof data?.fileName === "string" && data.fileName.trim()
        ? data.fileName
        : extractFileName(path ?? ""),
  };
}

export const DataFetch = async (
  server?: string,
  host?: string,
  path?: string,
  getContent?: boolean,
  autoRefresh?: boolean
): Promise<any> => {
  const payload = buildPayload(host, path, getContent, autoRefresh);

  try {
    const servers = (await getServers()).filter((s) => matchServer(s, server));
    if (servers.length === 0) {
      return {
        status: "failure",
        request: FOLDERS_REQUEST,
        message: "No servers configured",
      };
    }

    const post = async (entry: ServerEntry): Promise<any> => {
      const ip = entry.ip?.trim().replace(/\/$/, "");
      const port = entry.port?.trim();
      if (!ip || !port) return null;
      const endpoint = `${ip}:${port}/api/explorer/`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 99999999999999999_000);
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
            request: FOLDERS_REQUEST,
            endpoint,
          };
        }
        const data = applyFileContent(
          normalizeFoldersResponse(JSON.parse(text)),
          Boolean(getContent),
          path
        );
        return { ...data, endpoint };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return {
            status: "error",
            message: `${entry.name}:Connection timed out`,
            request: FOLDERS_REQUEST,
          };
        }
        return {
          status: "ERR_conn",
          message: `${entry.name}: Unreachable host`,
          request: FOLDERS_REQUEST,
        };
      } finally {
        clearTimeout(timer);
      }
    };

    let lastError: any = null;
    for (const entry of servers) {
      const response = await post(entry);
      if (response === null) continue;
      if (response?.status === "success") return response;
      if (!response?.request) return response;
      lastError = response;
    }

    return (
      lastError ?? {
        status: "failure",
        request: FOLDERS_REQUEST,
        message: "Request failed",
      }
    );
  } catch (error) {
    const errorMessage = thrownErrorMessage(error);
    return {
      status: "error",
      request: FOLDERS_REQUEST,
      message: errorMessage,
      error: errorMessage,
    };
  }
};
