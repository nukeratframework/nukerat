import type dialogDict from "../en/dialog";
import type { Localized } from "../localized";

/** 原生（Electron 主进程）对话框。 */
const dialog: Localized<typeof dialogDict> = {
  quitConfirmTitle: "确认退出",
  quitConfirmMessage: "当前存在活动会话，确定要退出吗？",
  quit: "退出",
  cancel: "取消",
};

export default dialog;
