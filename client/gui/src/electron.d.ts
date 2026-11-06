export {}

declare global {
  interface Window {
    electronAPI: {
      send: (channel: string, ...args: unknown[]) => void
      on: (channel: string, listener: (...args: unknown[]) => void) => void
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
      removeAllListeners: (channel: string) => void
    }
  }
}
