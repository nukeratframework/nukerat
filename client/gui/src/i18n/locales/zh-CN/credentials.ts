import type credentialsDict from "../en/credentials";
import type { Localized } from "../localized";

/** 凭据面板：表格、表单、确认框。 */
const credentials: Localized<typeof credentialsDict> = {
  empty: "未找到内容",
  columns: {
    name: "名称",
    server: "服务器",
    hostTag: "主机标记",
    desc: "描述",
  },
  actions: {
    update: "更新",
  },
  confirm: {
    removeTitle: "移除凭据",
    removeAllLead: "移除全部",
    removeAllTailOne: "条凭据？此操作无法撤销。",
    removeAllTailMany: "条凭据？此操作无法撤销。",
    removeLead: "移除",
    removeTail: "？此操作无法撤销。",
  },
  form: {
    newTitle: "新建凭据",
    editPrefix: "编辑",
    viewPrefix: "查看",
    fallbackName: "凭据",
    host: "主机",
    name: "名称",
    namePlaceholder: "凭据名称",
    description: "描述",
    optional: "可选",
    credentials: "凭据",
    credentialsPlaceholder: "用户名:密码",
    selectServerFirst: "请先选择服务器...",
    loadingHosts: "正在加载主机...",
    selectHost: "选择主机...",
  },
  toast: {
    loadFailed: "加载凭据失败",
    createFailed: "创建凭据失败",
    updateFailed: "更新凭据失败",
    created: "凭据已创建",
    updated: "凭据已更新",
    removeFailed: "移除凭据失败",
    removed: "凭据已移除",
    removeAllFailed: "移除凭据失败",
    removeManyFailedOne: "移除 {{count}} 条凭据失败",
    removeManyFailed: "移除 {{count}} 条凭据失败",
    removedMany: "凭据已移除",
  },
};

export default credentials;
