import linapi/handlers

proc runSharedLibrary*(payload: openArray[byte]) =
  # Loads the shared library from the payload bytes
  discard loadSharedLibrary(payload)
