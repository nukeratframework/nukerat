export function contentSecurityPolicy(isDev: boolean): string {
  const scriptSrc = isDev ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'"

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data:",
    "connect-src 'self' http: https: ws: wss:",
    "object-src 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    "base-uri 'self'",
  ].join('; ')
}
