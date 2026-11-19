/**
 * Stable panel identity, separate from the displayed title.
 *
 * Dockview panels used to be keyed by their English title (`hostless_titles`,
 * `getPanelTitle`), which cannot survive translation. Everything that needs to
 * branch on "which panel is this" must use a `PanelId`; only headers and menus
 * resolve the corresponding `PANEL_TITLE_KEY` entry.
 */

/** i18n key for the docked-panel header title. Its keys are the `PanelId` set. */
export const PANEL_TITLE_KEY = {
  terminal: "workspace.panel.terminal",
  explorer: "workspace.panel.explorer",
  process: "workspace.panel.process",
  screenshot: "workspace.panel.screenshot",
  keylogger: "workspace.panel.keylogger",
  credentials: "workspace.panel.credentials",
  sessions: "workspace.panel.sessions",
  graphs: "workspace.panel.graphs",
  agent: "workspace.panel.agent",
  fileServer: "workspace.panel.fileServer",
  nukescripts_output: "workspace.panel.nukescriptsOutput",
  listeners: "workspace.panel.listeners",
  network: "workspace.panel.network",
  servers: "workspace.panel.servers",
  implants: "workspace.panel.implants",
  logs: "workspace.panel.logs",
  agents: "workspace.panel.agents",
  queue: "workspace.panel.queue",
  iocs: "workspace.panel.iocs",
  nukescripts: "workspace.panel.nukescripts",
  reports: "workspace.panel.reports",
  about: "workspace.panel.about",
  preferences: "workspace.panel.preferences",
} as const;

/** Every id accepted by `openWindow` / `floatWindow`. */
export type PanelId = keyof typeof PANEL_TITLE_KEY;

/** Panels that are not bound to a host, so they hide the host selector. */
export const HOSTLESS_PANELS: ReadonlySet<string> = new Set<PanelId>([
  "graphs",
  "sessions",
  "fileServer",
  "agent",
  "keylogger",
  "queue",
  "nukescripts",
  "credentials",
  "nukescripts_output",
  "listeners",
  "network",
  "servers",
  "implants",
  "logs",
  "agents",
  "iocs",
  "reports",
  "about",
  "preferences",
]);

export function isHostlessPanel(panelId: string | undefined): boolean {
  return panelId != null && HOSTLESS_PANELS.has(panelId);
}
