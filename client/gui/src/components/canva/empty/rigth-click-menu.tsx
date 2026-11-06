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

export type EmptyMenuRuntime = {
  openWindow: (windowType: string) => void;
  floatWindow: (windowType: string) => void;
};

export const emptyMenuRuntimeRef: { current: EmptyMenuRuntime | null } = { current: null };

const open = (t: string) => () => emptyMenuRuntimeRef.current?.openWindow(t);
const float = (t: string) => () => emptyMenuRuntimeRef.current?.floatWindow(t);

const leaf = (label: string, icon?: LucideIcon, onClick?: () => void): PanelCustomMenuItem => ({
  kind: "action",
  label,
  icon,
  onClick,
});

const group = (label: string, items: PanelCustomMenuItem[], icon?: LucideIcon): PanelCustomMenuItem => ({
  kind: "action",
  label,
  icon,
  items,
});

const sep = (): PanelCustomMenuItem => ({ kind: "separator" });

export function buildEmptyWorkspaceMenuItems(): PanelCustomMenuItem[] {
  return [
    group(
      "New",
      [
        leaf("Terminal", SquareChevronRight, open("terminal")),
        leaf("File Browser", Folder, open("explorer")),
        leaf("Processes", Cpu, open("process")),
        sep(),
        leaf("Screenshot", Camera, open("screenshot")),
        leaf("Keystrokes", Keyboard, open("keylogger")),
        leaf("Credentials", KeyRound, open("credentials")),
        sep(),
        leaf("Targets", MonitorIcon, open("sessions")),
        leaf("Attack Graph", Share2, open("graphs")),
        sep(),
        leaf("AI Agent", Bot, open("agent")),
        leaf("File Server", Globe, open("fileServer")),
        sep(),
        leaf("NS Debugger", CodeXml, open("nukescripts_output")),
      ],
      Plus
    ),
    group("NukeRat", [
      leaf("Servers", Server, float("servers")),
      leaf("Listeners", Headphones, float("listeners")),
      leaf("Implants", Bug, float("implants")),
      leaf("Network", Network, float("network")),
      sep(),
      leaf("Agents", Bot, float("agents")),
      leaf("NukeScripts", CodeXml, float("nukescripts")),
      sep(),
      group(
        "Reports",
        [leaf("Files", undefined, float("reports")), leaf("IOCs", undefined, float("iocs"))],
        Scale
      ),
      sep(),
      leaf("Queue", Logs, float("queue")),
      leaf("Event Log", FileText, float("logs")),
    ]),
  ];
}

export function EmptyViewShell({ children }: { children: ReactNode }) {
  return <PanelMenuShell kind="emptyWorkspace">{children}</PanelMenuShell>;
}
