import type { LucideIcon } from "lucide-react";
import {
  SquareChevronRight,
  Share2,
  Cpu,
  Folder,
  Bug,
  Network,
  Server,
  Plus,
  X,
  Headphones,
  MonitorIcon,
  Info,
  Keyboard,
  CodeXml,
  LogOut,
  Bot,
  Camera,
  KeyRound,
  Globe,
  CodeXmlIcon,
  Scale,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Fullscreen,
  Logs,
  FileText,
  Command,
  MessageCircleMore,
  Fingerprint,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { WorkspaceTab } from "../logic";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HiOutlineDocumentReport } from "react-icons/hi";
import { GrHelpBook } from "react-icons/gr";
import { LuSquareCode } from "react-icons/lu";
import {
  ShortcutHint,
  registerTopbarDropdownCloser,
  type ShortcutActionId,
} from "../shortcuts";
import { DownloadsTopbarButton } from "./downloads";
import logoSvg from "@/assets/logo.svg";

export const hostOpenPanels: { type: string; icon: LucideIcon; label: string }[] = [
  { type: "terminal", icon: SquareChevronRight, label: "Terminal" },
  { type: "explorer", icon: Folder, label: "File browser" },
  { type: "process", icon: Cpu, label: "Processes" },
  { type: "screenshot", icon: Camera, label: "Screenshot" },
];

interface MainProps {
  openWindow: (window: string) => void;
  floatWindow: (window: string) => void;
  workspaceTabs: WorkspaceTab[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  onTabAdd: () => void;
  onTabClose: (id: string) => void;
  onTabRename: (id: string, name: string) => void;
}

const WORKSPACE_TAB_NAME_MAX_LEN = 30;

export default function TopBar(props: MainProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const commitTabRename = (tabId: string, fallback: string) => {
    const raw = renameDraft.trim() || fallback;
    const next = raw.slice(0, WORKSPACE_TAB_NAME_MAX_LEN);
    props.onTabRename(tabId, next);
    setRenamingTabId(null);
  };

  const cancelTabRename = () => setRenamingTabId(null);

  useEffect(() => {
    registerTopbarDropdownCloser(() => setOpenMenu(null));
    return () => registerTopbarDropdownCloser(null);
  }, []);

  return (
    <div className="bg-color-workspace">
      <div
        style={{ borderRadius: ".45rem" }}
        className="m3vqw bg-color-workspace"
      >
        <div className="ml-2 mr-2 inline-flex items-center gap-2 text-[13.5px] leading-none primary-text">
          <img
            src={logoSvg}
            alt=""
            className="h-[1em] w-auto shrink-0 opacity-70 object-contain"
          />
          <span className="font-bold tracking-[0.18em]">NUKERAT</span>
        </div>
        <div className="w-px h-4 bg-[#292929] mr-4 ml-4 shrink-0" />

        <TopBarMenu label="NukeRat" openMenu={openMenu} setOpenMenu={setOpenMenu}>
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.floatWindow("servers")}
            >
              <span className="flex items-center gap-2">
                <Server size={13} />
                Servers
              </span>
              <ShortcutHint id="servers" />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.floatWindow("listeners")}
            >
              <span className="flex items-center gap-2">
                <Headphones size={14} />
                Listeners
              </span>
              <ShortcutHint id="listeners" />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.floatWindow("implants")}
            >
              <span className="flex items-center gap-2">
                <Bug size={13} />
                Implants
              </span>
              <ShortcutHint id="implants" />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.floatWindow("network")}
            >
              <span className="flex items-center gap-2">
                <Network size={13} />
                Network
              </span>
              <ShortcutHint id="network" />
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => props.floatWindow("agents")}>
              <Bot size={13} />
              Agents
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => props.floatWindow("nukescripts")}>
              <CodeXmlIcon size={13} />
              NukeScripts
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => props.floatWindow("reports")}>
              <HiOutlineDocumentReport size={13} />
              Reports
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => props.floatWindow("iocs")}>
              <Fingerprint size={13} />
              IOCs
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.floatWindow("queue")}
            >
              <span className="flex items-center gap-2">
                <Logs size={13} />
                Queue
              </span>
              <ShortcutHint id="queue" />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.floatWindow("logs")}
            >
              <span className="flex items-center gap-2">
                <FileText size={13} />
                Event Log
              </span>
              <ShortcutHint id="logs" />
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => window.close()}
            >
              <span className="flex items-center gap-2">
                <LogOut size={13} />
                Quit
              </span>
              <ShortcutHint id="quit" />
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </TopBarMenu>

        <TopBarMenu label="View" openMenu={openMenu} setOpenMenu={setOpenMenu}>
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => window.electronAPI?.send("window:toggleFullscreen")}
            >
              <span className="flex items-center gap-2">
                <Fullscreen size={13} />
                Full Screen
              </span>
              <ShortcutHint id="view_fullscreen" />
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => window.electronAPI?.send("window:zoomIn")}
            >
              <span className="flex items-center gap-2">
                <ZoomIn size={13} />
                Zoom In
              </span>
              <ShortcutHint id="view_zoom_in" />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => window.electronAPI?.send("window:zoomOut")}
            >
              <span className="flex items-center gap-2">
                <ZoomOut size={13} />
                Zoom Out
              </span>
              <ShortcutHint id="view_zoom_out" />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => window.electronAPI?.send("window:resetZoom")}
            >
              <span className="flex items-center gap-2">
                <RotateCcw size={13} />
                Reset Zoom
              </span>
              <ShortcutHint id="view_zoom_reset" />
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => window.electronAPI?.send("window:toggleDevTools")}
            >
              <span className="flex items-center gap-2">
                <CodeXml size={13} />
                Devtools
              </span>
              <ShortcutHint id="view_devtools" />
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </TopBarMenu>

        <TopBarMenu label="Tabs" openMenu={openMenu} setOpenMenu={setOpenMenu}>
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.openWindow("terminal")}
            >
              <span className="flex items-center gap-2">
                <SquareChevronRight size={13} />
                Terminal
              </span>
              <ShortcutHint id="terminal" />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.openWindow("explorer")}
            >
              <span className="flex items-center gap-2">
                <Folder size={13} />
                File Browser
              </span>
              <ShortcutHint id="explorer" />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.openWindow("process")}
            >
              <span className="flex items-center gap-2">
                <Cpu size={13} />
                Processes
              </span>
              <ShortcutHint id="process" />
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => props.openWindow("screenshot")}>
              <Camera size={13} />
              Screenshot
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => props.openWindow("keylogger")}>
              <Keyboard size={13} />
              Keystrokes
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.openWindow("credentials")}
            >
              <span className="flex items-center gap-2">
                <KeyRound size={13} />
                Credentials
              </span>
              <ShortcutHint id="credentials" />
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.openWindow("sessions")}
            >
              <span className="flex items-center gap-2">
                <MonitorIcon size={13} />
                Sessions
              </span>
              <ShortcutHint id="sessions" />
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => props.openWindow("graphs")}>
              <Share2 size={13} />
              Attack Graph
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.openWindow("agent")}
            >
              <span className="flex items-center gap-2">
                <Bot size={13} />
                AI Agent
              </span>
              <ShortcutHint id="agent" />
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => props.openWindow("fileServer")}>
              <Globe size={13} />
              File Server
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => props.openWindow("nukescripts_output")}>
              <LuSquareCode size={13} />
              NS Debugger
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </TopBarMenu>

        <TopBarMenu label="Help" openMenu={openMenu} setOpenMenu={setOpenMenu}>
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() =>
                window.open("https://nukerat.com/docs", "_blank")
              }
            >
              <span className="flex items-center gap-2">
                <GrHelpBook size={13} />
                Documentation
              </span>
              <ShortcutHint id="docs" />
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                window.open("https://nukerat.com/docs/shortcuts", "_blank")
              }
            >
              <Command size={13} />
              Shortcuts
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() =>
                window.open(
                  "https://github.com/nukeratframework/nukerat/discussions/new?category=ideas",
                  "_blank"
                )
              }
            >
              <MessageCircleMore size={13} />
              Feedbacks
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                window.open(
                  "https://raw.githubusercontent.com/nukeratframework/nukerat/refs/heads/main/LICENSE",
                  "_blank"
                )
              }
            >
              <Scale size={13} />
              License
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => props.floatWindow("about")}>
              <Info size={10} />
              About
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </TopBarMenu>

        <div className="w-px h-4 bg-[#292929] mr-4 ml-4 shrink-0" />

        <NavItem
          onClick={() => props.openWindow("terminal")}
          type="icons-only"
          icon={<SquareChevronRight size={18.5} />}
          label="Terminal"
          title="Terminal"
          desc="Interactive session console"
          shortcutId="terminal"
        />
        <NavItem
          onClick={() => props.openWindow("explorer")}
          type="icons-only"
          icon={<Folder size={18.5} />}
          label="File Browser"
          title="File Browser"
          desc="Browse files on the active host"
          shortcutId="explorer"
        />
        <NavItem
          onClick={() => props.openWindow("process")}
          type="icons-only"
          icon={<Cpu size={18.5} />}
          label="Processes"
          title="Processes"
          desc="View and manage host processes"
          shortcutId="process"
        />

        <div className="w-px h-4 bg-[#292929] mr-4 ml-4 shrink-0" />

        <NavItem
          onClick={() => props.openWindow("screenshot")}
          type="icons-only"
          icon={<Camera size={20} />}
          label="Screenshot"
          title="Screenshot"
          desc="Capture remote desktop view"
        />
        <NavItem
          onClick={() => props.openWindow("keylogger")}
          type="icons-only"
          icon={<Keyboard size={18.5} />}
          label="Keylogger"
          title="Keylogger"
          desc="Capture keyboard events"
        />
        <NavItem
          onClick={() => props.openWindow("credentials")}
          type="icons-only"
          icon={<KeyRound size={18.5} />}
          label="Credentials"
          title="Credentials"
          desc="Manage stored credentials"
          shortcutId="credentials"
        />

        <div className="w-px h-4 bg-[#292929] mr-4 ml-4 shrink-0" />

        <NavItem
          onClick={() => props.openWindow("sessions")}
          type="icons-only"
          icon={<MonitorIcon size={18.5} />}
          label="Sessions"
          title="Sessions"
          desc="View active sessions"
          shortcutId="sessions"
        />
        <NavItem
          onClick={() => props.openWindow("graphs")}
          type="icons-only"
          icon={<Share2 size={18.5} />}
          label="Attack Graph"
          title="Attack Graph"
          desc="Visualize lateral movement and pivots"
        />

        <div className="w-px h-4 bg-[#292929] mr-4 ml-4 shrink-0" />

        <NavItem
          onClick={() => props.openWindow("agent")}
          type="icons-only"
          icon={<Bot size={22} />}
          label="AI Agent"
          title="AI Agent"
          desc="AI-assisted session operations"
          shortcutId="agent"
        />
        <NavItem
          onClick={() => props.openWindow("fileServer")}
          type="icons-only"
          icon={<Globe size={18.5} />}
          label="File Server"
          title="File Server"
          desc="Team server file staging"
        />

        <DownloadsTopbarButton />

        <div className="w-px h-4 bg-[#292929] mr-4 ml-4 shrink-0" />

        {/* Workspace tabs -------------------------*/}

        {props.workspaceTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => props.onTabSelect(tab.id)}
              onMouseDown={(e) => {
                if (e.button !== 1) return;
                e.preventDefault();
                e.stopPropagation();
                props.onTabClose(tab.id);
              }}
              style={{ fontWeight: "500", padding: "0px 7px 0px 7px" }}
              className={`button-default text-[.8rem] ml-0.5 cursor-pointer group flex items-center gap-1.5 px-2 py-0.5 rounded font-medium whitespace-nowrap transition-colors ${
                tab.id === props.activeTabId
                  ? "bg-[#2a2a2a] primary-text border border-[#3a3a3a]"
                  : "primary-text hover:text-[#a0a0a0] hover:bg-[#1e1e1e] border border-transparent"
              }`}
            >
              {renamingTabId === tab.id ? (
                <input
                  autoFocus
                  maxLength={WORKSPACE_TAB_NAME_MAX_LEN}
                  value={renameDraft}
                  onChange={(e) =>
                    setRenameDraft(e.target.value.slice(0, WORKSPACE_TAB_NAME_MAX_LEN))
                  }
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onBlur={() => commitTabRename(tab.id, tab.name)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitTabRename(tab.id, tab.name);
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancelTabRename();
                    }
                  }}
                  className="workspace-tab-rename-input"
                  style={{
                    width: `${Math.min(Math.max(renameDraft.length, 4), WORKSPACE_TAB_NAME_MAX_LEN)}ch`,
                  }}
                />
              ) : (
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setRenamingTabId(tab.id);
                    setRenameDraft(tab.name.slice(0, WORKSPACE_TAB_NAME_MAX_LEN));
                  }}
                >
                  {tab.name}
                </span>
              )}
              {props.workspaceTabs.length > 1 && (
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onTabClose(tab.id);
                  }}
                  className="group-hover:opacity-100 hover:text-red-400 transition rounded p-0.5"
                >
                  <X size={13} />
                </span>
              )}
            </button>
        ))}
        <button
          onClick={props.onTabAdd}
          title="New workspace"
          className="button-default p-1 rounded text-[#6b6b6b] hover:text-[#a0a0a0] hover:bg-[#1e1e1e] transition-colors"
        >
          <Plus size={17} />
        </button>
        {/* Workspace end ----------------------*/}

        <div className="flex-1" />
      </div>
    </div>
  );
}

function TopBarMenu({
  label,
  children,
  openMenu,
  setOpenMenu,
}: {
  label: string;
  children: React.ReactNode;
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
}) {
  return (
    <DropdownMenu
      open={openMenu === label}
      onOpenChange={(open) => setOpenMenu(open ? label : null)}
    >
      <DropdownMenuTrigger asChild>
        <div className="ml-0.5 mr-0.5 font-[400] flex items-center gap-1.5 cursor-pointer rounded px-2 py-1 text-[13.5px] primary-text">
          <span>{label}</span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        sideOffset={0}
        className="topbar-menu-dropdown rounded-[8px] [&_[data-slot=dropdown-menu-group]]:w-full [&_[data-slot=dropdown-menu-sub-trigger]]:w-full"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavItem({
  type,
  icon,
  label,
  title,
  desc,
  onClick,
}: {
  type?: string;
  icon: React.ReactNode;
  label: string;
  title?: string;
  desc?: string;
  shortcutId?: ShortcutActionId;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className="button-default hover:underline cursor-pointer flex items-center gap-1.5 px-3 py-2 text-[1rem] primary-text rounded font-medium"
        >
          {icon}
          {type !== "icons-only" && label}
        </button>
      </TooltipTrigger>
      {title && desc && (
        <TooltipContent
          side="bottom"
          className="bg-[#3A3A3A] flex flex-col items-start gap-1 text-left"
          style={{ borderRadius: "7px" }}
        >
          <div className="font-semibold text-xs text-left w-full">{title}</div>
          <div
            className="text-xs opacity-90 text-left w-full"
            dangerouslySetInnerHTML={{ __html: desc }}
          />
        </TooltipContent>
      )}
    </Tooltip>
  );
}
