import ../global
import ./lib/types
import ./lib/parse
import ./lib/symbols
import ./lib/beacon
import ./lib/relocations
import ./lib/memory
import ./lib/isolation

proc failFree(ctx: seq[pointer]; err: (bool, int32, string)): (bool, int32, string) =
  # Frees the coff memory and returns the error
  freeCoffMemory(ctx)
  err

proc runCoff*(
  data: openArray[byte],
  entryName: string = obf("go"),
  args: pointer = nil,
  argsSize: uint32 = 0,
  resolveExternal: proc(name: string): pointer {.nimcall.} = resolveBofExternal,
): (bool, int32, string) =
  # Main function that loads and runs a coff object
  resetBofOutput()
  var (ctx, validation) = validateCoff(data)
  if not validation[0]:
    freeCoffMemory(ctx)
    return validation

  # if coffRequiresBofArgs(ctx) and not bofArgsProvided(args, argsSize):
  #   freeCoffMemory(ctx)
  #   return (false, 1'i32, obf("Missing required parameters. Use help <bof> for usage."))

  var result = mapSections(ctx)
  if not result[0]:
    return failFree(ctx, result)

  let relocCount = countRelocations(ctx)
  result = allocImportTable(ctx, relocCount)
  if not result[0]:
    return failFree(ctx, result)

  result = processRelocations(ctx, resolveExternal)
  if not result[0]:
    return failFree(ctx, result)

  result = protectSections(ctx)
  if not result[0]:
    return failFree(ctx, result)

  result = protectImportTable(ctx)
  if not result[0]:
    return failFree(ctx, result)

  var (entry, entryResult) = findEntryPoint(ctx, entryName)
  if not entryResult[0] and entryName == obf("go"):
    (entry, entryResult) = findEntryPoint(ctx, obf("launch"))
  if not entryResult[0]:
    return failFree(ctx, entryResult)

  let execCode = runCoffEntryIsolated(entry, args, argsSize)
  if execCode != 0:
    return failFree(ctx, (false, execCode, ""))

  freeCoffMemory(ctx)
  coffOk()
