/** File server panel: table, upload/download actions. */
const fileServer = {
  searchFiles: "Search files...",
  selectServer: "Select a server",
  searchServer: "Search server...",
  noServer: "No server found.",
  clearServer: "Clear server",
  emptySelectServer: "Select a server to view files",
  empty: "No files found",
  columns: {
    date: "Date",
    name: "Name",
    size: "Size",
    actions: "Actions",
  },
  actions: {
    download: "Download",
    rename: "Rename",
    delete: "Delete",
    upload: "Upload",
    update: "Update",
  },
  confirm: {
    deleteTitle: "Delete File",
    deleteLead: "Delete",
    deleteTail: "? This cannot be undone.",
    renameTitle: "Rename File",
  },
  toast: {
    downloaded: "File downloaded",
  },
} as const;

export default fileServer;
