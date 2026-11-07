import ../global
import ./lib/types
import ./lib/parse
import ./lib/symbols
import ./lib/beacon
import ./lib/relocations
import ./lib/memory
import ./lib/isolation

proc failFree(ctx: ElfCtx; err: (bool, int32, string)): (bool, int32, string) =
  # Frees the elf context and returns the error
  if ctx != nil:
    freeElfMemory(ctx)
  err

proc runCoff*(
  data: openArray[byte],
  entryName: string = obf("go"),
  args: pointer = nil,
  argsSize: uint32 = 0,
  resolveExternal: proc(name: string): pointer {.nimcall.} = resolveBofExternal,
): (bool, int32, string) =
  # Loads a coff object, runs its entry, and returns the status
  resetBofOutput()
  var (ctx, validation) = validateElf(data)
  if not validation[0]:
    return validation

  let needsArgs = coffRequiresBofArgs(ctx)
  let hasArgs = bofArgsProvided(args, argsSize)
  if needsArgs and not hasArgs:
    freeElfMemory(ctx)
    return (false, 1'i32, obf("Missing required parameters. Use help <bof> for usage."))

  var step = mapSections(ctx)
  if not step[0]:
    return failFree(ctx, step)

  step = resolveSymbolValues(ctx, resolveExternal)
  if not step[0]:
    return failFree(ctx, step)

  step = processRelocations(ctx)
  if not step[0]:
    return failFree(ctx, step)

  step = protectSections(ctx)
  if not step[0]:
    return failFree(ctx, step)

  var (entry, entryResult) = findEntryPoint(ctx, entryName)
  if not entryResult[0] and entryName == obf("go"):
    (entry, entryResult) = findEntryPoint(ctx, obf("launch"))
  if not entryResult[0]:
    return failFree(ctx, entryResult)

  let execCode = runCoffEntryIsolated(entry, args, argsSize)
  if execCode != 0:
    return failFree(ctx, (false, execCode, ""))

  freeElfMemory(ctx)
  elfOk()
