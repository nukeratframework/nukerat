import type agentDict from "../en/agent";
import type { Localized } from "../localized";

/** AI 智能体面板：对话、设置抽屉、模型选择。 */
const agent: Localized<typeof agentDict> = {
  title: "AI 智能体",
  inputPlaceholder: "向智能体提问...",
  waitingForResponse: "正在等待响应...",
  thinking: "思考中",
  stop: "停止",
  cancelRequest: "取消请求",
  copy: "复制",
  clear: "清除",
  settings: "设置",
  selectModel: "选择模型",
  searchModel: "搜索模型...",
  noModel: "未找到模型。",
  clearModel: "清除模型",
  clearTitle: "清除历史",
  clearBody: "清除对话历史？此操作无法撤销。",
  settingsPanel: {
    systemPrompt: "系统提示",
    systemPromptPlaceholder: "留空则不使用",
    context: "上下文",
    default: "默认",
    custom: "自定义",
    format: "格式化",
  },
  toast: {
    contextAttached: "已附加 {{key}} 上下文",
    selectModel: "请选择模型",
    historyCopied: "历史已复制",
    invalidJson: "JSON 无效",
  },
};

export default agent;
