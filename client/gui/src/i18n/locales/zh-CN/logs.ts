import type logsDict from "../en/logs";
import type { Localized } from "../localized";

/** 事件日志面板：日志表格与筛选器。 */
const logs: Localized<typeof logsDict> = {
  columns: {
    date: "日期",
    type: "类型",
    category: "类别",
    message: "消息",
  },
  categories: {
    listeners: "监听器",
    launcher: "启动器",
    server: "服务器",
  },
  loading: "加载中...",
  cancel: "取消",
  selectServer: "选择服务器以查看日志",
  empty: "没有日志条目",
  resetFilters: "重置筛选",
  actions: {
    view: "查看",
    update: "更新",
  },
  page: "第 {{page}} / {{count}} 页",
  filters: {
    serverPlaceholder: "服务器",
    searchPlaceholder: "搜索日志...",
    all: "全部",
    entryCountOne: "{{count}} 条",
    entryCountMany: "{{count}} 条",
  },
  split: {
    title: "日志",
    message: "消息",
  },
};

export default logs;
