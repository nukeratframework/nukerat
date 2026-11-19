/** Attack graph panel: toolbar, node menu, view controls. */
const graphs = {
  roleServer: "SERVER",
  overlay: {
    loading: "loading...",
    empty: "No content",
  },
  detail: {
    title: "View - {{tag}}",
    fallbackHost: "Host",
    lastCheck: "Last Check",
    tag: "Tag",
    hostname: "Hostname",
    user: "User",
    privilege: "Privilege",
    internal: "Internal",
    external: "External",
    listener: "Listener",
    hostServer: "Host Server",
    hostPort: "Host Port",
    arch: "Arch",
    pid: "PID",
    process: "Process",
    os: "OS",
    firstSeen: "First Seen",
    lastSeen: "Last Seen",
    delay: "delay",
    server: "Server",
    implantConfig: "Implant Config",
  },
  toast: {
    fetchFailed: "Failed to fetch graph",
    unknownError: "Unknown error",
  },
  unknown: "unknown",
} as const;

export default graphs;
