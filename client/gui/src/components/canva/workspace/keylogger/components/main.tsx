import { RefreshCw } from "lucide-react";
import { PanelEmptyState } from "@/components/canva/utils/panel-empty-state";
import { UtcTableColumnHeader } from "@/components/canva/utils/utc-date";
import { TABLE_COLUMNS, tableCellTruncate, type KeyloggerEntry } from "./logic";

export default function MainList({
  loading,
  entries,
  selectedKey,
  onRowClick,
  onRowDoubleClick,
  onListMouseDown,
}: {
  loading: boolean;
  entries: KeyloggerEntry[];
  selectedKey: string | null;
  onRowClick: (key: string) => void;
  onRowDoubleClick: (key: string) => void;
  onListMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className="flex-1 overflow-auto flex flex-col min-h-0"
      onMouseDown={onListMouseDown}
    >
      {loading && !entries.length ? (
        <div className="flex items-center justify-center h-16 text-[#444] text-[13.5px]">
          <RefreshCw size={14} className="animate-spin mr-2" />
          Loading...
        </div>
      ) : (
        <>
          <table className="w-full border-collapse shrink-0 select-none">
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
                  const date = e.date?.trim() || "-";

                  return (
                    <tr
                      key={e.key}
                      onClick={() => onRowClick(e.key)}
                      onDoubleClick={() => onRowDoubleClick(e.key)}
                      className={`border-b border-[#222] cursor-pointer transition-colors ${
                        selectedKey === e.key ? "bg-[#282828]" : "hover:bg-[#212121]"
                      }`}
                    >
                      <td className="px-4 py-2 text-[13.5px] text-[#9b9b9b] font-sans">
                        <span title={date} className="block max-w-[23ch] truncate">{date}</span>
                      </td>
                      <td className="px-4 py-2 text-[13.5px] text-[#cecece] max-w-[160px] truncate">{e.server || "-"}</td>
                      <td className="px-4 py-2 text-[13.5px] text-[#cecece]">
                        <span className={`${tableCellTruncate} font-mona-mono`}>{e.hostTag || "-"}</span>
                      </td>
                      <td className="px-4 py-2 text-left text-[13.5px] text-[#cecece]">
                        <span
                          className="block max-w-[30ch] truncate text-left"
                          title={e.content || undefined}
                        >
                          {e.content || "-"}
                        </span>
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
