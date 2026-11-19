import type agentsDict from "../en/agents";
import type { Localized } from "../localized";

/** Agents 面板：AI 后端配置（模型、端点、密钥）。 */
const agents: Localized<typeof agentsDict> = {
  empty: "未配置任何 Agent",
  loading: "加载中...",
  cancel: "取消",
  columns: {
    name: "名称",
    tag: "标记",
    type: "类型",
    apiKey: "API 密钥",
    server: "服务器",
  },
  actions: {
    new: "新建",
    edit: "编辑",
    delete: "删除",
    update: "更新",
  },
  form: {
    newTitle: "新建 Agent",
    editTitle: "编辑 - {{name}}",
    name: "名称",
    namePlaceholder: "Agent 名称",
    type: "类型",
    typeCustom: "自定义",
    typeDeepseek: "DeepSeek",
    apiKey: "API 密钥",
    endpoint: "端点",
    requestBody: "请求体",
    clear: "清空",
    format: "格式化",
    invalidJson: "JSON 无效",
    customHeaders: "自定义请求头",
    header: "请求头",
    customCookies: "自定义 Cookie",
    cookie: "Cookie",
    value: "值",
    responseField: "响应字段",
    create: "创建",
    save: "保存",
    cancel: "取消",
  },
  removeConfirm: {
    title: "删除 Agent",
    prefix: "移除 ",
    suffix: "？此操作无法撤销。",
    remove: "删除",
  },
  fields: {
    name: "名称",
    server: "服务器",
    apiKey: "API 密钥",
    endpoint: "端点",
    requestBody: "请求体",
    responseField: "响应字段",
  },
  toast: {
    loadFailed: "加载 Agent 失败",
    required: "必填：{{fields}}",
    createFailed: "创建 Agent 失败",
    created: "Agent 已创建",
    updateFailed: "更新 Agent 失败",
    updated: "Agent 已更新",
    removeFailed: "移除 Agent 失败",
    removed: "Agent 已移除",
  },
};

export default agents;
