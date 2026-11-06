import type { Session } from "@/api/sessions";
import { unreachableHost } from "@/api/http_status";
import { fetchSessions } from "@/api/sessions";

export interface SessionLpFetchResult {
  status: "success" | "failure";
  sessions: Session[];
  message?: string;
}

export type SessionLpFetchOpts = {
  signal?: AbortSignal;
  sessionsLongPoll?: boolean;
};

export const DataFetch = async (
  opts: SessionLpFetchOpts = {},
): Promise<SessionLpFetchResult> => {
  const { signal, sessionsLongPoll = true } = opts;
  const mode = sessionsLongPoll ? "sessions_lp" : "default";
  const res = await fetchSessions(mode, signal);
  if (res?.status !== "success") {
    throw new Error(res?.message ?? unreachableHost());
  }
  return { status: "success", sessions: res.sessions ?? [] };
};
