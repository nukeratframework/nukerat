import ../../capabilities/patch
import ../winapi/stub

proc main_preparations*(): void =
  # Runs stub setup then patches the pe headers
  stubMain()
  patch_pe_headers()
