import { getServers } from "@/api/system/config";
import { addBearer } from "@/api/system/auth";
import { responseErrorMessage, thrownErrorMessage } from "@/api/http_status";

type BuildConfigFn = (data: any) => Record<string, unknown>;

export const buildImplantRequest = async (
  data: { teamHost: string; teamPort: string; format: string },
  implantBase: string,
  buildConfig: BuildConfigFn,
  signal?: AbortSignal
): Promise<any> => {
  try {
    const host = data.teamHost.trim();
    const port = data.teamPort.trim();
    const server = (await getServers()).find(
      (s) => s.ip?.trim().replace(/\/$/, "") === host && s.port?.trim() === port
    );
    const ip = server?.ip?.trim().replace(/\/$/, "");
    const p = server?.port?.trim();
    if (!server || !ip || !p) {
      return { status: "failure", type: "build", message: "No servers configured" };
    }

    const endpoint = `${ip}:${p}/api/implants/`;
    const raw = JSON.stringify({
      type: "build",
      implant_base: implantBase,
      config: buildConfig(data),
    });

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          ...(await addBearer(server)),
        },
        body: raw,
      });
      const text = await response.text();
      if (!response.ok) {
        let json: any = null;
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
        return {
          status: json?.status ?? "failure",
          message: `${server.name}: ${responseErrorMessage(response.status, json?.message)}`,
          type: "build",
          endpoint,
        };
      }
      return { ...JSON.parse(text), endpoint };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return null;
      return { status: "ERR_conn", message: `${server.name}: Unreachable host`, type: "build" };
    }
  } catch (error) {
    const message = thrownErrorMessage(error);
    return { status: "error", type: "build", message, error: message };
  }
};
