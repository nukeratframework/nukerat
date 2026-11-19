/** IOC panel: table, add form, actions. */
const iocs = {
  empty: "No content found",
  loading: "Loading...",
  columns: {
    host: "Host",
    type: "Type",
    value: "Value",
    date: "Date",
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
    title: "IOC",
    date: "Date",
    server: "Server",
    tag: "Tag",
    host: "Host",
    type: "Type",
    value: "Value",
  },
  removeConfirm: {
    title: "Remove IOC",
    prefix: "Remove ",
    suffix: "? This cannot be undone.",
    remove: "Remove",
  },
  toast: {
    noServer: "No server associated with this entry",
  },
} as const;

export default iocs;
