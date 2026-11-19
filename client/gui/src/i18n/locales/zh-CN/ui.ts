import type uiDict from "../en/ui";
import type { Localized } from "../localized";

/** 共享 UI 基础组件：对话框、选择器、命令面板。 */
const ui: Localized<typeof uiDict> = {
  close: "关闭",
  commandPalette: {
    title: "命令面板",
    description: "搜索要运行的命令...",
  },
  keyValue: {
    addRow: "添加行",
    key: "键",
    value: "值",
    remove: "移除",
    removeRow: "移除第 {{index}} 行",
    empty: "空",
  },
  calendar: {
    startTime: "开始时间",
    endTime: "结束时间",
    date: "日期",
  },
};

export default ui;
