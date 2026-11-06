export interface ServerEntry {
  id: string;
  name: string;
  ip: string;
  port: string;
  user: string;
  pass: string;
  secret: string;
  token: string;
}

export interface AppConfig {
  servers: ServerEntry[];
}

export async function readConfig(): Promise<AppConfig> {
  const config = await window.electronAPI.invoke('config:read') as { servers?: ServerEntry[] }
  return { servers: config.servers ?? [] }
}

export async function writeConfig(config: AppConfig): Promise<void> {
  await window.electronAPI.invoke('config:write', config)
}

export async function getServers(): Promise<ServerEntry[]> {
  return (await readConfig()).servers
}

export async function putServer(entry: ServerEntry): Promise<void> {
  const config = await readConfig()
  const idx = config.servers.findIndex(s => s.id === entry.id)
  if (idx >= 0) config.servers[idx] = entry
  else config.servers.push(entry)
  await writeConfig(config)
}

export async function deleteServer(id: string): Promise<void> {
  const config = await readConfig()
  config.servers = config.servers.filter(s => s.id !== id)
  await writeConfig(config)
}

export async function appendServers(extra: ServerEntry[]): Promise<void> {
  const raw = (await window.electronAPI.invoke('config:read')) as Record<string, unknown>
  const cur = (raw.servers as ServerEntry[] | undefined) ?? []
  await window.electronAPI.invoke('config:write', { ...raw, servers: [...cur, ...extra] })
}
