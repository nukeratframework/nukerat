import { unreachableHost } from "@/api/http_status";
import { fetchSessions } from "@/api/sessions";
import type { Session } from "@/api/sessions";

export type GraphSession = Session;

export interface GraphServerData {
  server: string;
  chains: string[];
  data: Record<string, GraphSession>;
}

export interface GraphFetchResult {
  status: "success" | "failure";
  graphs: GraphServerData[];
  message?: string;
}

export type GraphFetchOpts = {
  signal?: AbortSignal;
  graphsLongPoll?: boolean;
};

export const DataFetch = async (
  opts: GraphFetchOpts = {},
): Promise<GraphFetchResult> => {
  const { signal, graphsLongPoll = true } = opts;
  const res = await fetchSessions("graphs", signal, graphsLongPoll);
  if (res?.status !== "success") {
    throw new Error(res?.message ?? unreachableHost());
  }
  return { status: "success", graphs: res.graphs ?? [] };
};
