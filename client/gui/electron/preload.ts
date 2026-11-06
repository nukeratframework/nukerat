import { contextBridge, ipcRenderer } from 'electron'

function unwrapIpcError(error: unknown): Error {
  if (!(error instanceof Error)) return new Error('Request failed')
  const message = error.message
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '')
  return new Error(message || 'Request failed')
}

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel: string, ...args: unknown[]) => ipcRenderer.send(channel, ...args),
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => listener(...args))
  },
  invoke: async (channel: string, ...args: unknown[]) => {
    try {
      return await ipcRenderer.invoke(channel, ...args)
    } catch (error) {
      throw unwrapIpcError(error)
    }
  },
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
})
