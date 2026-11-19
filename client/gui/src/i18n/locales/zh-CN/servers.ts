import type serversDict from "../en/servers";
import type { Localized } from "../localized";

/** Servers 面板：服务器列表、认证状态、添加/编辑表单。 */
const servers: Localized<typeof serversDict> = {
  empty: "未配置任何服务器",
  loading: "加载中...",
  columns: {
    status: "状态",
    name: "名称",
    protocol: "协议",
    ip: "IP",
    port: "端口",
  },
  status: {
    idle: "空闲",
    checking: "检查中...",
    online: "在线",
    unauthorized: "未授权",
    offline: "离线",
  },
  actions: {
    add: "添加",
    edit: "编辑",
    remove: "移除",
    update: "更新",
  },
  removeConfirm: {
    title: "移除服务器",
    prefix: "移除 ",
    suffix: "？此操作无法撤销。",
    remove: "移除",
  },
  form: {
    newTitle: "新建服务器",
    editTitle: "编辑 - {{name}}",
    keyLabel: "密钥 (.key)",
    uploadKey: "上传 .key",
    protocol: "协议",
    host: "主机",
    port: "端口",
    clearSession: "清除会话",
    auth: "认证",
  },
  errors: {
    keyEmpty: "密钥为空。",
    protocol: '协议必须为 "http" 或 "https"。',
    host: "主机不能为空且不能包含 '/'。",
    portNumeric: "端口必须为数字。",
    portRange: "端口必须在 1 到 65535 之间。",
    invalidKey: "密钥格式无效",
    keyAlreadyExists: "{{name}}：密钥已存在",
  },
  toast: {
    sessionCleared: "会话已清除",
    clearJwtFailed: "清除 JWT 失败",
    authenticated: "认证成功",
    authFailed: "认证失败",
  },
};

export default servers;
