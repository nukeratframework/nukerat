import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";
import zhCN from "./locales/zh-CN";

export type LocaleCode = "en" | "zh-CN";

export const SUPPORTED_LOCALES: { code: LocaleCode; label: string }[] = [
  // Labels are written in their own language so an operator who cannot read the
  // current interface language can still find their way back.
  { code: "en", label: "English" },
  { code: "zh-CN", label: "简体中文" },
];

const isSupported = (value: unknown): value is LocaleCode =>
  typeof value === "string" && SUPPORTED_LOCALES.some((l) => l.code === value);

/** Map anything env-provided (`zh-TW`, `zh`, `en-US`, …) onto a shipped locale. */
export function normalizeLocale(value?: string | null): LocaleCode {
  if (!value) return "en";
  if (isSupported(value)) return value;
  return value.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

/**
 * First-run default: follow the OS UI language instead of hardcoding English.
 * Unsupported tags (`zh-TW`, `en-US`, …) collapse onto a shipped catalog.
 */
export function detectLocale(): LocaleCode {
  if (typeof navigator === "undefined") return "en";
  return normalizeLocale(navigator.language || navigator.languages?.[0] || "en");
}

function syncDocumentLang(language: string) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
}

let initialized = false;

/** Must resolve before the first render, otherwise the UI flashes English. */
export async function initI18n(language?: string): Promise<void> {
  const lng = normalizeLocale(language ?? detectLocale());

  if (initialized) {
    if (lng !== i18n.language) await i18n.changeLanguage(lng);
  } else {
    await i18n.use(initReactI18next).init({
      resources: {
        en: { translation: en },
        "zh-CN": { translation: zhCN },
      },
      lng,
      fallbackLng: "en",
      supportedLngs: SUPPORTED_LOCALES.map((l) => l.code),
      interpolation: { escapeValue: false },
      returnNull: false,
    });
    initialized = true;
  }

  syncDocumentLang(lng);
}

export async function changeLanguage(code: LocaleCode): Promise<void> {
  const lng = normalizeLocale(code);
  if (lng === i18n.language) return;
  await i18n.changeLanguage(lng);
  syncDocumentLang(lng);
}

/**
 * Non-component accessor for logic modules (`api/*`, toast helpers, menus).
 * Deliberately loose: those call sites build keys dynamically, which the
 * strictly-keyed `TFunction` from `useTranslation()` cannot express. This is
 * the one place the cast to a loose signature is allowed; components keep the
 * checked `t()`.
 */
export type LooseT = (key: string, options?: Record<string, unknown>) => string;

export const translate: LooseT = (key, options) =>
  (i18n.t as unknown as LooseT)(key, options);

export default i18n;
