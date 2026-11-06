const HTTP_STATUS_MESSAGE: Record<number, string> = {
  400: "Bad request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not found",
  405: "Method not allowed",
  408: "Request timeout",
  409: "Conflict",
  413: "Payload too large",
  415: "Unsupported media type",
  422: "Unprocessable entity",
  429: "Too many requests",
  500: "Internal error",
  501: "Not implemented",
  502: "Bad gateway",
  503: "Service unavailable",
  504: "Gateway timeout",
};

export function httpStatusMessage(status: number): string {
  return HTTP_STATUS_MESSAGE[status] ?? `HTTP ${status}`;
}

export function responseErrorMessage(status: number, bodyMessage?: unknown): string {
  if (status < 200 || status >= 300) return httpStatusMessage(status);
  return typeof bodyMessage === "string" && bodyMessage.trim()
    ? bodyMessage
    : "Request failed";
}

const GENERIC_FETCH_ERRORS = new Set([
  "Failed to fetch",
  "NetworkError when attempting to fetch resource.",
  "Load failed",
  "Network request failed",
]);

export function unreachableHost(name?: string): string {
  const label = name?.trim();
  return label ? `${label}: Unreachable host` : "Unreachable host";
}

export function thrownErrorMessage(error: unknown, name?: string): string {
  const msg = error instanceof Error ? error.message.trim() : "";
  if (!msg || GENERIC_FETCH_ERRORS.has(msg)) return unreachableHost(name);
  return msg;
}
