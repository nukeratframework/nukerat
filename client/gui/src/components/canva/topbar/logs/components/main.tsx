import { UtcTableColumnHeader, utcTableColumnTitle } from "@/components/canva/utils/utc-date";
import { short, type LogEntry } from "./logic";

const TABLE_COLUMNS = [utcTableColumnTitle("Date"), "Type", "Category", "Message"] as const;

export default function MainList({
  entries,
  selectedKey,
  onPick,
  onOpen,
  onListMouseDown,
}: {
  entries: LogEntry[];
  selectedKey: string | null;
  onPick: (id: string) => void;
  onOpen: (id: string) => void;
  onListMouseDown?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className="flex-1 min-w-0 overflow-auto flex flex-col min-h-0 bg-[#171717]"
      onMouseDown={onListMouseDown}
    >
      <table className="w-full border-collapse shrink-0">
        <thead>
          <tr className="bg-[#171717] border-b border-[#252525]">
            {TABLE_COLUMNS.map((col) => (
              <th
                key={col}
                className="px-4 py-2 text-left text-[12px] text-[#888888] font-medium uppercase tracking-widest whitespace-nowrap"
              >
                <UtcTableColumnHeader label={col} />
              </th>
            ))}
          </tr>
        </thead>
        {entries.length > 0 && (
          <tbody>
            {entries.map((e) => {
              const when = e.date;
              const messageRaw = e.message?.trim() || "";
              const message = messageRaw ? short(messageRaw) : "-";

              return (
                <tr
                  key={e.id}
                  onClick={() => onPick(e.id)}
                  onDoubleClick={() => onOpen(e.id)}
                  className={`border-b border-[#222] cursor-pointer transition-colors ${
                    selectedKey === e.id ? "bg-[#282828]" : "hover:bg-[#212121]"
                  }`}
                >
                  <td className="px-4 py-2 text-[13.5px] text-[#9b9b9b] whitespace-nowrap">
                    <span title={when} className="block max-w-[23ch] truncate">{when}</span>
                  </td>
                  <td className="px-4 py-2 text-[13.5px] text-[#cecece] whitespace-nowrap">
                    {e.type}
                  </td>
                  <td className="px-4 py-2 text-[13.5px] text-[#cecece] capitalize whitespace-nowrap">
                    {e.category}
                  </td>
                  <td className="px-4 py-2 text-[13.5px] text-[#888888] !text-left">
                    <span
                      title={messageRaw || undefined}
                      className="block w-full min-w-0 max-w-[100ch] truncate text-left font-mona-mono"
                    >
                      {message}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        )}
      </table>
    </div>
  );
}
