/** Reports panel: report list, generate form, preview. */
const reports = {
  empty: "No reports generated yet",
  loading: "Loading...",
  columns: {
    name: "Name",
    file: "File",
    type: "Type",
    server: "Server",
    hosts: "Hosts",
    created: "Created",
  },
  reportTypes: {
    activity: "Activity Report",
    hosts: "Hosts Report",
    ioc: "Indicators of Compromise",
  },
  actions: {
    new: "New",
    view: "View",
    download: "Download",
    remove: "Remove",
    update: "Update",
  },
  removeConfirm: {
    title: "Remove Report",
    prefix: "Remove ",
    suffix: "? This cannot be undone.",
    remove: "Remove",
  },
  create: {
    title: "New Report",
    name: "Name",
    namePlaceholder: "Report name",
    description: "Description",
    descriptionPlaceholder: "Optional report description",
    server: "Server",
    serverPlaceholder: "Select a server...",
    reportType: "Report Type",
    fileType: "File Type",
    hideCredentials: "Hide credentials",
    cancel: "Cancel",
    create: "Create",
  },
  viewDialog: {
    close: "Close",
    loading: "Loading report...",
    previewTitle: "Report preview",
    noPreview: "No preview available",
    fallbackTitle: "Report",
  },
  toast: {
    fetchFailed: "Failed to fetch reports",
    createFailed: "Failed to create report",
    created: "Report created",
    downloadFailed: "Failed to download report",
    downloaded: "Report downloaded",
    loadFailed: "Failed to load report",
    removeFailed: "Failed to remove report",
    removed: "Report removed",
  },
} as const;

export default reports;
