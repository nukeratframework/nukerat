import type { ServerEntry } from "@/api/system/config";
import { addBearer } from "@/api/system/auth";
import { httpStatusMessage } from "@/api/http_status";
import linuxHostSvg from "@/assets/icons/graphs/linux_host.svg";
import macHostSvg from "@/assets/icons/graphs/mac_host.svg";
import unknownHostSvg from "@/assets/icons/graphs/unknown_host.svg";
import windowsHostSvg from "@/assets/icons/graphs/windows_host.svg";

export type NotifyHost = {
  tag: string;
  ip: string;
  os: string;
  hostname: string;
  first_seen: string | null;
  last_seen: string | null;
  delay: number;
};

export type NotifyCustom = {
  tag: string;
  title: string | null;
  type: string;
  description: string | null;
  created_at: string | null;
};

const osIcons = {
  windows: windowsHostSvg,
  linux: linuxHostSvg,
  mac: macHostSvg,
  unknown: unknownHostSvg,
};

export const hostOsIcon = (os: string) => {
  const v = os.toLowerCase();
  if (/\b(win|windows|microsoft)\b/.test(v)) return osIcons.windows;
  if (/\b(mac|macos|osx|os\s*x|darwin)\b/.test(v)) return osIcons.mac;
  if (/\b(linux|gnu|ubuntu|debian|fedora|arch|centos|kali)\b/.test(v)) return osIcons.linux;
  return osIcons.unknown;
};

export const fetchServerNotifications = async (
  server: ServerEntry,
  signal?: AbortSignal,
) => {
  const ip = server.ip?.trim().replace(/\/$/, "");
  const port = server.port?.trim();
  if (!ip || !port) return { message: "failure", hosts: [] as NotifySession[] };
  const response = await fetch(`${ip}:${port}/api/notifications/`, {
    method: "GET",
    signal,
    headers: addBearer(server),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(httpStatusMessage(response.status));
  const data = JSON.parse(text);
  const ok = data?.message === "successful";
  const hosts = ok && Array.isArray(data?.hosts) ? (data.hosts as NotifySession[]) : [];
  return { message: hosts.length ? "successful" : "failure", hosts };
};

export const fetchServerCustomNotifications = async (
  server: ServerEntry,
  signal?: AbortSignal,
) => {
  const ip = server.ip?.trim().replace(/\/$/, "");
  const port = server.port?.trim();
  if (!ip || !port) return { message: "failure", custom: [] as NotifyCustom[] };
  const response = await fetch(`${ip}:${port}/api/notifications/custom`, {
    method: "GET",
    signal,
    headers: addBearer(server),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(httpStatusMessage(response.status));
  const data = JSON.parse(text);
  const ok = data?.message === "successful";
  const custom = ok && Array.isArray(data?.custom) ? (data.custom as NotifyCustom[]) : [];
  return { message: custom.length ? "successful" : "failure", custom };
};
