import { Edit, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { CredentialsMenuRuntime, PanelEditMenuBridge } from "./types.ts";
import { credKey, html, menuAction } from "./util.ts";
import { translate } from "@/i18n";

export const credentialsMenuRuntimeRef: { current: CredentialsMenuRuntime | null } = { current: null };

function credentialsCanRemoveSelected() {
  return credentialsMenuRuntimeRef.current?.canRemoveSelected() ?? false;
}

function credentialsRemoveSelected() {
  const rt = credentialsMenuRuntimeRef.current;
  if (!rt?.canRemoveSelected()) return;
  rt.removeSelected();
}

function credentialsCanRemoveAll() {
  return credentialsMenuRuntimeRef.current?.canRemoveAll() ?? false;
}

function credentialsRemoveAll() {
  const rt = credentialsMenuRuntimeRef.current;
  if (!rt?.canRemoveAll()) return;
  rt.removeAll();
}

export function createCredentialsBridge(): PanelEditMenuBridge | null {
  const rt = credentialsMenuRuntimeRef.current;
  if (!rt) return null;
  return {
    resolveEditable: (t) => {
      const el = html(t);
      if (!el?.closest("[data-credentials-input]")) return null;
      const f = el.closest("[data-credential-field]");
      return f instanceof HTMLInputElement || f instanceof HTMLTextAreaElement ? f : null;
    },
    readValue: (el) => (credKey(el) ? rt.getFieldValue(credKey(el)!) : el.value),
    writeValue: (el, v) => {
      const k = credKey(el);
      if (k) rt.setFieldValue(k, v);
      else el.value = v;
    },
    canEdit: () => rt.canEditFields(),
    prepareMenu: (t) => rt.prepareRowFromTarget(t),
    getCustomMenuItems: () => [
      menuAction(translate("clickMenu.add"), Plus, () => rt.add()),
      menuAction(translate("clickMenu.edit"), Edit, () => rt.edit(), () => !rt.hasRowSelection()),
      {
        kind: "action",
        label: translate("clickMenu.remove"),
        icon: Trash2,
        disabled: () => !credentialsCanRemoveSelected() && !credentialsCanRemoveAll(),
        items: [
          {
            kind: "action",
            label: translate("clickMenu.selected"),
            onClick: () => credentialsRemoveSelected(),
            disabled: () => !credentialsCanRemoveSelected(),
          },
          {
            kind: "action",
            label: translate("clickMenu.all"),
            onClick: () => credentialsRemoveAll(),
            disabled: () => !credentialsCanRemoveAll(),
          },
        ],
      },
      menuAction(translate("clickMenu.update"), RefreshCw, () => rt.refresh()),
    ],
  };
}
