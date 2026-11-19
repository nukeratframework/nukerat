import type workspaceDict from "../en/workspace";
import type { Localized } from "../localized";

/** 工作区标签与停靠面板标题。 */
const workspace: Localized<typeof workspaceDict> = {
  tabName: "工作区 {{n}}",
  newSession: "新会话",
  notification: "通知",
  panel: {
    terminal: "终端",
    explorer: "文件浏览器",
    process: "进程",
    screenshot: "截屏",
    keylogger: "键盘记录器",
    credentials: "凭据",
    sessions: "会话",
    graphs: "图谱",
    agent: "AI 智能体",
    fileServer: "文件服务器",
    nukescriptsOutput: "NS 调试器",
    nukescripts: "NukeScripts",
    iocs: "IOC",
    listeners: "监听器",
    network: "网络",
    servers: "服务器",
    implants: "植入体",
    logs: "日志",
    agents: "Agent",
    queue: "队列",
    reports: "报告",
    about: "关于",
    preferences: "偏好设置",
    docs: "文档",
  },
};

export default workspace;
