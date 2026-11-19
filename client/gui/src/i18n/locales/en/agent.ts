/** AI agent panel: chat, settings drawer, model selection. */
const agent = {
  title: "AI Agent",
  inputPlaceholder: "Ask the agent...",
  waitingForResponse: "Waiting for response...",
  thinking: "Thinking",
  stop: "Stop",
  cancelRequest: "Cancel request",
  copy: "Copy",
  clear: "Clear",
  settings: "Settings",
  selectModel: "Select a model",
  searchModel: "Search model...",
  noModel: "No model found.",
  clearModel: "Clear model",
  clearTitle: "Clear History",
  clearBody: "Clear chat history? This cannot be undone.",
  settingsPanel: {
    systemPrompt: "System prompt",
    systemPromptPlaceholder: "Leave empty for none",
    context: "Context",
    default: "Default",
    custom: "Custom",
    format: "Format",
  },
  toast: {
    contextAttached: "{{key}} context attached",
    selectModel: "Select a model",
    historyCopied: "History copied",
    invalidJson: "Invalid JSON",
  },
} as const;

export default agent;
