import type sessionsDict from "../en/sessions";
import type { Localized } from "../localized";

/** 会话面板：表格、右键菜单、确认框。 */
const sessions: Localized<typeof sessionsDict> = {
  killSession: "结束会话",
  deleteSession: "删除会话",
  removeAll: "移除全部会话？",
  untagged: "未标记",
  searchPlaceholder: "搜索会话",
  empty: "未找到会话",
  columns: {
    platform: "平台",
    lastCheck: "最后检测",
    tag: "标记",
    hostname: "主机名",
    user: "用户",
    privilege: "权限",
    internal: "内网",
    external: "外网",
    listener: "监听器",
    pid: "PID",
    process: "进程",
    note: "备注",
  },
  view: {
    title: "查看 - {{tag}}",
    fallbackTag: "会话",
    note: "备注",
    fields: {
      lastCheck: "最后检测",
      tag: "标记",
      hostname: "主机名",
      user: "用户",
      privilege: "权限",
      internal: "内网",
      external: "外网",
      listener: "监听器",
      hostServer: "主机服务器",
      hostPort: "主机端口",
      arch: "架构",
      pid: "PID",
      process: "进程",
      os: "操作系统",
      firstSeen: "首次发现",
      lastSeen: "最后发现",
      delay: "延迟",
      server: "服务器",
      implantConfig: "植入体配置",
    },
  },
  toast: {
    fetchFailed: "获取会话失败",
    removeFailed: "移除会话失败",
    saveFailed: "保存失败",
    noteSaved: "备注已保存",
    contextCopied: "已复制会话上下文",
  },
};

export default sessions;
