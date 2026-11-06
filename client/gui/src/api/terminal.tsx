import { getServers, type ServerEntry } from "@/api/system/config";
import { addBearer } from "@/api/system/auth";
import {
  endDownloadProgress,
  requestServerDownloadDelete,
  updateDownloadProgress,
} from "@/components/ui/downloads_activity";
import { responseErrorMessage, thrownErrorMessage } from "@/api/http_status";

function matchServer(server: ServerEntry, selectedServer?: string): boolean {
  const ip = server.ip?.trim().replace(/\/$/, "");
  const port = server.port?.trim();
  if (!ip || !port) return false;

  const normalized = selectedServer
    ?.trim()
    .replace(/\/+$/, "")
    .replace(/\/api\/terminal\/?$/i, "");
  if (!normalized) return false;

  return `${ip}:${port}` === normalized;
}

function appendMessageNewline(data: any): any {
  if (
    typeof data?.message === "string" &&
    !data.message.endsWith("\n") &&
    !data.message.endsWith("<br>")
  ) {
    data.message += "\n";
  }
  return data;
}

function normalizeTerminalResponse(data: any): any {
  const message =
    typeof data?.message === "string"
      ? data.message
      : typeof data?.output === "string"
        ? data.output
        : "";
  const withMessage = appendMessageNewline({ ...data, message });
  return {
    ...withMessage,
    output: withMessage.message ?? "",
  };
}

export const DataFetch = async (
  command: string,
  server?: string,
  extraData: object = {},
  session: string | false = false,
  signal?: AbortSignal
): Promise<any> => {
  try {
    const servers = (await getServers()).filter((s) => matchServer(s, server));
    if (servers.length === 0) {
      return {
        status: "failure",
        command,
        message: "No servers configured",
      };
    }

    const post = async (entry: ServerEntry): Promise<any> => {
      const ip = entry.ip?.trim().replace(/\/$/, "");
      const port = entry.port?.trim();
      if (!ip || !port) return null;
      const endpoint = `${ip}:${port}/api/terminal/`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 99999999999999999_000);
      const onExternalAbort = () => controller.abort();
      signal?.addEventListener("abort", onExternalAbort, { once: true });
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...(await addBearer(entry)),
          },
          body: JSON.stringify({
            command,
            ...(typeof session === "string" && session.length > 0 ? { session } : {}),
            ...extraData,
          }),
        });

        // ======= download =======
        const extra = extraData as {
          download_bytes?: boolean;
          download_dest?: string;
          download_id?: string;
        };
        if (extra.download_bytes && response.ok && response.body) {
          const dest = extra.download_dest ?? "/tmp/download";
          const downloadId = extra.download_id;
          const fileName = dest.split(/[/\\]/).filter(Boolean).pop() ?? "download";
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buf = new Uint8Array(0);
          let chunkCount = 0;
          let pendingSize = 0;
          let pendingTotal = 0;
          let pendingReceived = 0;
          let downloadOpen = false;

          const downloadAborted = () =>
            signal?.aborted === true || controller.signal.aborted;

          const cancelBodyReader = () => {
            void reader.cancel().catch(() => {});
          };

          const onStreamAbort = () => {
            cancelBodyReader();
          };
          signal?.addEventListener("abort", onStreamAbort);

          const finishAbortedDownload = async () => {
            cancelBodyReader();
            if (downloadOpen && window.electronAPI) {
              await window.electronAPI.invoke("file:downloadClose", dest).catch(() => {});
            }
            if (downloadId) {
              requestServerDownloadDelete(downloadId);
              endDownloadProgress(downloadId, false, true);
            }
            return { status: "aborted", command, endpoint };
          };

          const readBody = () => {
            if (downloadAborted()) {
              return Promise.reject(new DOMException("Aborted", "AbortError"));
            }
            return reader.read();
          };

          const merge = (chunk: Uint8Array) => {
            const next = new Uint8Array(buf.length + chunk.length);
            next.set(buf);
            next.set(chunk, buf.length);
            buf = next;
          };

          const findNl = () => {
            for (let i = 0; i < buf.length; i++) if (buf[i] === 10) return i;
            return -1;
          };

          const handleMeta = async (evt: any): Promise<any | null> => {
            if (evt.status === "failure") {
              if (downloadOpen && window.electronAPI) {
                await window.electronAPI.invoke("file:downloadClose", dest).catch(() => {});
              }
              if (downloadId) endDownloadProgress(downloadId, false);
              return { ...evt, command, endpoint };
            }
            if (evt.status === "success") {
              if (downloadOpen && window.electronAPI) {
                await window.electronAPI.invoke("file:downloadClose", dest);
              }
              if (downloadId) endDownloadProgress(downloadId, true);
              return {
                status: "success",
                message: evt.message ?? `Saved to ${dest}`,
                download_path: dest,
                source_terminal: evt.source_terminal,
                command,
                endpoint,
              };
            }
            if (evt.status === "progress" && downloadId) {
              if (typeof evt.received === "number") pendingReceived = evt.received;
              if (typeof evt.total === "number") pendingTotal = evt.total;
              return null;
            }
            if (evt.status === "chunk" && typeof evt.size === "number" && evt.size > 0) {
              pendingSize = evt.size;
              if (typeof evt.total === "number") pendingTotal = evt.total;
              if (typeof evt.received === "number") pendingReceived = evt.received;
              if (downloadId) updateDownloadProgress(downloadId, pendingReceived, pendingTotal);
              return null;
            }
            if (evt.status === "chunk" && typeof evt.data === "string" && window.electronAPI) {
              const b64 = evt.data.replace(/\s/g, "");
              chunkCount += 1;
              await window.electronAPI.invoke("file:saveBytes", {
                base64: b64,
                outputPath: dest,
                append: chunkCount > 1,
              });
              return null;
            }
            return null;
          };

          const pump = async (): Promise<any | null> => {
            while (true) {
              if (downloadAborted()) {
                throw new DOMException("Aborted", "AbortError");
              }
              if (pendingSize > 0) {
                if (buf.length < pendingSize) return null;
                const piece = buf.slice(0, pendingSize);
                buf = buf.slice(pendingSize);
                pendingSize = 0;
                chunkCount += 1;
                if (window.electronAPI) {
                  if (!downloadOpen) {
                    await window.electronAPI.invoke("file:downloadOpen", dest);
                    downloadOpen = true;
                  }
                  const copy = new Uint8Array(piece);
                  await window.electronAPI.invoke("file:downloadWrite", {
                    outputPath: dest,
                    data: copy,
                  });
                }
                if (downloadId) updateDownloadProgress(downloadId, pendingReceived, pendingTotal);
                continue;
              }
              const nl = findNl();
              if (nl < 0) return null;
              const line = decoder.decode(buf.slice(0, nl)).trim();
              buf = buf.slice(nl + 1);
              if (!line) continue;
              let evt: any;
              try {
                evt = JSON.parse(line);
              } catch {
                continue;
              }
              const result = await handleMeta(evt);
              if (result) return result;
            }
          };

          try {
            while (true) {
              if (downloadAborted()) return await finishAbortedDownload();
              const out = await pump();
              if (out) return out;
              const { done, value } = await readBody();
              if (done) break;
              if (value?.length) merge(value);
            }
            const tail = await pump();
            if (tail) return tail;
            if (buf.length > 0) {
              const line = decoder.decode(buf).trim();
              if (line) {
                try {
                  const result = await handleMeta(JSON.parse(line));
                  if (result) return result;
                } catch {
                  /* ignore */
                }
              }
            }
            if (chunkCount > 0) {
              if (downloadOpen && window.electronAPI) {
                await window.electronAPI.invoke("file:downloadClose", dest).catch(() => {});
              }
              if (downloadId) endDownloadProgress(downloadId, false);
              return {
                status: "failure",
                message: "Download stream ended unexpectedly",
                command,
                endpoint,
              };
            }
            if (downloadId) endDownloadProgress(downloadId, false);
            return { status: "failure", message: "Download failed", command, endpoint };
          } catch (error) {
            if (
              downloadAborted() &&
              (error instanceof DOMException && error.name === "AbortError" ||
                (error instanceof Error && error.name === "AbortError"))
            ) {
              return await finishAbortedDownload();
            }
            throw error;
          } finally {
            signal?.removeEventListener("abort", onStreamAbort);
          }
        }
        // =======================

        // ============= normal ============
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
            command,
            endpoint,
          };
        }
        const data = normalizeTerminalResponse(JSON.parse(text));
        if (data.custom_response && !data.message) {
          data.message = data.custom_response;
          data.output = data.custom_response;
        }
        return { ...data, endpoint };
        // =======================
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          if (signal?.aborted) {
            return { status: "aborted" };
          }
          return {
            status: "error",
            message: `${entry.name}:Connection timed out`,
            command,
          };
        }
        return {
          status: "ERR_conn",
          message: `${entry.name}: Unreachable host`,
          command,
        };
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onExternalAbort);
      }
    };

    let lastError: any = null;
    for (const entry of servers) {
      const response = await post(entry);
      if (response === null) continue;
      if (response?.status === "success") return response;
      if (response?.status === "aborted") return response;
      if (!response?.command) return response;
      lastError = response;
    }

    return (
      lastError ?? {
        status: "failure",
        command,
        message: "Request failed",
      }
    );
  } catch (error) {
    const errorMessage = thrownErrorMessage(error);
    return {
      status: "error",
      command,
      message: errorMessage,
      error: errorMessage,
    };
  }
};
