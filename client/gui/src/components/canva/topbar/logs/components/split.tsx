import { X } from "lucide-react";
import type { LogEntry } from "./logic";

const inputClass =
  "w-full bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none cursor-text";

export default function SplitPanel({ entry, onClose }: { entry: LogEntry; onClose: () => void }) {
  const content = entry.message?.trim() ? entry.message : entry.raw;

  return (
    <div className="flex flex-col h-full min-h-0 min-w-[32rem]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0">
        <span className="text-[13.5px] font-semibold text-[#cecece] tracking-wide">Log</span>
        <button
          type="button"
          onClick={onClose}
          className="button-default p-1 rounded text-[#6b6e6e] hover:text-[#d4d4d4] hover:bg-[#2a2a2a] transition-colors cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-4 py-4">
        <div className="mb-3 space-y-1.5">
          <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Message</label>
          <textarea
            readOnly
            tabIndex={-1}
            rows={6}
            value={content?.trim() ? content : ""}
            className={`${inputClass} text-left font-mona-mono max-h-[12rem] !resize-none leading-relaxed`}
            style={{ resize: "none" }}
          />
        </div>
      </div>
    </div>
  );
}
