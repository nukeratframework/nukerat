/** Credentials panel: table, form, confirmations. */
const credentials = {
  empty: "No content found",
  columns: {
    name: "Name",
    server: "Server",
    hostTag: "Host Tag",
    desc: "Desc",
  },
  actions: {
    update: "Update",
  },
  confirm: {
    removeTitle: "Remove credential",
    removeAllLead: "Remove all",
    removeAllTailOne: "credential? This cannot be undone.",
    removeAllTailMany: "credentials? This cannot be undone.",
    removeLead: "Remove",
    removeTail: "? This cannot be undone.",
  },
  form: {
    newTitle: "New Credential",
    editPrefix: "Edit",
    viewPrefix: "View",
    fallbackName: "Credential",
    host: "Host",
    name: "Name",
    namePlaceholder: "Credential name",
    description: "Description",
    optional: "Optional",
    credentials: "Credentials",
    credentialsPlaceholder: "username:password",
    selectServerFirst: "Select a server first...",
    loadingHosts: "Loading hosts...",
    selectHost: "Select host...",
  },
  toast: {
    loadFailed: "Failed to load credentials",
    createFailed: "Failed to create credential",
    updateFailed: "Failed to update credential",
    created: "Credential created",
    updated: "Credential updated",
    removeFailed: "Failed to remove credential",
    removed: "Credential removed",
    removeAllFailed: "Failed to remove credentials",
    removeManyFailedOne: "Failed to remove {{count}} credential",
    removeManyFailed: "Failed to remove {{count}} credentials",
    removedMany: "Credentials removed",
  },
} as const;

export default credentials;
