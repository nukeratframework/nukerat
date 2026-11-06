template `+`*[T](p: ptr T, off: int): ptr T =
  # Adds a typed offset to a pointer
  cast[ptr type(p[])](cast[ByteAddress](p) +% off * sizeof(p[]))

template `[]`*[T](p: ptr T, off: int): T =
  # Reads the value at a typed pointer offset
  (p + off)[]
