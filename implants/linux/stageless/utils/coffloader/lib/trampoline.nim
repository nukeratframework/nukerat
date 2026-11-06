import ../../linapi/handlers
import ./types

const TrampolineSize = 12

type
  TrampolineEntry = object
    mem: pointer
    size: int

var
  trampolineCache: seq[tuple[target: pointer, tramp: pointer]]
  trampolineAllocs: seq[TrampolineEntry]

proc createTrampoline(target: pointer): pointer =
  # Builds an executable jump trampoline to a target
  if target == nil:
    return nil
  let mem = mmap(nil, TrampolineSize.csize_t, memProtRead or memProtWrite or memProtExec, memMapPrivate or memMapAnonymous, -1, 0)
  if mapFailed(mem):
    return nil
  # movabs rax, imm64; jmp rax
  cast[ptr byte](mem)[] = 0x48'u8
  cast[ptr byte](cast[int](mem) + 1)[] = 0xB8'u8
  cast[ptr uint64](cast[int](mem) + 2)[] = uint64(cast[int](target))
  cast[ptr byte](cast[int](mem) + 10)[] = 0xFF'u8
  cast[ptr byte](cast[int](mem) + 11)[] = 0xE0'u8
  trampolineAllocs.add TrampolineEntry(mem: mem, size: TrampolineSize)
  mem

proc getOrCreateTrampoline*(target: pointer): pointer =
  # Returns a cached trampoline or creates a new one
  if target == nil:
    return nil
  for entry in trampolineCache:
    if entry.target == target:
      return entry.tramp
  let tramp = createTrampoline(target)
  if tramp != nil:
    trampolineCache.add (target: target, tramp: tramp)
  tramp

proc freeTrampolines*() =
  # Unmaps every trampoline and clears the cache
  for entry in trampolineAllocs:
    if entry.mem != nil:
      discard munmap(entry.mem, entry.size.csize_t)
  trampolineAllocs = @[]
  trampolineCache = @[]
