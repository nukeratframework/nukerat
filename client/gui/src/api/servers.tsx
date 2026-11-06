import type { ServerEntry } from "@/api/system/config";
import { addBearer } from "@/api/system/auth";
import { responseErrorMessage, thrownErrorMessage } from "@/api/http_status";

export type ConnectionStatus = "idle" | "checking" | "online" | "unauthorized" | "offline";

export async function testConnection(server: ServerEntry): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 99999999999999999_000);
  try {
    const ip = server.ip?.trim().replace(/\/$/, "");
    const port = server.port?.trim();
    if (!ip || !port) return { status: "failure", message: `${server.name}: Invalid server` };
    const endpoint = `${ip}:${port}/auth/check`;
    let bearer: Record<string, string> = {};
    try {
      bearer = addBearer(server);
    } catch {
      bearer = {};
    }
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...bearer,
      },
      body: JSON.stringify({}),
    });
    const text = await response.text();
    if (response.status === 401) {
      return { status: "success", online: true, auth: false };
    }
    if (!response.ok) {
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      return {
        status: "failure",
        online: false,
        message: `${server.name}: ${responseErrorMessage(response.status, json?.message)}`,
      };
    }
    const data = JSON.parse(text);
    if (data?.status === "success") {
      return { status: "success", online: true, auth: true };
    }
    return {
      status: "success",
      online: true,
      auth: false,
      message: `${server.name}: ${data?.message ?? "failure"}`,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { status: "error", online: false, message: `${server.name}: Connection timed out` };
    }
    if (error instanceof Error) {
      return { status: "failure", online: false, name: server.name, message: thrownErrorMessage(error, server.name) };
    }
    return { status: "ERR_conn", online: false, name: server.name, message: `${server.name}: Unreachable host` };
  } finally {
    clearTimeout(timer);
  }
}
