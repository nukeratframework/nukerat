/** NukeScripts panel: script list, editor, run actions. */
const nukescripts = {
  empty: "No scripts configured",
  loading: "Loading...",
  columns: {
    status: "Status",
    name: "Name",
    server: "Server",
    description: "Description",
    errors: "Errors",
    lastRun: "Last Run",
    created: "Created",
  },
  actions: {
    add: "Add",
    edit: "Edit",
    enable: "Enable",
    disable: "Disable",
    remove: "Remove",
    update: "Update",
  },
  removeConfirm: {
    title: "Remove script",
    prefix: "Remove ",
    suffix: "? This cannot be undone.",
    remove: "Remove",
  },
  form: {
    newTitle: "New Script",
    editTitle: "Edit - {{name}}",
    name: "Name",
    description: "Description",
    nukescript: "NukeScript",
    upload: "Upload",
    format: "Format",
    cancel: "Cancel",
    add: "Add",
    save: "Save",
  },
  errorBar: {
    exception: "Exception",
  },
  toast: {
    requestFailed: "Request failed",
    createFailed: "Failed to create script",
    created: "Script created",
    updateFailed: "Failed to update script",
    updated: "Script updated",
    removeFailed: "Failed to remove script",
    removed: "Script removed",
    statusUpdateFailed: "Failed to update script status",
  },
} as const;

export default nukescripts;
