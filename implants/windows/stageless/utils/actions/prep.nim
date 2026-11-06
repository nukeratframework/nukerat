import ../../capabilities/patch
import ../winapi/stub

proc main_preparations*(): void =
  stubMain()
  patch_pe_headers()
