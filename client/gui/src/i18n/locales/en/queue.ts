/** Queue panel: task table and actions. */
const queue = {
  empty: "No content found",
  loading: "Loading...",
  columns: {
    host: "Host",
    type: "Type",
    input: "Input",
    date: "Date",
    completed: "Completed",
    server: "Server",
  },
  searchTitle: "Search",
  searchPlaceholder: "Search...",
  page: "Page {{page}} / {{count}}",
  actions: {
    view: "View",
    remove: "Remove",
    update: "Update",
  },
  hostFilter: {
    placeholder: "Host",
    searchPlaceholder: "Search host...",
    empty: "No host found.",
  },
  split: {
    title: "Queue",
    time: "time",
    server: "server",
    host: "host",
    tag: "tag",
    type: "type",
    completed: "completed",
    captured: "captured",
    input: "input",
    parameters: "parameters",
    output: "output",
    error: "error",
  },
  removeConfirm: {
    title: "Remove queue entry",
    prefix: "Remove ",
    suffix: "? This cannot be undone.",
    remove: "Remove",
  },
  toast: {
    noServer: "No server associated with this entry",
  },
} as const;

export default queue;
