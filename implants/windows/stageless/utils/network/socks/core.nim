import std/tables
import ../tcp

var socksFds*: Table[string, culong] = initTable[string, culong]()

proc sockConnect*(host: string, port: int): culong =
  # Opens a socks connection to the host and port
  tcpConnect(host, port)

proc sockRead*(fd: culong, maxBytes: int): seq[byte] =
  # Reads bytes from the socks socket
  tcpRecv(fd, maxBytes)

proc sockWrite*(fd: culong, data: string) =
  # Writes data to the socks socket
  tcpSend(fd, data)

proc sockClose*(fd: culong) =
  # Closes the socks socket
  tcpClose(fd)
