import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DockviewPanelApi } from "dockview";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuItemIcon,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu.tsx";
import { ShortcutHint } from "@/components/canva/shortcuts.tsx";
import { Bot, X } from "lucide-react";
import {
  bridgeFor,
  copyTerminalContext,
  nativeBridge,
  terminalCanCopyContext,
  type EditableField,
  type PanelCustomMenuItem,
  type PanelEditMenuBridge,
  type WorkspacePanelMenuKind,
} from "@/components/ui/click_menu/index.ts";

export type {
  AgentMenuRuntime,
  CredentialsMenuRuntime,
  EditableField,
  ExplorerMenuRuntime,
  FileServerMenuRuntime,
  GraphsMenuRuntime,
  KeyloggerMenuRuntime,
  NsDebuggerMenuRuntime,
  PanelCustomMenuItem,
  PanelEditMenuBridge,
  ProcessMenuRuntime,
  ScreenshotMenuRuntime,
  SessionsMenuRuntime,
  TerminalMenuRuntime,
  WorkspacePanelMenuKind,
} from "@/components/ui/click_menu/index.ts";

export {
  agentMenuRuntimeRef,
  credentialsMenuRuntimeRef,
  explorerMenuRuntimeRef,
  fileServerMenuRuntimeRef,
  graphsMenuRuntimeRef,
  keyloggerMenuRuntimeRef,
  nsDebuggerMenuRuntimeRef,
  processMenuRuntimeRef,
  screenshotMenuRuntimeRef,
  sessionsMenuRuntimeRef,
  terminalMenuRuntimeRef,
  PANEL_MENU_REGISTRY,
} from "@/components/ui/click_menu/index.ts";

const DockviewPanelApiContext = createContext<DockviewPanelApi | null>(null);
const modKey = (k: string) =>
  /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent) ? `⌘${k}` : `Ctrl+${k}`;
const panelMenuItemClass =
  "flex w-full min-w-0 items-center justify-between gap-2 data-disabled:pointer-events-none data-disabled:opacity-50";
const panelMenuLeadingClass = "flex min-w-0 flex-1 items-center gap-2";
const panelMenuContentClass =
  "w-52 min-w-[13rem] [&_[data-slot=context-menu-group]]:w-full [&_[data-slot=context-menu-sub-trigger]]:w-full";

function isPanelCustomMenuAction(
  item: PanelCustomMenuItem,
): item is Extract<PanelCustomMenuItem, { kind: "action" }> {
  return item.kind === "action";
}

type Caps = {
  undo: boolean;
  redo: boolean;
  cut: boolean;
  copy: boolean;
  paste: boolean;
  del: boolean;
  all: boolean;
};

const noCaps: Caps = { undo: false, redo: false, cut: false, copy: false, paste: false, del: false, all: false };

function capsForField(el: EditableField, b: PanelEditMenuBridge): Caps {
  const s = el.selectionEnd! - el.selectionStart!;
  const sel = Math.max(0, s);
  const ok = (b.canEdit?.() ?? true) && !el.disabled && !el.readOnly;
  return {
    undo: ok && document.queryCommandEnabled?.("undo"),
    redo: ok && document.queryCommandEnabled?.("redo"),
    cut: ok && sel > 0,
    copy: sel > 0,
    paste: ok,
    del: ok && sel > 0,
    all: b.readValue(el).length > 0,
  };
}

function capsForDoc(region: HTMLElement): Caps {
  const text = window.getSelection()?.toString() ?? "";
  const hasContent =
    region.querySelector("[data-terminal-line]") !== null || Boolean(region.textContent?.trim());
  return { ...noCaps, copy: text.length > 0, all: hasContent };
}

function selRange(el: EditableField) {
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  return { start, end, len: Math.max(0, end - start) };
}

function CustomMenuItems({ items }: { items: PanelCustomMenuItem[] }) {
  return (
    <>
      {items.map((item, index) => {
        if (item.kind === "separator") {
          return <ContextMenuSeparator key={`sep-${index}`} />;
        }
        if (item.kind === "header") {
          const empty = item.label === "No target";
          return (
            <div
              key={`hdr-${index}`}
              className="px-2.5 pt-2 pb-2.5 -mx-0.5 mb-0.5 border-b border-white/[0.08] select-none pointer-events-none max-w-[14rem]"
            >
              <div
                className={`text-[13px] font-semibold truncate leading-tight ${empty ? "text-[#6f6f6f] font-medium" : "text-[#d4d4d4]"}`}
                title={item.label}
              >
                {item.label}
              </div>
              {item.description ? (
                <div className="text-[11px] text-[#7a7a7a] truncate mt-1 leading-snug" title={item.description}>
                  {item.description}
                </div>
              ) : null}
            </div>
          );
        }
        if (!isPanelCustomMenuAction(item)) return null;
        if (item.items?.length) {
          return (
            <ContextMenuSub key={item.label}>
              <ContextMenuSubTrigger disabled={item.disabled?.()} className={panelMenuItemClass}>
                <span className={panelMenuLeadingClass}>
                  {item.icon ? <ContextMenuItemIcon><item.icon /></ContextMenuItemIcon> : null}
                  {item.label}
                </span>
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className={panelMenuContentClass}>
                <CustomMenuItems items={item.items} />
              </ContextMenuSubContent>
            </ContextMenuSub>
          );
        }
        return (
          <ContextMenuItem key={item.label} className={panelMenuItemClass} disabled={item.disabled?.()} onClick={() => item.onClick?.()}>
            <span className={panelMenuLeadingClass}>
              {item.icon ? <ContextMenuItemIcon><item.icon /></ContextMenuItemIcon> : null}
              {item.label}
            </span>
            {item.shortcutId ? (
              <ShortcutHint id={item.shortcutId} />
            ) : item.shortcut ? (
              <span className="canva-shortcut-hint">{item.shortcut}</span>
            ) : null}
          </ContextMenuItem>
        );
      })}
    </>
  );
}

function Row({
  label,
  hotkey,
  disabled,
  onClick,
}: {
  label: string;
  hotkey?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <ContextMenuItem className={panelMenuItemClass} disabled={disabled} onClick={onClick}>
      <span className={panelMenuLeadingClass}>{label}</span>
      {hotkey ? <span className="canva-shortcut-hint">{hotkey}</span> : null}
    </ContextMenuItem>
  );
}

function PanelEditContextMenu({ kind, children }: { kind: WorkspacePanelMenuKind; children: ReactNode }) {
  const panelApi = useContext(DockviewPanelApiContext);
  const targetRef = useRef<EventTarget | null>(null);
  const fieldRef = useRef<EditableField | null>(null);
  const docRef = useRef<HTMLElement | null>(null);
  const bridgeRef = useRef<PanelEditMenuBridge>(nativeBridge);
  const [caps, setCaps] = useState<Caps>(noCaps);
  const [showEdit, setShowEdit] = useState(false);
  const [docMode, setDocMode] = useState(false);
  const [customItems, setCustomItems] = useState<PanelCustomMenuItem[]>([]);
  const [footerItems, setFooterItems] = useState<PanelCustomMenuItem[]>([]);
  const [showTerminalOutputActions, setShowTerminalOutputActions] = useState(false);

  const refresh = (target: EventTarget | null) => {
    targetRef.current = target;
    const bridge = bridgeFor(kind);
    bridgeRef.current = bridge;
    bridge.prepareMenu?.(target);
    const field = bridge.resolveEditable(target);
    fieldRef.current = field;
    const doc = field ? null : bridge.resolveStaticTextRegion?.(target) ?? null;
    setCustomItems(bridge.getCustomMenuItems?.() ?? []);
    setFooterItems(bridge.getFooterMenuItems?.() ?? []);
    docRef.current = doc;
    if (field) {
      setDocMode(false);
      setShowEdit(true);
      setCaps(capsForField(field, bridge));
      setShowTerminalOutputActions(false);
    } else if (doc) {
      setDocMode(true);
      setShowEdit(true);
      setCaps(capsForDoc(doc));
      setShowTerminalOutputActions(kind === "terminal");
    } else {
      setDocMode(false);
      setShowEdit(false);
      setCaps(noCaps);
      setShowTerminalOutputActions(false);
    }
  };

  const field = () => fieldRef.current ?? bridgeRef.current.resolveEditable(targetRef.current);

  const runCopy = async () => {
    if (docRef.current) {
      const t = window.getSelection()?.toString();
      if (t) await navigator.clipboard.writeText(t);
      return;
    }
    const el = field();
    if (!el) return;
    const { start, end, len } = selRange(el);
    if (len) await navigator.clipboard.writeText(bridgeRef.current.readValue(el).slice(start, end));
  };

  const runCut = async () => {
    const b = bridgeRef.current;
    const el = field();
    if (!el) return;
    const val = b.readValue(el);
    const { start, end, len } = selRange(el);
    if (!len) return;
    await navigator.clipboard.writeText(val.slice(start, end));
    b.writeValue(el, val.slice(0, start) + val.slice(end));
    requestAnimationFrame(() => el.setSelectionRange(start, start));
  };

  const runPaste = async () => {
    const b = bridgeRef.current;
    const el = field();
    if (!el) return;
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return;
    }
    const val = b.readValue(el);
    const { start, end } = selRange(el);
    b.writeValue(el, val.slice(0, start) + text + val.slice(end));
    const c = start + text.length;
    requestAnimationFrame(() => el.setSelectionRange(c, c));
  };

  const runDelete = () => {
    const b = bridgeRef.current;
    const el = field();
    if (!el) return;
    const val = b.readValue(el);
    const { start, end, len } = selRange(el);
    if (!len) return;
    b.writeValue(el, val.slice(0, start) + val.slice(end));
    requestAnimationFrame(() => el.setSelectionRange(start, start));
  };

  const runSelectAll = () => {
    const doc = docRef.current;
    if (doc) {
      const lines = doc.querySelectorAll("[data-terminal-line]");
      const range = document.createRange();
      if (lines.length) {
        range.setStartBefore(lines[0]);
        range.setEndAfter(lines[lines.length - 1]);
      } else if (doc.textContent?.trim()) {
        range.selectNodeContents(doc);
      } else return;
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      return;
    }
    const el = field();
    if (!el) return;
    const val = bridgeRef.current.readValue(el);
    if (!val.length) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(0, val.length);
  };

  const runUndo = () => {
    const el = field();
    if (!el) return;
    el.focus();
    document.execCommand("undo");
    bridgeRef.current.writeValue(el, el.value);
  };

  const runRedo = () => {
    const el = field();
    if (!el) return;
    el.focus();
    document.execCommand("redo");
    bridgeRef.current.writeValue(el, el.value);
  };

  const showPanelActions = !showEdit && (customItems.length > 0 || footerItems.length > 0);
  const showFooterItems = footerItems.length > 0 && (!showEdit || kind === "terminal");
  const showClose =
    Boolean(panelApi) &&
    (showPanelActions || showTerminalOutputActions || showFooterItems || !showEdit);
  const hasMenuBody =
    (showEdit && docMode) ||
    (showEdit && !docMode) ||
    showTerminalOutputActions ||
    showFooterItems ||
    (showPanelActions && customItems.length > 0);
  const hasMenuBodyAboveFooter =
    (showEdit && docMode) ||
    (showEdit && !docMode) ||
    showTerminalOutputActions ||
    (showPanelActions && customItems.length > 0);

  return (
    <ContextMenu onOpenChange={(open) => open && refresh(targetRef.current)}>
      <ContextMenuTrigger className="block h-full w-full" onContextMenu={(e) => refresh(e.target)}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className={panelMenuContentClass}>
        {showEdit && docMode && (
          <ContextMenuGroup>
            <Row label="Copy" hotkey={modKey("C")} disabled={!caps.copy} onClick={() => void runCopy()} />
            <Row label="Select All" hotkey={modKey("A")} disabled={!caps.all} onClick={runSelectAll} />
          </ContextMenuGroup>
        )}
        {showTerminalOutputActions && (
          <>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <ContextMenuItem
                className={panelMenuItemClass}
                disabled={!terminalCanCopyContext()}
                onClick={() => copyTerminalContext()}
              >
                <span className={panelMenuLeadingClass}>
                  <ContextMenuItemIcon>
                    <Bot />
                  </ContextMenuItemIcon>
                  Copy context
                </span>
              </ContextMenuItem>
            </ContextMenuGroup>
          </>
        )}
        {showEdit && !docMode && (
          <>
            <ContextMenuGroup>
              <Row label="Undo" hotkey={modKey("Z")} disabled={!caps.undo} onClick={runUndo} />
              <Row label="Redo" hotkey={modKey("Y")} disabled={!caps.redo} onClick={runRedo} />
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <Row label="Cut" hotkey={modKey("X")} disabled={!caps.cut} onClick={() => void runCut()} />
              <Row label="Copy" hotkey={modKey("C")} disabled={!caps.copy} onClick={() => void runCopy()} />
              <Row label="Paste" hotkey={modKey("V")} disabled={!caps.paste} onClick={() => void runPaste()} />
              <Row label="Delete" disabled={!caps.del} onClick={runDelete} />
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <Row label="Select All" hotkey={modKey("A")} disabled={!caps.all} onClick={runSelectAll} />
            </ContextMenuGroup>
          </>
        )}
        {showPanelActions && customItems.length > 0 && (
          <ContextMenuGroup>
            <CustomMenuItems items={customItems} />
          </ContextMenuGroup>
        )}
        {showFooterItems && (
          <>
            {hasMenuBodyAboveFooter && <ContextMenuSeparator />}
            <ContextMenuGroup>
              <CustomMenuItems items={footerItems} />
            </ContextMenuGroup>
          </>
        )}
        {showClose && (
          <>
            {hasMenuBody && <ContextMenuSeparator />}
            <ContextMenuGroup>
              <ContextMenuItem className={panelMenuItemClass} onClick={() => panelApi!.close()}>
                <span className={panelMenuLeadingClass}>
                  <ContextMenuItemIcon>
                    <X />
                  </ContextMenuItemIcon>
                  Close tab
                </span>
              </ContextMenuItem>
            </ContextMenuGroup>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function PanelDockviewShell({
  api,
  kind,
  children,
}: {
  api: DockviewPanelApi;
  kind: WorkspacePanelMenuKind;
  children: ReactNode;
}) {
  return (
    <PanelMenuShell kind={kind} onClose={() => api.close()}>
      {children}
    </PanelMenuShell>
  );
}

export function PanelMenuShell({
  kind,
  onClose,
  children,
}: {
  kind: WorkspacePanelMenuKind;
  onClose?: () => void;
  children: ReactNode;
}) {
  const api = onClose ? ({ close: onClose } as DockviewPanelApi) : null;
  return (
    <DockviewPanelApiContext.Provider value={api}>
      <PanelEditContextMenu kind={kind}>{children}</PanelEditContextMenu>
    </DockviewPanelApiContext.Provider>
  );
}
