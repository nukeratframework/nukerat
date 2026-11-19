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
  /** Interface language (`en` | `zh-CN`); absent means "follow the OS". */
  language?: string;
}

const serverListeners = new Set<() => void>()

export function subscribeServers(listener: () => void): () => void {
  serverListeners.add(listener)
  return () => serverListeners.delete(listener)
}

/** Raw `config.json` contents, including keys this module does not model. */
async function readRawConfig(): Promise<Record<string, unknown>> {
  return (await window.electronAPI.invoke("config:read")) as Record<string, unknown>;
}

export async function readConfig(): Promise<AppConfig> {
  const raw = await readRawConfig();
  // Spread `raw` so keys this module does not know about survive the round trip
  // through `writeConfig` (the file is shared user state, not ours alone).
  return {
    ...raw,
    servers: Array.isArray(raw.servers) ? (raw.servers as ServerEntry[]) : [],
    ...(typeof raw.language === "string" ? { language: raw.language } : {}),
  };
}

export async function writeConfig(config: AppConfig): Promise<void> {
  await window.electronAPI.invoke('config:write', config)
  serverListeners.forEach((listener) => listener())
}

export async function getServers(): Promise<ServerEntry[]> {
  return (await readConfig()).servers
}

/** Persist the interface language without touching the servers list. */
export async function saveLanguage(language: string): Promise<void> {
  const raw = await readRawConfig();
  await window.electronAPI.invoke("config:write", { ...raw, language });
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
  const raw = await readRawConfig()
  const cur = (raw.servers as ServerEntry[] | undefined) ?? []
  await window.electronAPI.invoke('config:write', { ...raw, servers: [...cur, ...extra] })
  serverListeners.forEach((listener) => listener())
}
