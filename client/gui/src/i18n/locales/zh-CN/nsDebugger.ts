import type nsDebuggerDict from "../en/nsDebugger";
import type { Localized } from "../localized";

/** NukeScripts 调试器面板：编辑器、输出、错误栏。 */
const nsDebugger: Localized<typeof nsDebuggerDict> = {
  selectServer: "选择服务器",
  searchServer: "搜索服务器...",
  noServer: "未找到服务器。",
  clearServer: "清除服务器",
  searchOutput: "搜索输出...",
  emptySelectServer: "选择服务器以查看输出",
  empty: "未找到内容",
  noMatches: "没有匹配的输出",
  update: "更新",
  clear: "清除",
};

export default nsDebugger;
