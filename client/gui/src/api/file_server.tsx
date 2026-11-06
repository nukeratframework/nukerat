import { getServers, type ServerEntry } from "@/api/system/config";
import { addBearer } from "@/api/system/auth";
import { responseErrorMessage } from "@/api/http_status";

function matchServer(server: ServerEntry, ip?: string, port?: string) {
  const sip = server.ip?.trim().replace(/\/$/, "");
  const sport = server.port?.trim();
  if (!sip || !sport) return false;
  const targetIp = ip?.trim().replace(/\/$/, "");
  const targetPort = port?.trim();
  if (!targetIp || !targetPort) return true;
  return sip === targetIp && sport === targetPort;
}

function parseErrorBody(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function getTargetServer(ip: string, port: string): Promise<ServerEntry | null> {
  const servers = (await getServers()).filter((s) => matchServer(s, ip, port));
  return servers[0] ?? null;
}

async function request(
  ip: string,
  port: string,
  path: string,
  init: RequestInit,
): Promise<any> {
  const server = await getTargetServer(ip, port);
  if (!server) {
    return { status: "failure", message: "Server not found" };
  }

  const host = server.ip?.trim().replace(/\/$/, "");
  const p = server.port?.trim();
  if (!host || !p) {
    return { status: "failure", message: "Invalid server address" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 99999999999999999_000);

  try {
    const response = await fetch(`${host}:${p}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init.headers ?? {}),
        ...(await addBearer(server)),
      },
    });
    const text = await response.text();
    const json = parseErrorBody(text);
    if (!response.ok) {
      return {
        status: json?.status ?? "failure",
        message: `${server.name}: ${responseErrorMessage(response.status, json?.message)}`,
      };
    }
    return json ?? { status: "failure", message: "Invalid response" };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { status: "error", message: `${server.name}:Connection timed out` };
    }
    return { status: "ERR_conn", message: `${server.name}: Unreachable host` };
  } finally {
    clearTimeout(timer);
  }
}

export const listFilesRequest = (ip: string, port: string, tag: string) =>
  request(ip, port, `/api/file_server/${encodeURIComponent(tag)}`, { method: "GET" });

export const deleteFileRequest = (
  ip: string,
  port: string,
  tag: string,
  fileName: string,
) =>
  request(
    ip,
    port,
    `/api/file_server/${encodeURIComponent(tag)}/files/${encodeURIComponent(fileName)}`,
    { method: "DELETE" },
  );

export const updateFileRequest = (
  ip: string,
  port: string,
  tag: string,
  fileName: string,
  newFileName: string,
) =>
  request(
    ip,
    port,
    `/api/file_server/${encodeURIComponent(tag)}/files/${encodeURIComponent(fileName)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_file_name: newFileName }),
    },
  );

export const uploadFileRequest = (
  ip: string,
  port: string,
  tag: string,
  fileName: string,
  bytes: string,
) =>
  request(ip, port, `/api/file_server/${encodeURIComponent(tag)}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_name: fileName, bytes }),
  });

export const downloadFileRequest = (
  ip: string,
  port: string,
  tag: string,
  fileName: string,
) =>
  request(
    ip,
    port,
    `/api/file_server/${encodeURIComponent(tag)}/files/${encodeURIComponent(fileName)}/download`,
    { method: "GET" },
  );
