import { useEffect } from "react";
import i18n from "@/i18n";

/**
 * Keeps the native Electron dialogs in the same language as the UI.
 *
 * The main process cannot read the renderer's i18n catalog, so the translated
 * copy is pushed over IPC whenever the language changes (and once on mount).
 */
export function useNativeDialogLanguage() {
  useEffect(() => {
    const push = () => {
      window.electronAPI?.send("app:setDialogText", {
        title: i18n.t("dialog.quitConfirmTitle"),
        message: i18n.t("dialog.quitConfirmMessage"),
        quit: i18n.t("dialog.quit"),
        cancel: i18n.t("dialog.cancel"),
      });
    };

    push();
    i18n.on("languageChanged", push);
    return () => i18n.off("languageChanged", push);
  }, []);
}
