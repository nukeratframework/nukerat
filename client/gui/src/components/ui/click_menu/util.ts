import type { LucideIcon } from "lucide-react";
import type { EditableField, PanelCustomMenuItem, PanelEditMenuBridge } from "./types.ts";

export const html = (t: EventTarget | null) => (t instanceof HTMLElement ? t : null);

export const pathInput = (t: EventTarget | null, scope: string, field: string) => {
  const el = html(t);
  if (!el?.closest(scope)) return null;
  const f = el.closest(field);
  return f instanceof HTMLInputElement ? f : null;
};

export const credKey = (el: EditableField) => {
  const k = el.getAttribute("data-credential-field");
  return k === "name" || k === "desc" || k === "content" ? k : null;
};

export const menuAction = (
  label: string,
  icon: LucideIcon,
  onClick: () => void,
  disabled?: () => boolean,
): PanelCustomMenuItem => ({
  kind: "action",
  label,
  icon,
  onClick,
  disabled,
});

export const inputWriteValue = (el: EditableField, value: string) => {
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

export const nativeBridge: PanelEditMenuBridge = {
  resolveEditable: (target) => {
    const el = target instanceof HTMLElement ? target : null;
    const c = el?.closest("input, textarea");
    if (c instanceof HTMLTextAreaElement) return c;
    if (
      c instanceof HTMLInputElement &&
      !/^(hidden|file|checkbox|radio|button|submit|reset|image|range|color)$/.test(c.type)
    ) {
      return c;
    }
    return null;
  },
  readValue: (el) => el.value,
  writeValue: inputWriteValue,
};

export const readOnlyInputBridge = (): Pick<PanelEditMenuBridge, "resolveEditable" | "readValue" | "writeValue"> => ({
  resolveEditable: () => null,
  readValue: (el) => el.value,
  writeValue: inputWriteValue,
});
