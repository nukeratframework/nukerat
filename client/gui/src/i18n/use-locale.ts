import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { saveLanguage } from "@/api/system/config";
import {
  SUPPORTED_LOCALES,
  changeLanguage,
  normalizeLocale,
} from "./index";

/**
 * Read/switch the interface language. Switching applies immediately and
 * persists to `config.json`, so the choice survives a restart.
 */
export function useLocale() {
  const { i18n } = useTranslation();
  const language = normalizeLocale(i18n.language);

  // Callers hand over raw UI values; `normalizeLocale` guarantees the stored
  // language is one of the shipped catalogs.
  const setLanguage = useCallback((code: string) => {
    const next = normalizeLocale(code);
    void changeLanguage(next);
    void saveLanguage(next).catch(() => {
      // Persisting is best-effort: the UI already switched for this session.
    });
  }, []);

  return { language, setLanguage, locales: SUPPORTED_LOCALES };
}
