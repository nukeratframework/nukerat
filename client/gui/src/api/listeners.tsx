import { getServers, type ServerEntry } from "@/api/system/config";
import { addBearer } from "@/api/system/auth";
import type {
  ListenerFormData,
  ListenerCert,
} from "@/components/canva/topbar/listeners/components/logic";
import { responseErrorMessage, thrownErrorMessage } from "@/api/http_status";

const buildCertPayload = (cert: ListenerCert): Record<string, unknown> => {
  const base: Record<string, unknown> = {
    enabled: true,
    source: cert.source,
  };
  if (cert.source === "manual") {
    const certPem = cert.certPem.trim();
    const keyPem = cert.keyPem.trim();
    if (certPem) base.certPem = certPem;
    if (keyPem) base.keyPem = keyPem;
    return base;
  }
  base.country = cert.country.trim();
  base.state = cert.state.trim();
  base.locality = cert.locality.trim();
  base.organization = cert.organization.trim();
  base.orgUnit = cert.orgUnit.trim();
  base.commonName = cert.commonName.trim();
  base.sanDns = cert.sanDns.trim();
  base.keyType = cert.keyType;
  if (cert.days.trim()) base.days = Number(cert.days.trim());
  return base;
};

const buildPayload = (data: ListenerFormData): Record<string, any> => {
  const base = { name: data.name, listenerType: data.listenerType };

  if (data.listenerType === "file_server") {
    const payload: Record<string, unknown> = {
      ...base,
      ssl: data.ssl,
      host: typeof data.host === "string" ? data.host.trim().replace(/^https?:\/\//i, "") : data.host,
      port: data.port,
      portToOpen: data.portToOpen,
    };
    if (data.ssl) payload.cert = buildCertPayload(data.cert);
    if (data.responseHeaders?.length) payload.responseHeaders = data.responseHeaders;
    return payload;
  }

  const buildHttpLikePayload = (
    channelPayload: ListenerFormData["channelPayload"]
  ): Record<string, any> => {
    const channelBase = {
      ...base,
      channelPayload,
      host: typeof data.host === "string" ? data.host.trim().replace(/^https?:\/\//i, "") : data.host,
      port: data.port,
      portToOpen: data.portToOpen,
    };

    const advanced: Record<string, any> = {
      implantBodyType: data.implantBodyType,
    };
    if (data.endpointPath) advanced.endpointPath = data.endpointPath;
    if (data.responseHeaders?.length) advanced.responseHeaders = data.responseHeaders;
    if (data.implantBodyType !== "off") {
      advanced.implantBody = data.implantBody.trim();
      advanced.listenerResponse = data.listenerResponse.trim();
    }
    const payload: Record<string, any> = { ...channelBase, ...advanced };
    if (channelPayload === "https") payload.cert = buildCertPayload(data.cert);
    return payload;
  };

  if (data.listenerType === "channel") {
    return buildHttpLikePayload(data.channelPayload);
  }

  return base;
};

function parseSelectedServer(selectedServer?: string): {
  targetIp?: string;
  targetPort?: string;
} {
  const selected = selectedServer?.trim();
  if (!selected) return {};

  const withoutListenersPath = selected
    .replace(/\/api\/listeners\/?$/i, "")
    .replace(/\/+$/, "");

  const parts = withoutListenersPath.match(/^(https?:\/\/[^/:]+)(?::(\d+))?$/i);
  if (!parts) {
    return { targetIp: withoutListenersPath };
  }

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

export const DataFetch = async (
  type: string,
  extraData: object = {},
  selectedServer?: string
): Promise<any> => {
  try {
    const servers = (await getServers()).filter((s) => matchServer(s, selectedServer));
    if (servers.length === 0) {
      return {
        status: "failure",
        type,
        message: "No servers configured",
      };
    }

    const post = async (server: ServerEntry): Promise<any> => {
      const ip = server.ip?.trim().replace(/\/$/, "");
      const port = server.port?.trim();
      if (!ip || !port) return null;
      const endpoint = `${ip}:${port}/api/listeners/`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 99999999999999999_000);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...(await addBearer(server)),
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
            message: `${server.name}: ${responseErrorMessage(response.status, json?.message)}`,
            type,
            endpoint,
          };
        }
        const data = JSON.parse(text);
        return { ...data, endpoint };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return { status: "error", message: `${server.name}:Connection timed out`, type };
        }
        return { status: "ERR_conn", message: `${server.name}: Unreachable host`, type };
      } finally {
        clearTimeout(timer);
      }
    };

    let lastError: any = null;
    for (const server of servers) {
      const response = await post(server);
      if (response?.status === "success") return response;
      lastError = response;
    }

    return (
      lastError ?? {
        status: "failure",
        type,
        message: "Request failed",
      }
    );
  } catch (error) {
    const errorMessage = thrownErrorMessage(error);
    return {
      status: "error",
      type,
      message: errorMessage,
      error: errorMessage,
    };
  }
};

export const fetchListeners = async (): Promise<any[]> => {
  const servers = await getServers();
  if (servers.length === 0) return [];

  const responses = (
    await Promise.all(
      servers.map(async (server) => {
        const ip = server.ip?.trim().replace(/\/$/, "");
        const port = server.port?.trim();
        if (!ip || !port) return null;

        try {
          const response = await fetch(`${ip}:${port}/api/listeners/`, {
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
    (Array.isArray(res?.active_channels) ? res.active_channels : []).map((listener: any) => {
      const rest = { ...listener };
      delete rest.session_id;
      delete rest.id;
      return {
      ...rest,
      listenerType: listener?.listenerType ?? "channel",
      channelPayload: listener?.channelPayload ?? listener?.protocol,
      tag: listener?.tag ?? "",
      port:
        listener?.port !== undefined && listener?.port !== null
          ? String(listener.port)
          : "",
      sourcePort:
        listener?.sourcePort !== undefined && listener?.sourcePort !== null
          ? String(listener.sourcePort)
          : listener?.sourcePort,
      implants: Number(listener?.implants ?? listener?.beacons ?? 0),
      server: res.server,
    };
    })
  );
};

export const saveListenerRequest = async (
  type: "create",
  data: ListenerFormData,
  selectedServer?: string
): Promise<{ status: string; listener?: string; message?: string }> => {
  return DataFetch(type, buildPayload(data), selectedServer);
};

export const removeListenerRequest = async (
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

  for (const server of servers) {
    const ip = server.ip?.trim().replace(/\/$/, "");
    const port = server.port?.trim();
    if (!ip || !port) continue;

    try {
      const response = await fetch(
        `${ip}:${port}/api/listeners/${encodeURIComponent(tag)}`,
        {
          method: "DELETE",
          headers: addBearer(server),
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
        message: `${server.name}: ${responseErrorMessage(response.status, data?.message)}`,
      };
    } catch (error) {
      lastError = {
        status: "ERR_conn",
        message: `${server.name}: Unreachable host`,
      };
    }
  }

  return lastError;
};

export const restartListenerRequest = async (
  tag: string,
  selectedServer?: string
): Promise<{ status: string; message?: string }> =>
  DataFetch("restart", { tag }, selectedServer);
