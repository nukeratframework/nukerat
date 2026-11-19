import type screenshotDict from "../en/screenshot";
import type { Localized } from "../localized";

/** 截图面板：截取控制与空状态。 */
const screenshot: Localized<typeof screenshotDict> = {
  empty: "没有可显示的截图",
  toast: {
    failed: "截图失败",
    unknownError: "未知错误",
  },
};

export default screenshot;
