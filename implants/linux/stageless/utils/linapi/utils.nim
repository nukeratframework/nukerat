from posix import Mode
import ../global

const
  pathMax* = 4096
  readChunk* = 8192
  readTextMax* = 65536
  environMax* = 1024 * 1024
  dirMode* = Mode(0o755)
  fileMode* = Mode(0o644)
  enoEnt* = 2
  enoAcc* = 13
  enoBusy* = 16
  enoExist* = 17
  enoPerm* = 1
  enoNameTooLong* = 36
  enoIo* = 5
  enoNotEmpty* = 39
  enoFileTooBig* = 27
  procEnvironPath* = obf("/proc/self/environ")
  osReleasePath* = obf("/etc/os-release")
  machineIdPath* = obf("/etc/machine-id")
  netClassRoot* = obf("/sys/class/net")
  netAddressSuffix* = obf("/address")
  pathSep* = obf("/")
  dotName* = obf(".")
  dotDotName* = obf("..")
  loopbackName* = obf("lo")
  userEnvKey* = obf("USER")
  osPrettyPrefix* = obf("PRETTY_NAME=")
  archX64* = obf("x86_64")
  archArm64* = obf("aarch64")
  nullMac* = obf("00:00:00:00:00:00")
  dateFmt* = obf("%Y-%m-%d")
  mtimeFmt* = obf("%Y-%m-%d %H:%M:%S")
  procRoot* = obf("/proc")
  procNetTcpPath* = obf("/proc/net/tcp")
  procUptimePath* = obf("/proc/uptime")
  procStatSuffix* = obf("/stat")
  procStatusSuffix* = obf("/status")
  procExeSuffix* = obf("/exe")
  procFdSuffix* = obf("/fd")
  socketPrefix* = obf("socket:[")
  scClkTck* = 2
  scNProcessorsOnln* = 84
  displayEnvKey* = obf("DISPLAY")
  xLibSo6* = obf("libX11.so.6")
  xLibSo* = obf("libX11.so")
