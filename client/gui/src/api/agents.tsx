import { getServers, type ServerEntry } from "@/api/system/config";
import { addBearer } from "@/api/system/auth";
import type { AgentFormData } from "@/components/canva/topbar/agents/components/logic";
import { responseErrorMessage, thrownErrorMessage, unreachableHost } from "@/api/http_status";

const buildConfig = (data: AgentFormData) => {
  const base = { name: data.name.trim(), type: data.type };
  if (data.type === "deepseek") return { ...base, apiKey: data.apiKey };
  const headers = [...data.headers];
  const cookie = data.cookies
    .filter((c) => c.key.trim())
    .map((c) => `${c.key}=${c.value}`)
    .join("; ");
  if (cookie) headers.push({ key: "Cookie", value: cookie });
  return {
    ...base,
    endpoint: data.endpoint,
    headers,
    bodyTemplate: data.bodyTemplate,
    responseField: data.responseField,
  };
};

function parseSelectedServer(selectedServer?: string) {
  const selected = selectedServer?.trim();
  if (!selected) return {};
  const base = selected.replace(/\/api\/agents\/?$/i, "").replace(/\/+$/, "");
  const parts = base.match(/^(https?:\/\/[^/:]+)(?::(\d+))?$/i);
  if (!parts) return { targetIp: base };
  const [, targetIp, targetPort] = parts;
  return { targetIp, targetPort };
}

function matchServer(server: ServerEntry, selectedServer?: string) {
  const ip = server.ip?.trim().replace(/\/$/, "");
  const port = server.port?.trim();
  if (!ip || !port) return false;
  const { targetIp, targetPort } = parseSelectedServer(selectedServer);
  if (targetIp && ip !== targetIp && `${ip}:${port}` !== targetIp) return false;
  if (targetPort && port !== targetPort) return false;
  return true;
}

function parseErrorBody(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const DataFetch = async (
  type: string,
  extraData: object = {},
  selectedServer?: string,
  signal?: AbortSignal
): Promise<any> => {
  try {
    const servers = (await getServers()).filter((s) => matchServer(s, selectedServer));
    if (servers.length === 0) {
      return { status: "failure", type, message: "No servers configured" };
    }

    const post = async (server: ServerEntry): Promise<any> => {
      const ip = server.ip?.trim().replace(/\/$/, "");
      const port = server.port?.trim();
      if (!ip || !port) return null;
      const endpoint = `${ip}:${port}/api/agents/`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 999_000);
      const onAbort = () => controller.abort();
      signal?.addEventListener("abort", onAbort);
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
          const json = parseErrorBody(text);
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
          return { status: "error", message: "Cancelled", type };
        }
        return { status: "ERR_conn", message: `${server.name}: Unreachable host`, type };
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
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

export const fetchAgents = async (signal?: AbortSignal) => {
  try {
    const servers = await getServers();
    if (servers.length === 0) {
      return { status: "failure", message: "No servers configured", agents: [] };
    }

    const responses = (
      await Promise.all(
        servers.map(async (server) => {
          const ip = server.ip?.trim().replace(/\/$/, "");
          const port = server.port?.trim();
          if (!ip || !port) return null;

          try {
            const response = await fetch(`${ip}:${port}/api/agents/`, {
              method: "GET",
              signal,
              headers: addBearer(server),
            });
            const text = await response.text();
            if (!response.ok) {
              const json = parseErrorBody(text);
              return {
                status: json?.status ?? "failure",
                message: `${server.name}: ${responseErrorMessage(response.status, json?.message)}`,
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
        })
      )
    ).filter((r) => r !== null);

    const ok = responses.filter((res) => res?.status === "success");
    if (ok.length === 0) {
      return responses[0] ?? { status: "failure", message: unreachableHost(servers[0]?.name), agents: [] };
    }

    return {
      status: "success",
      agents: ok.flatMap((res) =>
        (Array.isArray(res?.agents) ? res.agents : []).map((a: any) => ({
          ...a,
          server: res.server,
        }))
      ),
    };
  } catch (error) {
    const errorMessage = thrownErrorMessage(error);
    return { status: "error", message: errorMessage, agents: [] };
  }
};

const mutateAgentRequest = async (
  tag: string,
  method: "PATCH" | "DELETE",
  selectedServer?: string,
  body?: Record<string, unknown>
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
        `${ip}:${port}/api/agents/${encodeURIComponent(tag)}`,
        {
          method,
          headers: {
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...addBearer(server),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }
      );
      const text = await response.text();
      const data = parseErrorBody(text);
      if (response.ok && data?.status === "success") {
        return data;
      }
      lastError = {
        status: data?.status ?? "failure",
        message: `${server.name}: ${responseErrorMessage(response.status, data?.message)}`,
      };
    } catch {
      lastError = {
        status: "ERR_conn",
        message: `${server.name}: Unreachable host`,
      };
    }
  }

  return lastError;
};

export const saveAgentRequest = (
  type: "create" | "update",
  data: AgentFormData,
  tag?: string,
  selectedServer?: string
) => {
  if (type === "update") {
    if (!tag?.trim()) return Promise.resolve({ status: "failure", message: "Tag required" });
    return mutateAgentRequest(tag, "PATCH", selectedServer, { config: buildConfig(data) });
  }
  return DataFetch("create", { config: buildConfig(data) }, selectedServer);
};

export const removeAgentRequest = (tag: string, selectedServer?: string) =>
  mutateAgentRequest(tag, "DELETE", selectedServer);

export const agentUsageRequest = (
  selectedServer: string,
  data: {
    model: string;
    id: string;
    message: string;
    context: { role: string; content: string }[];
    system_prompt: string;
    use_full_context: boolean;
  },
  signal?: AbortSignal
) => DataFetch("usage", data, selectedServer, signal);
