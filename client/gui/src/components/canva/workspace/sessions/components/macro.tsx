import { getServers, type ServerEntry } from "@/api/system/config";
import { addBearer } from "@/api/system/auth";

function matchServer(entry: ServerEntry, target?: string) {
  const ip = entry.ip?.trim().replace(/\/$/, "");
  const port = entry.port?.trim();
  if (!ip || !port) return false;
  const base = `${ip}:${port}`;
  if (!target?.trim()) return true;
  return base === target.trim().replace(/\/+$/, "");
}

export function kill_session(sessionTag: string, server?: string): void {
  void (async () => {
    try {
      const servers = (await getServers()).filter((s) => matchServer(s, server));
      for (const entry of servers) {
        const ip = entry.ip?.trim().replace(/\/$/, "");
        const port = entry.port?.trim();
        if (!ip || !port) continue;
        void fetch(`${ip}:${port}/api/terminal/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...addBearer(entry),
          },
          body: JSON.stringify({
            command: "kill -bg",
            session: sessionTag,
            source_terminal: "00000",
          }),
        });
        return;
      }
    } catch {
      /* fire-and-forget */
    }
  })();
}
