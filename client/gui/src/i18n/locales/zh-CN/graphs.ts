import type graphsDict from "../en/graphs";
import type { Localized } from "../localized";

/** 攻击图面板：工具栏、节点菜单、视图控制。 */
const graphs: Localized<typeof graphsDict> = {
  roleServer: "服务器",
  overlay: {
    loading: "加载中...",
    empty: "无内容",
  },
  detail: {
    title: "查看 - {{tag}}",
    fallbackHost: "主机",
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
  toast: {
    fetchFailed: "获取攻击图失败",
    unknownError: "未知错误",
  },
  unknown: "未知",
};

export default graphs;
