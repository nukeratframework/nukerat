/** Servers panel: server list, auth status, add/edit form. */
const servers = {
  empty: "No servers configured",
  loading: "Loading...",
  columns: {
    status: "Status",
    name: "Name",
    protocol: "Protocol",
    ip: "IP",
    port: "Port",
  },
  status: {
    idle: "Idle",
    checking: "Checking...",
    online: "Online",
    unauthorized: "Unauthorized",
    offline: "Offline",
  },
  actions: {
    add: "Add",
    edit: "Edit",
    remove: "Remove",
    update: "Update",
  },
  removeConfirm: {
    title: "Remove server",
    prefix: "Remove ",
    suffix: "? This cannot be undone.",
    remove: "Remove",
  },
  form: {
    newTitle: "New Server",
    editTitle: "Edit - {{name}}",
    keyLabel: "Key (.key)",
    uploadKey: "Upload .key",
    protocol: "Protocol",
    host: "Host",
    port: "Port",
    clearSession: "Clear Session",
    auth: "Auth",
  },
  errors: {
    keyEmpty: "Key is empty.",
    protocol: 'Protocol must be "http" or "https".',
    host: "Host must be non-empty and must not contain '/'.",
    portNumeric: "Port must be numeric.",
    portRange: "Port must be between 1 and 65535.",
    invalidKey: "Invalid key format",
    keyAlreadyExists: "{{name}}:Key already exists",
  },
  toast: {
    sessionCleared: "Session cleared",
    clearJwtFailed: "Failed to clear JWT",
    authenticated: "Authenticated",
    authFailed: "Authentication failed",
  },
} as const;

export default servers;
