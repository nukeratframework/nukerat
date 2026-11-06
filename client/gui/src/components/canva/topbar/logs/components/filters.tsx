import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ServerEntry } from "@/api/system/config";
import type { LogCategory, LogFilters, LogType } from "./logic";
import { logCategories, logTypes } from "./logic";

export interface LogTopBarProps {
  filters: LogFilters;
  total: number;
  servers: ServerEntry[];
  serverId: string;
  serverLabel: (s: ServerEntry) => string;
  hasActiveFilters: boolean;
  setFilter: <K extends keyof LogFilters>(key: K, value: LogFilters[K]) => void;
  setServer: (id: string) => void;
  clearFilters: () => void;
}

const LogTopBar = ({
  filters,
  total,
  servers,
  serverId,
  serverLabel,
  hasActiveFilters,
  setFilter,
  setServer,
  clearFilters,
}: LogTopBarProps) => {
  const selectTriggerClass =
    "h-[29px] shrink-0 rounded border border-[#363636] bg-[#212121] py-0 text-[13.5px] text-[#cecece] focus:border-[#555] focus-visible:ring-0";

  return (
    <div className="shrink-0 min-w-0 overflow-x-auto border-b border-[#252525] bg-[#171717]">
      <div className="box-border flex flex-col gap-2 p-2">
        <div className="flex w-max min-w-full flex-nowrap items-center gap-2">
          <Select value={serverId || undefined} onValueChange={setServer}>
            <SelectTrigger className={`w-[10rem] px-2.5 ${selectTriggerClass}`}>
              <SelectValue placeholder="Server" />
            </SelectTrigger>
            <SelectContent className="text-[13.5px]">
              {servers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {serverLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative min-w-[8rem] flex-1 shrink-0">
            <input
              className="box-border h-[29px] w-full rounded border border-[#363636] bg-[#212121] py-0 pl-3 pr-8 text-[13.5px] text-[#cecece] outline-none transition-colors placeholder:text-[#444] focus:border-[#555]"
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              placeholder="Search logs..."
              autoComplete="off"
              spellCheck={false}
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => setFilter("search", "")}
                className="button-default absolute right-2 top-1/2 -translate-y-1/2 border-none bg-transparent p-0 text-[#555] hover:text-[#cecece] cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <Select
            value={filters.type}
            onValueChange={(v) => setFilter("type", v as LogType | "all")}
          >
            <SelectTrigger className={`w-[7.5rem] px-2.5 ${selectTriggerClass}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="text-[13.5px]">
              <SelectItem value="all">All</SelectItem>
              {logTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.category}
            onValueChange={(v) => setFilter("category", v as LogCategory | "all")}
          >
            <SelectTrigger className={`w-[8.5rem] px-2.5 capitalize ${selectTriggerClass}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {logCategories.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-h-[18px] items-center justify-between">
          <span className="text-[13px] tabular-nums text-[#555]">
            {total === 0
              ? "0 entries"
              : `${total} ${total === 1 ? "entry" : "entries"}`}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="button-default cursor-pointer text-[13px] text-[#6e6e6e] transition-colors hover:text-[#d4d4d4]"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LogTopBar;
