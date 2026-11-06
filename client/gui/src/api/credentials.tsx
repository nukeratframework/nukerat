import { getServers, type ServerEntry } from "@/api/system/config";
import { addBearer } from "@/api/system/auth";
import { httpStatusMessage, responseErrorMessage, thrownErrorMessage, unreachableHost } from "@/api/http_status";

export interface CredentialEntry {
  tag: string;
  name: string;
  server: string;
  host: string;
  desc: string;
  content?: string;
}

export interface CredentialPayload {
  name: string;
  server: string;
  host: string;
  desc?: string;
  content: string;
}

export function isCredentialSuccess(status?: string) {
  return status === "success" || status === "successfull";
}

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

function mapCredentialEntry(item: any, server: string): CredentialEntry {
  const rest = { ...item };
  delete rest.id;
  delete rest.session_id;
  return {
    ...rest,
    tag: item?.tag ?? "",
    name: item?.name ?? "",
    server: item?.server || server || "",
    host: item?.host ?? "",
    desc: item?.desc ?? "",
    content: item?.content ?? "",
  };
}

export const fetchCredentials = async (signal?: AbortSignal): Promise<{
  status: string;
  credentials?: CredentialEntry[];
  message?: string;
}> => {
  try {
    const servers = await getServers();
    if (servers.length === 0) {
      return { status: "failure", message: "No servers configured" };
    }

    const responses = (
      await Promise.all(
        servers.map(async (server) => {
          const ip = server.ip?.trim().replace(/\/$/, "");
          const port = server.port?.trim();
          if (!ip || !port) return null;

          try {
            const response = await fetch(`${ip}:${port}/api/credentials/`, {
              method: "GET",
              signal,
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
          } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
              return { status: "error", message: "Cancelled" };
            }
            return { status: "ERR_conn", message: `${server.name}: Unreachable host` };
          }
        }),
      )
    ).filter((r) => r !== null);

    const loaded = responses.filter((r) => isCredentialSuccess(r.status));
    if (loaded.length === 0) {
      return responses[0] ?? { status: "failure", message: unreachableHost(servers[0]?.name) };
    }

    return {
      status: "success",
      credentials: loaded.flatMap((res) =>
        (Array.isArray(res?.credentials) ? res.credentials : []).map((c: any) =>
          mapCredentialEntry(c, res.server),
        ),
      ),
    };
  } catch (error) {
    const message = thrownErrorMessage(error);
    return { status: "error", message };
  }
};

export const createCredentialRequest = async (
  data: CredentialPayload,
): Promise<{ status: string; tag?: string; message?: string }> => {
  const servers = (await getServers()).filter((s) => matchServer(s, data.server));
  if (servers.length === 0) {
    return { status: "failure", message: "Server not found" };
  }

  const entry = servers[0];
  const ip = entry.ip?.trim().replace(/\/$/, "");
  const port = entry.port?.trim();
  if (!ip || !port) {
    return { status: "failure", message: "Invalid server address" };
  }

  try {
    const response = await fetch(`${ip}:${port}/api/credentials/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await addBearer(entry)),
      },
      body: JSON.stringify(data),
    });
    const text = await response.text();
    const json = parseErrorBody(text);
    if (!response.ok) {
      return {
        status: json?.status ?? "failure",
        message: responseErrorMessage(response.status, json?.message),
      };
    }
    return json ?? { status: "failure", message: "Invalid response" };
  } catch {
    return { status: "ERR_conn", message: unreachableHost(entry.name) };
  }
};

export const editCredentialRequest = async (
  tag: string,
  data: CredentialPayload,
): Promise<{ status: string; message?: string }> => {
  const servers = (await getServers()).filter((s) => matchServer(s, data.server));
  if (servers.length === 0) {
    return { status: "failure", message: "Server not found" };
  }

  const entry = servers[0];
  const ip = entry.ip?.trim().replace(/\/$/, "");
  const port = entry.port?.trim();
  if (!ip || !port) {
    return { status: "failure", message: "Invalid server address" };
  }

  try {
    const response = await fetch(
      `${ip}:${port}/api/credentials/${encodeURIComponent(tag)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await addBearer(entry)),
        },
        body: JSON.stringify(data),
      },
    );
    const text = await response.text();
    const json = parseErrorBody(text);
    if (!response.ok) {
      return {
        status: json?.status ?? "failure",
        message: responseErrorMessage(response.status, json?.message),
      };
    }
    return json ?? { status: "failure", message: "Invalid response" };
  } catch {
    return { status: "ERR_conn", message: unreachableHost(entry.name) };
  }
};

export const deleteCredentialRequest = async (
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
        `${ip}:${port}/api/credentials/${encodeURIComponent(tag)}`,
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
