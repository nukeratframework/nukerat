import type keyloggerDict from "../en/keylogger";
import type { Localized } from "../localized";

/** 键盘记录面板：表格、清除操作。 */
const keylogger: Localized<typeof keyloggerDict> = {
  title: "键盘记录器",
  searchPlaceholder: "搜索...",
  empty: "未找到内容",
  columns: {
    date: "日期",
    server: "服务器",
    hostTag: "主机标记",
    content: "内容",
  },
  actions: {
    view: "查看",
    delete: "删除",
  },
  pagination: "第 {{page}} / {{pageCount}} 页",
  fields: {
    date: "日期",
    server: "服务器",
    hostTag: "主机标记",
    host: "主机",
    content: "内容",
  },
  confirm: {
    title: "删除键盘记录",
    removeAllLead: "移除全部",
    removeAllTailOne: "条记录？此操作无法撤销。",
    removeAllTailMany: "条记录？此操作无法撤销。",
    removeOneLead: "移除该主机的键盘记录",
    removeOneTail: "？此操作无法撤销。",
  },
  hostFilter: {
    label: "主机",
    search: "搜索主机...",
    all: "全部主机",
    empty: "未找到主机。",
    clear: "清除主机筛选",
  },
  toast: {
    noServer: "该记录未关联服务器",
    removeFailedOne: "移除 {{count}} 条记录失败",
    removeFailedMany: "移除 {{count}} 条记录失败",
  },
};

export default keylogger;
