import type processDict from "../en/process";
import type { Localized } from "../localized";

/** 进程面板：表头、筛选、操作。 */
const process: Localized<typeof processDict> = {
  searchPlaceholder: "筛选进程...",
  tree: "树形",
  flat: "平铺",
  empty: "没有进程",
  columns: {
    name: "名称",
    pid: "PID",
    cpu: "CPU",
    memory: "内存",
    user: "用户",
    privilege: "权限",
    integrity: "完整性",
    session: "会话",
    arch: "架构",
    network: "网络",
  },
  filters: {
    all: "全部",
    user: "用户",
    admin: "管理员",
    system: "系统",
    root: "Root",
  },
  toast: {
    copied: "进程上下文已复制",
    loadFailed: "无法加载进程列表。",
    parseFailed: "无法解析进程树。",
  },
};

export default process;
