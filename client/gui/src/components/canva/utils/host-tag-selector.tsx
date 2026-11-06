import { Checkbox } from "@/components/ui/checkbox";
import type { Session } from "@/api/sessions";

export default function HostTagSelector({
  hosts,
  selectedTags,
  onToggle,
  onSelectAll,
  onClear,
}: {
  hosts: Session[];
  selectedTags: string[];
  onToggle: (tag: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  return (
    <>
      <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest mb-2">Hosts</label>

      <div className="max-h-[200px] overflow-hidden rounded-lg border border-[#292929] bg-[#141414]">
        {hosts.length > 0 ? (
          <div className="max-h-[200px] overflow-y-auto overflow-x-hidden">
            {hosts.map((h) => {
              const checked = selectedTags.includes(h.tag);
              return (
                <label
                  key={`${h._server ?? ""}-${h.tag}`}
                  className={`flex items-center gap-2 px-3 py-2 border-b border-[#222] cursor-pointer transition-colors ${
                    checked ? "bg-[#252525]" : "hover:bg-[#1d1d1d]"
                  }`}
                >
                  <Checkbox
                    className="size-[18px] cursor-pointer shrink-0 border-[#454545] data-[state=checked]:border-[#5a5a5a] data-[state=checked]:bg-[#2a2a2a] data-[state=checked]:text-[#cecece]"
                    checked={checked}
                    onCheckedChange={() => onToggle(h.tag)}
                  />
                  <span className="text-[13px] text-[#d4d4d4] truncate">{h.ip}</span>
                  <span className="ml-auto text-[13px] text-[#666] truncate max-w-[100px]">{h.tag || "-"}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <span className="block px-3 py-6 text-center text-[13px] text-[#555]">No hosts found</span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onSelectAll}
          disabled={hosts.length === 0}
          className="button-default flex items-center gap-1.5 px-3 py-1 rounded bg-[#232323] text-[#cecece] text-[13px] transition-colors border border-[#333] cursor-pointer hover:bg-[#2b2b2b] hover:text-[#d4d4d4] disabled:opacity-25 disabled:cursor-not-allowed"
        >
          All
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={selectedTags.length === 0}
          className="button-default flex items-center gap-1.5 px-3 py-1 rounded bg-[#232323] text-[#cecece] text-[13px] transition-colors border border-[#333] cursor-pointer hover:bg-[#2b2b2b] hover:text-[#d4d4d4] disabled:opacity-25 disabled:cursor-not-allowed"
        >
          Clear
        </button>
      </div>
    </>
  );
}
