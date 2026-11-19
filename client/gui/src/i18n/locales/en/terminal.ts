/** Terminal panel: prompt, toolbar, local command messages, file transfers. */
const terminal = {
  prompt: {
    implant: "implant >",
    search: "search",
    confirm: 'Execute "{{command}}"? [Y/n]',
  },
  actions: {
    send: "Send (Enter)",
    clearPrefix: "Clear prefix (Esc)",
  },
  messages: {
    sessionChanged: "Session changed to: {{session}}",
    currentSession: "Current session: {{session}}",
    terminated: "Session terminated",
    currentPrefix: "Current prefix: {{prefix}}",
    noPrefix: "No prefix set",
    prefixCleared: "Prefix cleared",
    prefixSet: "Prefix set: {{prefix}}",
  },
  files: {
    readFailed: "Failed to read file",
    downloadCancelled: "Download cancelled",
    requestFailed: "Request failed",
    outputDestination: "Output destination: {{path}}",
    downloadSuccess: "File downloaded successfully",
    downloadSuccessPath: "File downloaded successfully ({{path}})",
    decodeError: "Error decoding file bytes",
  },
} as const;

export default terminal;
