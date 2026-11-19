import type explorerDict from "../en/explorer";
import type { Localized } from "../localized";

/** 文件浏览器面板：工具栏、目录树、菜单、文件操作。 */
const explorer: Localized<typeof explorerDict> = {
  searchPlaceholder: "搜索...",
  empty: "未找到内容",
  download: "下载",
  iconView: "图标视图",
  listView: "列表视图",
  fileType: "文件",
  folderType: "文件夹",
  itemOne: "{{count}} 项",
  itemMany: "{{count}} 项",
  itemsUnknown: "{{value}} 项",
  oversized: "该文件超过 25 MB。",
  oversizedHint: "请改用终端下载。",
  columns: {
    name: "名称",
    type: "类型",
    size: "大小",
    modified: "修改时间",
  },
  toast: {
    listFailed: "无法列出文件夹内容。",
    openFailed: "无法打开文件。",
    pathFailed: "无法访问请求的路径。",
    contentFailed: "无法获取文件内容。",
  },
};

export default explorer;
