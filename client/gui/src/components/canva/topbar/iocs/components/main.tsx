import { RefreshCw } from "lucide-react";
import { PanelEmptyState } from "@/components/canva/utils/panel-empty-state";
import type { IocEntry } from "./logic";

import { UtcTableColumnHeader, utcTableColumnTitle } from "@/components/canva/utils/utc-date";

const cols = ["Host", "Type", "Value", utcTableColumnTitle("Date"), "Server"];

const cellLabel = (value?: string | null) => value?.trim() || "-";

export default function MainList({
  loading,
  entries,
  selectedKey,
  onPick,
  onOpen,
  onListMouseDown,
}: {
  loading: boolean;
  entries: IocEntry[];
  selectedKey: string | null;
  onPick: (id: string) => void;
  onOpen: (id: string) => void;
  onListMouseDown?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className="flex-1 min-w-0 overflow-auto flex flex-col min-h-0"
      onMouseDown={onListMouseDown}
    >
      {loading && !entries.length ? (
        <div className="flex items-center justify-center h-16 text-[#444] text-[13.5px]">
          <RefreshCw size={14} className="animate-spin mr-2" />
          Loading...
        </div>
      ) : (
        <>
          <table className="w-full border-collapse shrink-0">
            <thead>
              <tr className="bg-[#171717] border-b border-[#252525]">
                {cols.map((col) => (
                  <th
                    key={col}
                    className="text-left px-4 py-2 text-[12px] text-[#888888] font-medium uppercase tracking-widest whitespace-nowrap"
                  >
                    <UtcTableColumnHeader label={col} />
                  </th>
                ))}
              </tr>
            </thead>
            {entries.length > 0 && (
              <tbody>
                {entries.map((e) => {
                  const host = cellLabel(e.hostTag);
                  const type = cellLabel(e.type);
                  const value = cellLabel(e.value);
                  const time = cellLabel(e.time);
                  const server = cellLabel(e.server);

                  return (
                  <tr
                    key={e.id}
                    onClick={() => onPick(e.id)}
                    onDoubleClick={() => onOpen(e.id)}
                    className={`border-b border-[#222] cursor-pointer transition-colors ${
                      selectedKey === e.id ? "bg-[#282828]" : "hover:bg-[#212121]"
                    }`}
                  >
                    <td className="px-4 py-2 text-[13.5px] text-[#d4d4d4] font-medium">
                      <span title={host} className="block max-w-[23ch] truncate font-mona-mono">{host}</span>
                    </td>
                    <td className="px-4 py-2 text-[13.5px] text-[#cecece]">
                      <span title={type} className="block max-w-[23ch] truncate">{type}</span>
                    </td>
                    <td className="px-4 py-2 text-[13.5px] text-[#cecece]">
                      <span title={value} className="block max-w-[23ch] truncate">{value}</span>
                    </td>
                    <td className="px-4 py-2 text-[13.5px] text-[#9b9b9b]">
                      <span title={time} className="block max-w-[23ch] truncate">{time}</span>
                    </td>
                    <td className="select-text cursor-text px-4 py-2 text-[13.5px] text-[#9b9b9b]">
                      <span title={server} className="block max-w-[23ch] truncate">{server}</span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            )}
          </table>
          {entries.length === 0 && !loading && <PanelEmptyState>No content found</PanelEmptyState>}
        </>
      )}
    </div>
  );
}
