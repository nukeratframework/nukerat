/** Processes panel: table headers, filters, actions. */
const process = {
  searchPlaceholder: "Filter processes...",
  tree: "Tree",
  flat: "Flat",
  empty: "No processes",
  columns: {
    name: "NAME",
    pid: "PID",
    cpu: "CPU",
    memory: "MEMORY",
    user: "USER",
    privilege: "PRIV",
    integrity: "INTEGRITY",
    session: "SESSION",
    arch: "ARCH",
    network: "NETWORK",
  },
  filters: {
    all: "All",
    user: "User",
    admin: "Admin",
    system: "System",
    root: "Root",
  },
  toast: {
    copied: "Process context copied",
    loadFailed: "Could not load process list.",
    parseFailed: "Could not parse process tree.",
  },
} as const;

export default process;
