import type queueDict from "../en/queue";
import type { Localized } from "../localized";

/** Queue 面板：任务表格与操作。 */
const queue: Localized<typeof queueDict> = {
  empty: "未找到内容",
  loading: "加载中...",
  columns: {
    host: "主机",
    type: "类型",
    input: "输入",
    date: "日期",
    completed: "已完成",
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
    title: "队列",
    time: "时间",
    server: "服务器",
    host: "主机",
    tag: "标记",
    type: "类型",
    completed: "已完成",
    captured: "已捕获",
    input: "输入",
    parameters: "参数",
    output: "输出",
    error: "错误",
  },
  removeConfirm: {
    title: "移除队列项",
    prefix: "移除 ",
    suffix: "？此操作无法撤销。",
    remove: "移除",
  },
  toast: {
    noServer: "此条目未关联任何服务器",
  },
};

export default queue;
