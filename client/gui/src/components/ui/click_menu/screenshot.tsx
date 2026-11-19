import { Download } from "lucide-react";
import type { PanelEditMenuBridge, ScreenshotMenuRuntime } from "./types.ts";
import { menuAction, readOnlyInputBridge } from "./util.ts";
import { translate } from "@/i18n";

export const screenshotMenuRuntimeRef: { current: ScreenshotMenuRuntime | null } = { current: null };

function screenshotCanSave() {
  return screenshotMenuRuntimeRef.current?.canSave() ?? false;
}

function screenshotSave() {
  const rt = screenshotMenuRuntimeRef.current;
  if (!rt?.canSave()) return;
  rt.save();
}

export function createScreenshotBridge(): PanelEditMenuBridge {
  return {
    ...readOnlyInputBridge(),
    getFooterMenuItems: () => [
      menuAction(translate("clickMenu.save"), Download, () => screenshotSave(), () => !screenshotCanSave()),
    ],
  };
}
