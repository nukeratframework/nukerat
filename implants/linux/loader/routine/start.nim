import ../utils/global
import ../utils/actions/prep
import http as httpRoutine
import custom as customRoutine

proc main_init*(): void =
  # Here is where preparations run and the channel routine starts
  main_preparations()
  if channel == obf("http"):
    httpRoutine.main()
  elif channel == obf("custom"):
    customRoutine.main()
