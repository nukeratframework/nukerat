/** Client-side API layer messages (HTTP status, transport errors). */
const api = {
  requestFailed: "Request failed",
  unreachableHost: "Unreachable host",
  invalidServer: "Invalid server",
  notAuthenticated: "Not authenticated",
  keyEmpty: "Key is empty",
  badKey: "Bad authentication key",
  connectionTimedOut: "Connection timed out",
  serverNotFound: "Server not found",
  noServersConfigured: "No servers configured",
  failure: "failure",
  http: {
    badRequest: "Bad request",
    unauthorized: "Unauthorized",
    forbidden: "Forbidden",
    notFound: "Not found",
    methodNotAllowed: "Method not allowed",
    requestTimeout: "Request timeout",
    conflict: "Conflict",
    payloadTooLarge: "Payload too large",
    unsupportedMediaType: "Unsupported media type",
    unprocessableEntity: "Unprocessable entity",
    tooManyRequests: "Too many requests",
    internalError: "Internal error",
    notImplemented: "Not implemented",
    badGateway: "Bad gateway",
    serviceUnavailable: "Service unavailable",
    gatewayTimeout: "Gateway timeout",
  },
} as const;

export default api;
