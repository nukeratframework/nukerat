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
  Languages,
  Settings,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { workspaceTabLabel, type WorkspaceTab } from "../logic";
import { translate } from "@/i18n";
import { useLocale } from "@/i18n/use-locale";
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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

/**
 * Per-host panels offered in the session right-click menu. Labels are i18n keys
 * so the caller decides when to resolve them (menus build at open time).
 */
export const hostOpenPanels: { type: string; icon: LucideIcon; labelKey: string }[] = [
  { type: "terminal", icon: SquareChevronRight, labelKey: "shell.terminal" },
  { type: "explorer", icon: Folder, labelKey: "shell.fileBrowser" },
  { type: "process", icon: Cpu, labelKey: "shell.processes" },
  { type: "screenshot", icon: Camera, labelKey: "shell.screenshot" },
];

interface MainProps {
  openWindow: (window: string) => void;
  floatWindow: (window: string) => void;
  workspaceTabs: WorkspaceTab[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  onTabAdd: () => void;
  onTabClose: (id: string) => void;
  onTabRename: (id: string, name: string | null) => void;
}

const WORKSPACE_TAB_NAME_MAX_LEN = 30;

export default function TopBar(props: MainProps) {
  const { t } = useTranslation();
  const { language, setLanguage, locales } = useLocale();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const commitTabRename = (tab: WorkspaceTab) => {
    const raw = renameDraft.trim();
    // An unchanged/blank draft clears the override so the tab follows the UI
    // language again instead of freezing the old wording.
    const current = workspaceTabLabel(tab, translate);
    const next = !raw || raw === current ? null : raw.slice(0, WORKSPACE_TAB_NAME_MAX_LEN);
    props.onTabRename(tab.id, next);
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

        <TopBarMenu menuId="nukerat" label={t("shell.menu.nukerat")} openMenu={openMenu} setOpenMenu={setOpenMenu}>
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.floatWindow("servers")}
            >
              <span className="flex items-center gap-2">
                <Server size={13} />
                {t("shell.servers")}
              </span>
              <ShortcutHint id="servers" />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.floatWindow("listeners")}
            >
              <span className="flex items-center gap-2">
                <Headphones size={14} />
                {t("shell.listeners")}
              </span>
              <ShortcutHint id="listeners" />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.floatWindow("implants")}
            >
              <span className="flex items-center gap-2">
                <Bug size={13} />
                {t("shell.implants")}
              </span>
              <ShortcutHint id="implants" />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.floatWindow("network")}
            >
              <span className="flex items-center gap-2">
                <Network size={13} />
                {t("shell.network")}
              </span>
              <ShortcutHint id="network" />
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => props.floatWindow("agents")}>
              <Bot size={13} />
              {t("shell.agents")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => props.floatWindow("nukescripts")}>
              <CodeXmlIcon size={13} />
              {t("shell.nukescripts")}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => props.floatWindow("reports")}>
              <HiOutlineDocumentReport size={13} />
              {t("shell.reports")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => props.floatWindow("iocs")}>
              <Fingerprint size={13} />
              {t("shell.iocs")}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.floatWindow("queue")}
            >
              <span className="flex items-center gap-2">
                <Logs size={13} />
                {t("shell.queue")}
              </span>
              <ShortcutHint id="queue" />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.floatWindow("logs")}
            >
              <span className="flex items-center gap-2">
                <FileText size={13} />
                {t("shell.eventLog")}
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
                {t("shell.quit")}
              </span>
              <ShortcutHint id="quit" />
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </TopBarMenu>

        <TopBarMenu menuId="view" label={t("shell.menu.view")} openMenu={openMenu} setOpenMenu={setOpenMenu}>
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => window.electronAPI?.send("window:toggleFullscreen")}
            >
              <span className="flex items-center gap-2">
                <Fullscreen size={13} />
                {t("shell.fullScreen")}
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
                {t("shell.zoomIn")}
              </span>
              <ShortcutHint id="view_zoom_in" />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => window.electronAPI?.send("window:zoomOut")}
            >
              <span className="flex items-center gap-2">
                <ZoomOut size={13} />
                {t("shell.zoomOut")}
              </span>
              <ShortcutHint id="view_zoom_out" />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => window.electronAPI?.send("window:resetZoom")}
            >
              <span className="flex items-center gap-2">
                <RotateCcw size={13} />
                {t("shell.resetZoom")}
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
                {t("shell.devtools")}
              </span>
              <ShortcutHint id="view_devtools" />
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex w-full items-center gap-2">
                <Languages size={13} />
                {t("shell.language")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={language}
                  onValueChange={setLanguage}
                >
                  {locales.map((locale) => (
                    <DropdownMenuRadioItem key={locale.code} value={locale.code}>
                      {locale.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuItem onClick={() => props.floatWindow("preferences")}>
              <Settings size={13} />
              {t("shell.preferences")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </TopBarMenu>

        <TopBarMenu menuId="tabs" label={t("shell.menu.tabs")} openMenu={openMenu} setOpenMenu={setOpenMenu}>
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.openWindow("terminal")}
            >
              <span className="flex items-center gap-2">
                <SquareChevronRight size={13} />
                {t("shell.terminal")}
              </span>
              <ShortcutHint id="terminal" />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.openWindow("explorer")}
            >
              <span className="flex items-center gap-2">
                <Folder size={13} />
                {t("shell.fileBrowser")}
              </span>
              <ShortcutHint id="explorer" />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.openWindow("process")}
            >
              <span className="flex items-center gap-2">
                <Cpu size={13} />
                {t("shell.processes")}
              </span>
              <ShortcutHint id="process" />
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => props.openWindow("screenshot")}>
              <Camera size={13} />
              {t("shell.screenshot")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => props.openWindow("keylogger")}>
              <Keyboard size={13} />
              {t("shell.keystrokes")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.openWindow("credentials")}
            >
              <span className="flex items-center gap-2">
                <KeyRound size={13} />
                {t("shell.credentials")}
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
                {t("shell.sessions")}
              </span>
              <ShortcutHint id="sessions" />
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => props.openWindow("graphs")}>
              <Share2 size={13} />
              {t("shell.attackGraph")}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() => props.openWindow("agent")}
            >
              <span className="flex items-center gap-2">
                <Bot size={13} />
                {t("shell.aiAgent")}
              </span>
              <ShortcutHint id="agent" />
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => props.openWindow("fileServer")}>
              <Globe size={13} />
              {t("shell.fileServer")}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => props.openWindow("nukescripts_output")}>
              <LuSquareCode size={13} />
              {t("shell.nsDebugger")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </TopBarMenu>

        <TopBarMenu menuId="help" label={t("shell.menu.help")} openMenu={openMenu} setOpenMenu={setOpenMenu}>
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="flex w-full items-center justify-between gap-2"
              onClick={() =>
                window.open("https://nukerat.com/docs", "_blank")
              }
            >
              <span className="flex items-center gap-2">
                <GrHelpBook size={13} />
                {t("shell.docs")}
              </span>
              <ShortcutHint id="docs" />
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                window.open("https://nukerat.com/docs/shortcuts", "_blank")
              }
            >
              <Command size={13} />
              {t("shell.shortcuts")}
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
              {t("shell.feedbacks")}
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
              {t("shell.license")}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => props.floatWindow("about")}>
              <Info size={10} />
              {t("shell.about")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </TopBarMenu>

        <div className="w-px h-4 bg-[#292929] mr-4 ml-4 shrink-0" />

        <NavItem
          onClick={() => props.openWindow("terminal")}
          type="icons-only"
          icon={<SquareChevronRight size={18.5} />}
          label={t("shell.terminal")}
          title={t("shell.terminal")}
          desc={t("shell.hints.terminal")}
          shortcutId="terminal"
        />
        <NavItem
          onClick={() => props.openWindow("explorer")}
          type="icons-only"
          icon={<Folder size={18.5} />}
          label={t("shell.fileBrowser")}
          title={t("shell.fileBrowser")}
          desc={t("shell.hints.explorer")}
          shortcutId="explorer"
        />
        <NavItem
          onClick={() => props.openWindow("process")}
          type="icons-only"
          icon={<Cpu size={18.5} />}
          label={t("shell.processes")}
          title={t("shell.processes")}
          desc={t("shell.hints.process")}
          shortcutId="process"
        />

        <div className="w-px h-4 bg-[#292929] mr-4 ml-4 shrink-0" />

        <NavItem
          onClick={() => props.openWindow("screenshot")}
          type="icons-only"
          icon={<Camera size={20} />}
          label={t("shell.screenshot")}
          title={t("shell.screenshot")}
          desc={t("shell.hints.screenshot")}
        />
        <NavItem
          onClick={() => props.openWindow("keylogger")}
          type="icons-only"
          icon={<Keyboard size={18.5} />}
          label={t("shell.keylogger")}
          title={t("shell.keylogger")}
          desc={t("shell.hints.keylogger")}
        />
        <NavItem
          onClick={() => props.openWindow("credentials")}
          type="icons-only"
          icon={<KeyRound size={18.5} />}
          label={t("shell.credentials")}
          title={t("shell.credentials")}
          desc={t("shell.hints.credentials")}
          shortcutId="credentials"
        />

        <div className="w-px h-4 bg-[#292929] mr-4 ml-4 shrink-0" />

        <NavItem
          onClick={() => props.openWindow("sessions")}
          type="icons-only"
          icon={<MonitorIcon size={18.5} />}
          label={t("shell.sessions")}
          title={t("shell.sessions")}
          desc={t("shell.hints.sessions")}
          shortcutId="sessions"
        />
        <NavItem
          onClick={() => props.openWindow("graphs")}
          type="icons-only"
          icon={<Share2 size={18.5} />}
          label={t("shell.attackGraph")}
          title={t("shell.attackGraph")}
          desc={t("shell.hints.graphs")}
        />

        <div className="w-px h-4 bg-[#292929] mr-4 ml-4 shrink-0" />

        <NavItem
          onClick={() => props.openWindow("agent")}
          type="icons-only"
          icon={<Bot size={22} />}
          label={t("shell.aiAgent")}
          title={t("shell.aiAgent")}
          desc={t("shell.hints.agent")}
          shortcutId="agent"
        />
        <NavItem
          onClick={() => props.openWindow("fileServer")}
          type="icons-only"
          icon={<Globe size={18.5} />}
          label={t("shell.fileServer")}
          title={t("shell.fileServer")}
          desc={t("shell.hints.fileServer")}
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
                  onBlur={() => commitTabRename(tab)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitTabRename(tab);
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
                    setRenameDraft(
                      workspaceTabLabel(tab, translate).slice(
                        0,
                        WORKSPACE_TAB_NAME_MAX_LEN,
                      ),
                    );
                  }}
                >
                  {workspaceTabLabel(tab, translate)}
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
          title={t("shell.newWorkspace")}
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
  menuId,
  label,
  children,
  openMenu,
  setOpenMenu,
}: {
  menuId: string;
  label: string;
  children: React.ReactNode;
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
}) {
  return (
    <DropdownMenu
      open={openMenu === menuId}
      onOpenChange={(open) => setOpenMenu(open ? menuId : null)}
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
          <div className="text-xs opacity-90 text-left w-full">{desc}</div>
        </TooltipContent>
      )}
    </Tooltip>
  );
}
