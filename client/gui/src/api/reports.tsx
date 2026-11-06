import { getServers, type ServerEntry } from "@/api/system/config";
import { addBearer } from "@/api/system/auth";
import { httpStatusMessage, responseErrorMessage, thrownErrorMessage, unreachableHost } from "@/api/http_status";

export type ReportType = "activity" | "hosts" | "ioc";
export type ReportFileType = "pdf" | "html" | "json";

export interface ReportEntry {
  tag: string;
  name: string;
  description: string;
  reportType: ReportType | string;
  fileType?: ReportFileType | string;
  hosts: string[];
  file?: string;
  created_at?: string;
  server?: string;
}

const fileTypeFromName = (filename?: string): ReportFileType | null => {
  const name = filename?.trim().toLowerCase() ?? "";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".html")) return "html";
  if (name.endsWith(".pdf")) return "pdf";
  return null;
};

export const resolveReportFileType = (
  entry?: { fileType?: string; file?: string } | null,
  download?: { fileType?: string; file?: string } | null,
): ReportFileType => {
  const fromDownloadFile = fileTypeFromName(download?.file);
  if (fromDownloadFile) return fromDownloadFile;
  const fromEntryFile = fileTypeFromName(entry?.file);
  if (fromEntryFile) return fromEntryFile;
  const raw = (download?.fileType ?? entry?.fileType)?.trim().toLowerCase();
  if (raw === "pdf" || raw === "html" || raw === "json") return raw;
  return "pdf";
};

export const parseReportUtcDate = (raw?: string) => {
  const text = raw?.trim();
  if (!text) return null;
  const normalized =
    text.includes("T") && !text.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(text)
      ? `${text}Z`
      : text;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
};

export interface CreateReportPayload {
  name: string;
  description: string;
  reportType: ReportType;
  fileType: ReportFileType;
  hostTags: string[];
  hideCredentials?: boolean;
}

const ok = (s?: string) => s === "success" || s === "successfull";

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

function mapReportEntry(r: any, server: string): ReportEntry {
  const rest = { ...r };
  delete rest.id;
  delete rest.session_id;
  return {
    ...rest,
    tag: r?.tag ?? "",
    name: r?.name ?? "",
    description: r?.description ?? "",
    reportType: r?.reportType ?? "",
    hosts: Array.isArray(r?.hosts) ? r.hosts : [],
    created_at: r?.created_at ?? "",
    file: r?.file ?? "",
    fileType: resolveReportFileType({
      fileType: r?.fileType,
      file: r?.file,
    }),
    server: r?.server || server || "",
  };
}

export const fetchReports = async (signal?: AbortSignal): Promise<{
  status: string;
  reports?: ReportEntry[];
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
            const response = await fetch(`${ip}:${port}/api/reports/`, {
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
          } catch {
            return { status: "ERR_conn", message: `${server.name}: Unreachable host` };
          }
        }),
      )
    ).filter((r) => r !== null);

    const loaded = responses.filter((r) => ok(r.status));
    if (loaded.length === 0) {
      return responses[0] ?? { status: "failure", message: unreachableHost(servers[0]?.name) };
    }

    return {
      status: "success",
      reports: loaded.flatMap((res) =>
        (Array.isArray(res?.reports) ? res.reports : []).map((r: any) =>
          mapReportEntry(r, res.server),
        ),
      ),
    };
  } catch (error) {
    const message = thrownErrorMessage(error);
    return { status: "error", message };
  }
};

export const createReportRequest = async (
  data: CreateReportPayload,
  server?: string,
): Promise<{ status: string; tag?: string; message?: string }> => {
  let serverName: string | undefined;
  try {
    const servers = (await getServers()).filter((s) => matchServer(s, server));
    if (servers.length === 0) {
      return {
        status: "failure",
        message: server ? "Server not found" : "No servers configured",
      };
    }

    const entry = servers[0];
    serverName = entry.name;
    const ip = entry.ip?.trim().replace(/\/$/, "");
    const port = entry.port?.trim();
    if (!ip || !port) {
      return { status: "failure", message: "Invalid server address" };
    }

    const response = await fetch(`${ip}:${port}/api/reports/`, {
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
    return { status: "ERR_conn", message: unreachableHost(serverName) };
  }
};

async function reportByTagRequest(
  tag: string,
  path: "download" | "view",
  server?: string,
): Promise<any> {
  const servers = (await getServers()).filter((s) => matchServer(s, server));
  if (servers.length === 0) {
    return {
      status: "failure",
      message: server ? "Server not found" : "No servers configured",
    };
  }

  const entry = servers[0];
  const ip = entry.ip?.trim().replace(/\/$/, "");
  const port = entry.port?.trim();
  if (!ip || !port) {
    return { status: "failure", message: "Invalid server address" };
  }

  try {
    const response = await fetch(
      `${ip}:${port}/api/reports/${encodeURIComponent(tag)}/${path}`,
      {
        method: "GET",
        headers: addBearer(entry),
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
}

export const deleteReportRequest = async (
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
        `${ip}:${port}/api/reports/${encodeURIComponent(tag)}`,
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

export const downloadReportRequest = (tag: string, server?: string) =>
  reportByTagRequest(tag, "download", server);

export const viewReportRequest = (tag: string, server?: string) =>
  reportByTagRequest(tag, "view", server);

export const pdfContentToBlob = (content: string) => {
  const bin = atob(content);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "application/pdf" });
};

export const pdfContentToObjectUrl = (content: string) =>
  URL.createObjectURL(pdfContentToBlob(content));

const reportBlob = (content: string, fileType?: string) => {
  const kind = (fileType || "pdf").toLowerCase();
  if (kind === "json") {
    const text = atob(content);
    return new Blob([text], { type: "application/json" });
  }
  if (kind === "html") {
    const text = atob(content);
    return new Blob([text], { type: "text/html" });
  }
  return pdfContentToBlob(content);
};

export const saveReportFile = (
  content: string,
  filename: string,
  fileType: ReportFileType | string = "pdf",
) => {
  const kind = resolveReportFileType({ fileType, file: filename });
  const ext = kind === "json" ? ".json" : kind === "html" ? ".html" : ".pdf";
  const base = (filename.trim() || "report").replace(/\.(pdf|html|json)$/i, "");
  const url = URL.createObjectURL(reportBlob(content, kind));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${base}${ext}`;
  link.click();
  URL.revokeObjectURL(url);
};
