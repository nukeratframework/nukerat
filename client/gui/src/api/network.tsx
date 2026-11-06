import { getServers, type ServerEntry } from "@/api/system/config";
import { addBearer } from "@/api/system/auth";
import { responseErrorMessage, thrownErrorMessage } from "@/api/http_status";

export type NetworkFormData = {
  networkType: "port_forwarding" | "socks";
  host: string;
  port: string;
  targetPort: string;
  protocol: "tcp" | "udp";
  authUser: string;
  authPass: string;
  hostTag: string;
  forwardHost: string;
  forwardPort: string;
};

export interface Connection {
  tag?: string;
  id?: string;
  session_id?: string;
  networkType?: "port_forwarding" | "socks" | "proxychains";
  host?: string;
  targetPort?: string | number;
  protocol?: string;
  authUser?: string;
  authPass?: string;
  hostTag?: string;
  forwardHost?: string;
  forwardPort?: string | number;
  server?: string;
}

function parseSelectedServer(selectedServer?: string): { targetIp?: string; targetPort?: string } {
  const selected = selectedServer?.trim();
  if (!selected) return {};

  const base = selected.replace(/\/api\/network\/?$/i, "").replace(/\/+$/, "");
  const parts = base.match(/^(https?:\/\/[^/:]+)(?::(\d+))?$/i);
  if (!parts) return { targetIp: base };

  const [, targetIp, targetPort] = parts;
  return { targetIp, targetPort };
}

function matchServer(server: ServerEntry, selectedServer?: string): boolean {
  const ip = server.ip?.trim().replace(/\/$/, "");
  const port = server.port?.trim();
  if (!ip || !port) return false;

  const { targetIp, targetPort } = parseSelectedServer(selectedServer);
  if (targetIp && ip !== targetIp && `${ip}:${port}` !== targetIp) return false;
  if (targetPort && port !== targetPort) return false;
  return true;
}

const buildPayload = (data: NetworkFormData): Record<string, unknown> => ({
  networkType: data.networkType,
  portToOpen: data.targetPort,
  protocol: data.protocol,
  authUser: data.authUser.trim(),
  authPass: data.authPass.trim(),
  hostTag: data.hostTag.trim(),
  forwardHost: data.forwardHost.trim(),
  forwardPort: data.forwardPort.trim(),
});

export const buildCreateSelectedServer = (formData: NetworkFormData): string =>
  `${formData.host.trim().replace(/\/$/, "")}:${formData.port.trim()}/api/network/`;

const mapConnection = (c: any, server: string): Connection => ({
  tag: c.tag ?? c.session_id ?? c.id ?? "",
  id: c.id ?? c.session_id ?? "",
  session_id: c.session_id ?? c.id ?? "",
  networkType: c.networkType ?? "socks",
  host: c.host ?? "",
  targetPort: String(c.targetPort ?? c.port ?? ""),
  protocol: c.protocol ?? "-",
  authUser: c.authUser ?? "",
  authPass: c.authPass ?? "",
  hostTag: c.hostTag ?? "",
  forwardHost: c.forwardHost ?? "",
  forwardPort: c.forwardPort != null && c.forwardPort !== "" ? String(c.forwardPort) : "",
  server,
});

export const DataFetch = async (
  type: string,
  extraData: object = {},
  selectedServer?: string
): Promise<any> => {
  try {
    const servers = (await getServers()).filter((s) => matchServer(s, selectedServer));
    if (servers.length === 0) {
      return { status: "failure", type, message: "No servers configured" };
    }

    const post = async (entry: ServerEntry): Promise<any> => {
      const ip = entry.ip?.trim().replace(/\/$/, "");
      const port = entry.port?.trim();
      if (!ip || !port) return null;
      const endpoint = `${ip}:${port}/api/network/`;
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
          body: JSON.stringify({ type, ...extraData }),
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
            type,
            endpoint,
          };
        }
        const data = JSON.parse(text);
        return { ...data, endpoint };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return { status: "error", message: `${entry.name}:Connection timed out`, type };
        }
        return { status: "ERR_conn", message: `${entry.name}: Unreachable host`, type };
      } finally {
        clearTimeout(timer);
      }
    };

    let lastError: any = null;
    for (const entry of servers) {
      const response = await post(entry);
      if (response === null) continue;
      if (response?.status === "success") return response;
      lastError = response;
    }

    return lastError ?? { status: "failure", type, message: "Request failed" };
  } catch (error) {
    const errorMessage = thrownErrorMessage(error);
    return { status: "error", type, message: errorMessage, error: errorMessage };
  }
};

export const fetchConnections = async (): Promise<Connection[]> => {
  const servers = await getServers();
  if (servers.length === 0) return [];

  const responses = (
    await Promise.all(
      servers.map(async (server) => {
        const ip = server.ip?.trim().replace(/\/$/, "");
        const port = server.port?.trim();
        if (!ip || !port) return null;

        try {
          const response = await fetch(`${ip}:${port}/api/network/`, {
            method: "GET",
            headers: addBearer(server),
          });
          const text = await response.text();
          if (!response.ok) return null;
          const data = JSON.parse(text);
          return { ...data, server: `${ip}:${port}` };
        } catch {
          return null;
        }
      })
    )
  ).filter((r) => r !== null && r.status === "success");

  return responses.flatMap((res) =>
    (Array.isArray(res?.connections) ? res.connections : []).map((c: any) =>
      mapConnection(c, res.server)
    )
  );
};

export const saveConnectionRequest = async (
  type: "create",
  data: NetworkFormData,
  selectedServer?: string
): Promise<{ status: string; message?: string; session_id?: string }> =>
  DataFetch(type, buildPayload(data), selectedServer);

export const removeConnectionRequest = async (
  tag: string,
  selectedServer?: string
): Promise<{ status: string; message?: string }> => {
  const servers = (await getServers()).filter((s) => matchServer(s, selectedServer));
  if (servers.length === 0) {
    return { status: "failure", message: "No servers configured" };
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
        `${ip}:${port}/api/network/${encodeURIComponent(tag)}`,
        {
          method: "DELETE",
          headers: addBearer(entry),
        }
      );
      const text = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
      if (response.ok && data?.status === "success") {
        return data;
      }
      lastError = {
        status: data?.status ?? "failure",
        message: `${entry.name}: ${responseErrorMessage(response.status, data?.message)}`,
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

export const restartConnectionRequest = async (
  id: string,
  selectedServer?: string
): Promise<{ status: string; message?: string }> =>
  DataFetch("restart", { id }, selectedServer);
