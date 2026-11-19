/** Event log panel: log table, filters. */
const logs = {
  columns: {
    date: "Date",
    type: "Type",
    category: "Category",
    message: "Message",
  },
  categories: {
    listeners: "listeners",
    launcher: "launcher",
    server: "server",
  },
  loading: "Loading...",
  cancel: "Cancel",
  selectServer: "Select a server to view logs",
  empty: "No log entries",
  resetFilters: "Reset filters",
  actions: {
    view: "View",
    update: "Update",
  },
  page: "Page {{page}} / {{count}}",
  filters: {
    serverPlaceholder: "Server",
    searchPlaceholder: "Search logs...",
    all: "All",
    entryCountOne: "{{count}} entry",
    entryCountMany: "{{count}} entries",
  },
  split: {
    title: "Log",
    message: "Message",
  },
} as const;

export default logs;
