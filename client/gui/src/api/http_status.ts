import { translate } from "@/i18n";

/** Maps a known HTTP status to the i18n key describing it. */
const HTTP_STATUS_MESSAGE: Partial<Record<number, string>> = {
  400: "api.http.badRequest",
  401: "api.http.unauthorized",
  403: "api.http.forbidden",
  404: "api.http.notFound",
  405: "api.http.methodNotAllowed",
  408: "api.http.requestTimeout",
  409: "api.http.conflict",
  413: "api.http.payloadTooLarge",
  415: "api.http.unsupportedMediaType",
  422: "api.http.unprocessableEntity",
  429: "api.http.tooManyRequests",
  500: "api.http.internalError",
  501: "api.http.notImplemented",
  502: "api.http.badGateway",
  503: "api.http.serviceUnavailable",
  504: "api.http.gatewayTimeout",
};

export function httpStatusMessage(status: number): string {
  const key = HTTP_STATUS_MESSAGE[status];
  return key ? translate(key) : `HTTP ${status}`;
}

export function responseErrorMessage(status: number, bodyMessage?: unknown): string {
  if (status < 200 || status >= 300) return httpStatusMessage(status);
  return typeof bodyMessage === "string" && bodyMessage.trim()
    ? bodyMessage
    : translate("api.requestFailed");
}

const GENERIC_FETCH_ERRORS = new Set([
  "Failed to fetch",
  "NetworkError when attempting to fetch resource.",
  "Load failed",
  "Network request failed",
]);

export function unreachableHost(name?: string): string {
  const label = name?.trim();
  const message = translate("api.unreachableHost");
  return label ? `${label}: ${message}` : message;
}

export function thrownErrorMessage(error: unknown, name?: string): string {
  const msg = error instanceof Error ? error.message.trim() : "";
  if (!msg || GENERIC_FETCH_ERRORS.has(msg)) return unreachableHost(name);
  return msg;
}
