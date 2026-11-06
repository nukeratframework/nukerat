import type { PanelEditMenuBridge, WorkspacePanelMenuKind } from "./types.ts";
import { nativeBridge } from "./util.ts";
import { createAgentBridge } from "./agent.tsx";
import { createCredentialsBridge } from "./credentials.tsx";
import { createEmptyWorkspaceBridge } from "./empty-workspace.tsx";
import { createExplorerBridge } from "./explorer.tsx";
import { createFileServerBridge } from "./file-server.tsx";
import { createGraphsBridge } from "./graphs.tsx";
import { createKeyloggerBridge } from "./keylogger.tsx";
import { createNsDebuggerBridge } from "./ns-debugger.tsx";
import { createProcessBridge } from "./process.tsx";
import { createScreenshotBridge } from "./screenshot.tsx";
import { createSessionsBridge } from "./sessions.tsx";
import { createTerminalBridge } from "./terminal.tsx";

export const PANEL_MENU_REGISTRY: Record<WorkspacePanelMenuKind, () => PanelEditMenuBridge | null> = {
  terminal: createTerminalBridge,
  explorer: createExplorerBridge,
  process: createProcessBridge,
  agent: createAgentBridge,
  credentials: createCredentialsBridge,
  fileServer: createFileServerBridge,
  keylogger: createKeyloggerBridge,
  graphs: createGraphsBridge,
  nsDebugger: createNsDebuggerBridge,
  screenshot: createScreenshotBridge,
  sessions: createSessionsBridge,
  emptyWorkspace: createEmptyWorkspaceBridge,
};

export function bridgeFor(kind: WorkspacePanelMenuKind) {
  return PANEL_MENU_REGISTRY[kind]() ?? nativeBridge;
}
