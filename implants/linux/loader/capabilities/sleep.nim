import ../utils/global
import ../utils/linapi/handlers

proc sleep_now*(seconds = -1) =
  # Sleeps for the given seconds or the beacon delay
  let sec = if seconds >= 0: seconds else: (if beaconDelay <= 0: 5 else: beaconDelay)
  sleepMs(culong(sec * 1000))
