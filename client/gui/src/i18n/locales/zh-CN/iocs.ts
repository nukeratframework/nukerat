import type iocsDict from "../en/iocs";
import type { Localized } from "../localized";

/** IOC 面板：表格、添加表单、操作。 */
const iocs: Localized<typeof iocsDict> = {
  empty: "未找到内容",
  loading: "加载中...",
  columns: {
    host: "主机",
    type: "类型",
    value: "值",
    date: "日期",
    server: "服务器",
  },
  searchTitle: "搜索",
  searchPlaceholder: "搜索...",
  page: "第 {{page}} / {{count}} 页",
  actions: {
    view: "查看",
    remove: "移除",
    update: "更新",
  },
  hostFilter: {
    placeholder: "主机",
    searchPlaceholder: "搜索主机...",
    empty: "未找到主机。",
  },
  split: {
    title: "IOC",
    date: "日期",
    server: "服务器",
    tag: "标记",
    host: "主机",
    type: "类型",
    value: "值",
  },
  removeConfirm: {
    title: "移除 IOC",
    prefix: "移除 ",
    suffix: "？此操作无法撤销。",
    remove: "移除",
  },
  toast: {
    noServer: "此条目未关联任何服务器",
  },
};

export default iocs;
