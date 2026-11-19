import type reportsDict from "../en/reports";
import type { Localized } from "../localized";

/** Reports 面板：报告列表、生成表单、预览。 */
const reports: Localized<typeof reportsDict> = {
  empty: "尚未生成任何报告",
  loading: "加载中...",
  columns: {
    name: "名称",
    file: "文件",
    type: "类型",
    server: "服务器",
    hosts: "主机",
    created: "创建时间",
  },
  reportTypes: {
    activity: "活动报告",
    hosts: "主机报告",
    ioc: "入侵指标",
  },
  actions: {
    new: "新建",
    view: "查看",
    download: "下载",
    remove: "移除",
    update: "更新",
  },
  removeConfirm: {
    title: "移除报告",
    prefix: "移除 ",
    suffix: "？此操作无法撤销。",
    remove: "移除",
  },
  create: {
    title: "新建报告",
    name: "名称",
    namePlaceholder: "报告名称",
    description: "描述",
    descriptionPlaceholder: "可选的报告描述",
    server: "服务器",
    serverPlaceholder: "选择服务器...",
    reportType: "报告类型",
    fileType: "文件类型",
    hideCredentials: "隐藏凭据",
    cancel: "取消",
    create: "创建",
  },
  viewDialog: {
    close: "关闭",
    loading: "正在加载报告...",
    previewTitle: "报告预览",
    noPreview: "暂无预览",
    fallbackTitle: "报告",
  },
  toast: {
    fetchFailed: "获取报告失败",
    createFailed: "创建报告失败",
    created: "报告已创建",
    downloadFailed: "下载报告失败",
    downloaded: "报告已下载",
    loadFailed: "加载报告失败",
    removeFailed: "移除报告失败",
    removed: "报告已移除",
  },
};

export default reports;
