import type nukescriptsDict from "../en/nukescripts";
import type { Localized } from "../localized";

/** NukeScripts 面板：脚本列表、编辑器、运行操作。 */
const nukescripts: Localized<typeof nukescriptsDict> = {
  empty: "未配置任何脚本",
  loading: "加载中...",
  columns: {
    status: "状态",
    name: "名称",
    server: "服务器",
    description: "描述",
    errors: "错误",
    lastRun: "上次运行",
    created: "创建时间",
  },
  actions: {
    add: "添加",
    edit: "编辑",
    enable: "启用",
    disable: "停用",
    remove: "移除",
    update: "更新",
  },
  removeConfirm: {
    title: "移除脚本",
    prefix: "移除 ",
    suffix: "？此操作无法撤销。",
    remove: "移除",
  },
  form: {
    newTitle: "新建脚本",
    editTitle: "编辑 - {{name}}",
    name: "名称",
    description: "描述",
    nukescript: "NukeScript",
    upload: "上传",
    format: "格式化",
    cancel: "取消",
    add: "添加",
    save: "保存",
  },
  errorBar: {
    exception: "异常",
  },
  toast: {
    requestFailed: "请求失败",
    createFailed: "创建脚本失败",
    created: "脚本已创建",
    updateFailed: "更新脚本失败",
    updated: "脚本已更新",
    removeFailed: "移除脚本失败",
    removed: "脚本已移除",
    statusUpdateFailed: "更新脚本状态失败",
  },
};

export default nukescripts;
