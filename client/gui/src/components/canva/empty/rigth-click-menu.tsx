import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Bug,
  Camera,
  CodeXml,
  Cpu,
  Folder,
  Globe,
  Headphones,
  Keyboard,
  KeyRound,
  MonitorIcon,
  Network,
  Plus,
  Scale,
  Server,
  Share2,
  SquareChevronRight,
  Logs,
  FileText,
} from "lucide-react";
import { PanelMenuShell, type PanelCustomMenuItem } from "@/components/ui/rigth-click-menu.tsx";
import { translate } from "@/i18n";

export type EmptyMenuRuntime = {
  openWindow: (windowType: string) => void;
  floatWindow: (windowType: string) => void;
};

export const emptyMenuRuntimeRef: { current: EmptyMenuRuntime | null } = { current: null };

const open = (t: string) => () => emptyMenuRuntimeRef.current?.openWindow(t);
const float = (t: string) => () => emptyMenuRuntimeRef.current?.floatWindow(t);

/// Labels are built at menu-open time, so i18n keys are resolved here rather
/// than at module load (which would freeze the language of the first render).
const leaf = (labelKey: string, icon?: LucideIcon, onClick?: () => void): PanelCustomMenuItem => ({
  kind: "action",
  label: translate(labelKey),
  icon,
  onClick,
});

const group = (
  labelKey: string,
  items: PanelCustomMenuItem[],
  icon?: LucideIcon
): PanelCustomMenuItem => ({
  kind: "action",
  label: translate(labelKey),
  icon,
  items,
});

const sep = (): PanelCustomMenuItem => ({ kind: "separator" });

export function buildEmptyWorkspaceMenuItems(): PanelCustomMenuItem[] {
  return [
    group(
      "shell.newGroup",
      [
        leaf("shell.terminal", SquareChevronRight, open("terminal")),
        leaf("shell.fileBrowser", Folder, open("explorer")),
        leaf("shell.processes", Cpu, open("process")),
        sep(),
        leaf("shell.screenshot", Camera, open("screenshot")),
        leaf("shell.keystrokes", Keyboard, open("keylogger")),
        leaf("shell.credentials", KeyRound, open("credentials")),
        sep(),
        leaf("shell.targets", MonitorIcon, open("sessions")),
        leaf("shell.attackGraph", Share2, open("graphs")),
        sep(),
        leaf("shell.aiAgent", Bot, open("agent")),
        leaf("shell.fileServer", Globe, open("fileServer")),
        sep(),
        leaf("shell.nsDebugger", CodeXml, open("nukescripts_output")),
      ],
      Plus
    ),
    group("shell.menu.nukerat", [
      leaf("shell.servers", Server, float("servers")),
      leaf("shell.listeners", Headphones, float("listeners")),
      leaf("shell.implants", Bug, float("implants")),
      leaf("shell.network", Network, float("network")),
      sep(),
      leaf("shell.agents", Bot, float("agents")),
      leaf("shell.nukescripts", CodeXml, float("nukescripts")),
      sep(),
      group(
        "shell.reports",
        [leaf("shell.files", undefined, float("reports")), leaf("shell.iocs", undefined, float("iocs"))],
        Scale
      ),
      sep(),
      leaf("shell.queue", Logs, float("queue")),
      leaf("shell.eventLog", FileText, float("logs")),
    ]),
  ];
}

export function EmptyViewShell({ children }: { children: ReactNode }) {
  return <PanelMenuShell kind="emptyWorkspace">{children}</PanelMenuShell>;
}
