/** Keylogger (keystrokes) panel: table, clear action. */
const keylogger = {
  title: "Keylogger",
  searchPlaceholder: "Search...",
  empty: "No content found",
  columns: {
    date: "Date",
    server: "Server",
    hostTag: "Host Tag",
    content: "Content",
  },
  actions: {
    view: "View",
    delete: "Delete",
  },
  pagination: "Page {{page}} / {{pageCount}}",
  fields: {
    date: "date",
    server: "server",
    hostTag: "host tag",
    host: "host",
    content: "content",
  },
  confirm: {
    title: "Delete keylogger",
    removeAllLead: "Remove all",
    removeAllTailOne: "entry? This cannot be undone.",
    removeAllTailMany: "entries? This cannot be undone.",
    removeOneLead: "Remove this keylogger entry for",
    removeOneTail: "? This cannot be undone.",
  },
  hostFilter: {
    label: "Host",
    search: "Search host...",
    all: "All hosts",
    empty: "No host found.",
    clear: "Clear host filter",
  },
  toast: {
    noServer: "No server associated with this entry",
    removeFailedOne: "Failed to remove {{count}} entry",
    removeFailedMany: "Failed to remove {{count}} entries",
  },
} as const;

export default keylogger;
