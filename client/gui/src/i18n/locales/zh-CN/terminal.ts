import type terminalDict from "../en/terminal";
import type { Localized } from "../localized";

/** 终端面板：提示符、工具栏、本地命令消息、文件传输。 */
const terminal: Localized<typeof terminalDict> = {
  prompt: {
    implant: "implant >",
    search: "搜索",
    confirm: '执行 "{{command}}"？[Y/n]',
  },
  actions: {
    send: "发送（Enter）",
    clearPrefix: "清除前缀（Esc）",
  },
  messages: {
    sessionChanged: "会话已切换至：{{session}}",
    currentSession: "当前会话：{{session}}",
    terminated: "会话已终止",
    currentPrefix: "当前前缀：{{prefix}}",
    noPrefix: "未设置前缀",
    prefixCleared: "前缀已清除",
    prefixSet: "前缀已设置：{{prefix}}",
  },
  files: {
    readFailed: "读取文件失败",
    downloadCancelled: "下载已取消",
    requestFailed: "请求失败",
    outputDestination: "输出目标：{{path}}",
    downloadSuccess: "文件下载成功",
    downloadSuccessPath: "文件下载成功（{{path}}）",
    decodeError: "文件字节解码错误",
  },
};

export default terminal;
