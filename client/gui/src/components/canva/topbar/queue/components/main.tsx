import { RefreshCw } from "lucide-react";
import { PanelEmptyState } from "@/components/canva/utils/panel-empty-state";
import { UtcTableColumnHeader } from "@/components/canva/utils/utc-date";
import { short, TABLE_COLUMNS, yn, type QueueEntry } from "./logic";

export default function MainList({
  loading,
  entries,
  selectedKey,
  onPick,
  onOpen,
  onListMouseDown,
}: {
  loading: boolean;
  entries: QueueEntry[];
  selectedKey: string | null;
  onPick: (key: string) => void;
  onOpen: (key: string) => void;
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
                {TABLE_COLUMNS.map((col) => (
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
                  const inputRaw = e.input?.trim() || "";
                  const input = inputRaw ? short(inputRaw) : "-";
                  const time = e.time?.trim() || "-";

                  return (
                <tr
                  key={e.key}
                  onClick={() => onPick(e.key)}
                  onDoubleClick={() => onOpen(e.key)}
                  className={`border-b border-[#222] cursor-pointer transition-colors ${
                    selectedKey === e.key ? "bg-[#282828]" : "hover:bg-[#212121]"
                  }`}
                >
                  <td className="px-4 py-2 text-[13.5px] text-[#d4d4d4] max-w-[120px] truncate font-medium whitespace-nowrap">
                    {e.hostTag?.trim() || "-"}
                  </td>
                  <td className="px-4 py-2 text-[13.5px] text-[#cecece] max-w-[120px] truncate whitespace-nowrap">
                    {e.type || "-"}
                  </td>
                  <td className="px-4 py-2 text-[13.5px] text-[#cecece]">
                    <span title={inputRaw || undefined} className="block max-w-[23ch] truncate">
                      {input}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-[13.5px] text-[#9b9b9b]">
                    <span title={time} className="block max-w-[23ch] truncate">{time}</span>
                  </td>
                  <td className="px-4 py-2 text-[13.5px] text-[#cecece] whitespace-nowrap">{yn(e.isCompleted)}</td>
                  <td className="select-text cursor-text px-4 py-2 text-[13.5px] text-[#9b9b9b] max-w-[160px] truncate whitespace-nowrap">
                    {e.server || "-"}
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
