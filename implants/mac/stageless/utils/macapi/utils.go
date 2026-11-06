package macapi

import "stageless/utils/obf"

const ReadTextMax = 65536
const ReadChunk = 8192
const PathMax = 4096

var PathSep = obf.S("/")
var DotName = obf.S(".")
var DotDotName = obf.S("..")
var LoopbackName = obf.S("lo0")
var UserEnvKey = obf.S("USER")
var ArchX64 = obf.S("x86_64")
var ArchArm64 = obf.S("arm64")
var NullMac = obf.S("00:00:00:00:00:00")
