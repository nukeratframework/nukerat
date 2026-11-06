import { getServers, type ServerEntry } from "@/api/system/config";
import { addBearer } from "@/api/system/auth";
import type { Session } from "@/api/sessions";
import { responseErrorMessage } from "@/api/http_status";

export type ScreenshotMsg = { status: string; content?: string; message?: string; hash?: string };

function matchServer(entry: ServerEntry, target?: string) {
  const ip = entry.ip?.trim().replace(/\/$/, "");
  const port = entry.port?.trim();
  if (!ip || !port) return false;
  const base = `${ip}:${port}`;
  if (!target?.trim()) return false;
  return base === target.trim().replace(/\/+$/, "");
}

function buildQuery(hash?: string | null, longPoll = true) {
  const qs = new URLSearchParams();
  if (hash) qs.set("hash", hash);
  if (longPoll) qs.set("long_polling", "true");
  const query = qs.toString();
  return query ? `?${query}` : "";
}

export async function fetchScreenshot(
  selectedHost: { host: Session; server: string },
  signal?: AbortSignal,
  hash?: string | null,
  longPoll = true,
): Promise<ScreenshotMsg> {
  const { server, host: { tag: hostTag } } = selectedHost;
  try {
    const servers = (await getServers()).filter((s) => matchServer(s, server));
    if (!servers.length) return { status: "failure", message: "Server not found" };
    const entry = servers[0];
    const ip = entry.ip?.trim().replace(/\/$/, "");
    const port = entry.port?.trim();
    if (!ip || !port) return { status: "failure", message: `${entry.name}: Invalid server` };

    const query = buildQuery(hash, longPoll);
    const res = await fetch(
      `${ip}:${port}/api/screenshot/${encodeURIComponent(hostTag)}${query}`,
      {
        method: "GET",
        signal,
        headers: addBearer(entry),
      },
    );
    const text = await res.text();
    if (!res.ok) {
      let json: ScreenshotMsg | null = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      return {
        status: "failure",
        message: `${entry.name}: ${responseErrorMessage(res.status, json?.message)}`,
      };
    }
    const data = JSON.parse(text);
    return data?.status === "success"
      ? data
      : { ...data, message: `${entry.name}: ${data?.message ?? "failure"}` };
  } catch (e) {
    throw e;
  }
}
