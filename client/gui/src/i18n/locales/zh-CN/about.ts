import type aboutDict from "../en/about";
import type { Localized } from "../localized";

/** 关于面板：版本信息标签。 */
const about: Localized<typeof aboutDict> = {
  title: "NukeRat 框架",
  version: "版本",
  platform: "平台",
  electron: "Electron",
  chromium: "Chromium",
  node: "Node",
  author: "作者",
};

export default about;
