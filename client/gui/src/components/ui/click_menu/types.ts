import type { RefObject } from "react";
import type { LucideIcon } from "lucide-react";
import type { ShortcutActionId } from "@/components/canva/shortcuts.tsx";
import type { Session } from "@/api/sessions";

export type EditableField = HTMLInputElement | HTMLTextAreaElement;

type PanelCustomMenuItemFields = {
  description?: string;
  icon?: LucideIcon;
  shortcut?: string;
  shortcutId?: ShortcutActionId;
  disabled?: () => boolean;
  onClick?: () => void;
  items?: PanelCustomMenuItem[];
};

export type PanelCustomMenuItem =
  | { kind: "separator" }
  | { kind: "header"; label: string; description?: string }
  | ({ kind: "action"; label: string } & PanelCustomMenuItemFields);

export type PanelEditMenuBridge = {
  resolveEditable: (target: EventTarget | null) => EditableField | null;
  readValue: (el: EditableField) => string;
  writeValue: (el: EditableField, value: string) => void;
  canEdit?: () => boolean;
  resolveStaticTextRegion?: (target: EventTarget | null) => HTMLElement | null;
  prepareMenu?: (target: EventTarget | null) => void;
  getCustomMenuItems?: () => PanelCustomMenuItem[];
  getFooterMenuItems?: () => PanelCustomMenuItem[];
};

export type WorkspacePanelMenuKind =
  | "terminal"
  | "explorer"
  | "process"
  | "agent"
  | "credentials"
  | "fileServer"
  | "keylogger"
  | "graphs"
  | "nsDebugger"
  | "screenshot"
  | "sessions"
  | "emptyWorkspace";

export type TerminalMenuRuntime = {
  inputRef: RefObject<HTMLInputElement | null>;
  getInput: () => string;
  setInput: (value: string) => void;
  canEditInput: () => boolean;
  getOutput: () => unknown[];
  canCopyContext: () => boolean;
  getFontSize: () => number;
  increaseFont: () => void;
  decreaseFont: () => void;
  resetFont: () => void;
  canIncreaseFont: () => boolean;
  canDecreaseFont: () => boolean;
  canResetFont: () => boolean;
};

export type ExplorerMenuRuntime = {
  getPathInput: () => string;
  setPathInput: (value: string) => void;
  controlsDisabled: () => boolean;
  canBack: () => boolean;
  canForward: () => boolean;
  canDownload: () => boolean;
  canCopyContext: () => boolean;
  goBack: () => void;
  goForward: () => void;
  refresh: () => void;
  download: () => void;
  setGridView: () => void;
  setListView: () => void;
  copyContext: () => void;
};

export type ProcessMenuRuntime = {
  getSearch: () => string;
  setSearch: (value: string) => void;
  controlsDisabled: () => boolean;
  canCopyContext: () => boolean;
  refresh: () => void;
  copyContext: () => void;
  setTreeView: () => void;
  setFlatView: () => void;
};

export type AgentMenuRuntime = {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  getInput: () => string;
  setInput: (value: string) => void;
  canEditInput: () => boolean;
  hasHistory: () => boolean;
  copyHistory: () => void;
  clearHistory: () => void;
};

export type CredentialsMenuRuntime = {
  getFieldValue: (key: "name" | "desc" | "content") => string;
  setFieldValue: (key: "name" | "desc" | "content", value: string) => void;
  canEditFields: () => boolean;
  prepareRowFromTarget: (target: EventTarget | null) => void;
  hasRowSelection: () => boolean;
  add: () => void;
  edit: () => void;
  refresh: () => void;
  removeSelected: () => void;
  canRemoveSelected: () => boolean;
  removeAll: () => void;
  canRemoveAll: () => boolean;
};

export type FileServerMenuRuntime = {
  getSearch: () => string;
  setSearch: (value: string) => void;
  controlsDisabled: () => boolean;
  canUpload: () => boolean;
  canUseSelection: () => boolean;
  canCopyLink: () => boolean;
  copyLink: () => void;
  prepareFromTarget: (target: EventTarget | null) => void;
  upload: () => void;
  rename: () => void;
  download: () => void;
  deleteFile: () => void;
  refresh: () => void;
};

export type GraphsMenuRuntime = {
  refresh: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitView: () => void;
};

export type NsDebuggerMenuRuntime = {
  hasOutput: () => boolean;
  refresh: () => void;
  clear: () => void;
  canClear: () => boolean;
};

export type KeyloggerMenuRuntime = {
  getSearch: () => string;
  setSearch: (value: string) => void;
  canUseSelection: () => boolean;
  isDeleting: () => boolean;
  view: () => void;
  refresh: () => void;
  removeSelected: () => void;
  canRemoveSelected: () => boolean;
  removeAll: () => void;
  canRemoveAll: () => boolean;
};

export type ScreenshotMenuRuntime = {
  canSave: () => boolean;
  save: () => void;
};

export type SessionsMenuRuntime = {
  getSearch: () => string;
  setSearch: (value: string) => void;
  getMenuSession: () => Session | null;
  prepareFromTarget: (target: EventTarget | null) => void;
  canCopyContext: () => boolean;
  copyContext: () => void;
  refresh: () => void;
  canRefresh: () => boolean;
  removeSelected: () => void;
  canRemoveSelected: () => boolean;
  removeAll: () => void;
  canRemoveAll: () => boolean;
  openKillConfirm: () => void;
  canKill: () => boolean;
};
