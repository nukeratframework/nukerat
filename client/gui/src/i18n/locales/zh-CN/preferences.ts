import type preferencesDict from "../en/preferences";
import type { Localized } from "../localized";

/** 偏好设置面板：语言以及后续的应用设置。 */
const preferences: Localized<typeof preferencesDict> = {
  title: "偏好设置",
  language: "语言",
  languageHint: "界面语言，立即生效。",
};

export default preferences;
