import { getServers, type ServerEntry } from "@/api/system/config";
import { addBearer } from "@/api/system/auth";
import { httpStatusMessage } from "@/api/http_status";

export type NsDebuggerItem = {
  id: string;
  tag: string;
  content: string;
  time?: string;
  server?: string;
};

export type NsDebuggerResponse = {
  status: string;
  message?: string;
  content?: NsDebuggerItem[];
};

export async function pollNsDebugger(
  server: ServerEntry,
  signal?: AbortSignal
): Promise<NsDebuggerResponse> {
  const ip = server.ip?.trim().replace(/\/$/, "");
  const port = server.port?.trim();
  if (!ip || !port) return { status: "failure", message: "Invalid server config" };
  const endpoint = `${ip}:${port}/api/nsoutput/`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 99999999999999999_000);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      signal: controller.signal,
      headers: {
        ...(await addBearer(server)),
      },
    });
    const text = await response.text();
    if (!response.ok) {
      return { status: "failure", message: `${server.name}: ${httpStatusMessage(response.status)}` };
    }
    const data = JSON.parse(text);
    const base = `${ip}:${port}`;
    const content = (Array.isArray(data?.content) ? data.content : []).map((item: NsDebuggerItem) => ({
      ...item,
      server: base,
    }));
    return { status: data?.status ?? "success", content, message: data?.message };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    return { status: "ERR_conn", message: `${server.name}: Unreachable host` };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export { getServers };
