import type { ServerEntry } from "@/api/system/config";
import { responseErrorMessage } from "@/api/http_status";
import { translate } from "@/i18n";

type AuthInput = Pick<ServerEntry, "ip" | "port" | "user" | "pass" | "secret" | "name">;

export async function authServer(server: AuthInput): Promise<string> {
  const ip = server.ip?.trim().replace(/\/$/, "");
  const port = server.port?.trim();
  if (!ip || !port) throw new Error(`${server.name}: ${translate("api.invalidServer")}`);

  const response = await fetch(`${ip}:${port}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: server.user,
      pass: server.pass,
      secret: server.secret,
    }),
  });

  const text = await response.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!response.ok || data?.status !== "success" || !data?.access_token) {
    throw new Error(
      `${server.name}: ${responseErrorMessage(response.status, data?.message)}`
    );
  }

  return data.access_token;
}

export function addBearer(server: ServerEntry): Record<string, string> {
  const token = server.token?.trim();
  if (!token) throw new Error(`${server.name}: ${translate("api.notAuthenticated")}`);
  return { Authorization: `Bearer ${token}` };
}
