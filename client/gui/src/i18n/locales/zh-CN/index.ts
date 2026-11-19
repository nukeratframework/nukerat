import type { Dictionary } from "../en";
import type { Localized } from "../localized";
import common from "./common";
import shell from "./shell";
import workspace from "./workspace";
import process from "./process";
import explorer from "./explorer";
import credentials from "./credentials";
import keylogger from "./keylogger";
import graphs from "./graphs";
import agent from "./agent";
import fileServer from "./fileServer";
import nsDebugger from "./nsDebugger";
import screenshot from "./screenshot";
import terminal from "./terminal";
import sessions from "./sessions";
import listeners from "./listeners";
import implants from "./implants";
import network from "./network";
import servers from "./servers";
import agents from "./agents";
import queue from "./queue";
import iocs from "./iocs";
import reports from "./reports";
import logs from "./logs";
import nukescripts from "./nukescripts";
import about from "./about";
import preferences from "./preferences";
import dialog from "./dialog";
import toast from "./toast";
import api from "./api";
import ui from "./ui";
import clickMenu from "./clickMenu";

/** 简体中文。结构由 `Dictionary` 约束，漏键会导致 tsc 报错。 */
const zhCN: Localized<Dictionary> = {
  common,
  shell,
  workspace,
  process,
  explorer,
  credentials,
  keylogger,
  graphs,
  agent,
  fileServer,
  nsDebugger,
  screenshot,
  terminal,
  sessions,
  listeners,
  implants,
  network,
  servers,
  agents,
  queue,
  iocs,
  reports,
  logs,
  nukescripts,
  about,
  preferences,
  dialog,
  toast,
  api,
  ui,
  clickMenu,
};

export default zhCN;
