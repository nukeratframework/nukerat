import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocale } from "@/i18n/use-locale";

/**
 * App-level preferences. First release only carries the interface language;
 * this is the place to grow further operator settings. The float window chrome
 * in `canva/main.tsx` owns the title bar and close button.
 */
export default function PreferencesPanel() {
  const { t } = useTranslation();
  const { language, setLanguage, locales } = useLocale();

  return (
    <div className="flex flex-col h-full bg-[#171717] text-[#cecece] text-[12px] select-none overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div className="mb-3 min-w-[16rem]">
          <label className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest">
            {t("preferences.language")}
          </label>
          <Select
            value={language}
            onValueChange={setLanguage}
          >
            <SelectTrigger className="w-full bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="text-[13.5px]">
              {locales.map((locale) => (
                <SelectItem key={locale.code} value={locale.code}>
                  {locale.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-2 text-[12px] text-[#5e5d5f]">{t("preferences.languageHint")}</p>
        </div>
      </div>
    </div>
  );
}
