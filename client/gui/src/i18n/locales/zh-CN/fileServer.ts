import type fileServerDict from "../en/fileServer";
import type { Localized } from "../localized";

/** 文件服务器面板：表格、上传/下载操作。 */
const fileServer: Localized<typeof fileServerDict> = {
  searchFiles: "搜索文件...",
  selectServer: "选择服务器",
  searchServer: "搜索服务器...",
  noServer: "未找到服务器。",
  clearServer: "清除服务器",
  emptySelectServer: "选择服务器以查看文件",
  empty: "未找到文件",
  columns: {
    date: "日期",
    name: "名称",
    size: "大小",
    actions: "操作",
  },
  actions: {
    download: "下载",
    rename: "重命名",
    delete: "删除",
    upload: "上传",
    update: "更新",
  },
  confirm: {
    deleteTitle: "删除文件",
    deleteLead: "删除",
    deleteTail: "？此操作无法撤销。",
    renameTitle: "重命名文件",
  },
  toast: {
    downloaded: "文件已下载",
  },
};

export default fileServer;
