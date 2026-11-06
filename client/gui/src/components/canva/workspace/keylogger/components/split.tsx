import { X } from "lucide-react";
import type { KeyloggerEntry } from "./logic";

const inputClass =
  "w-full bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none cursor-text";

const displayValue = (value?: string | null): string => {
  if (value === undefined || value === null || value.trim() === "") return "";
  return value;
};

const ViewField = ({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) => (
  <div className="mb-3 space-y-1.5">
    <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">{label}</label>
    <input
      type="text"
      readOnly
      tabIndex={-1}
      value={displayValue(value)}
      className={inputClass}
    />
  </div>
);

export default function SplitPanel({ entry, onClose }: { entry: KeyloggerEntry; onClose: () => void }) {
  return (
    <div className="flex flex-col h-full min-h-0 min-w-[22rem]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0">
        <span className="text-[13.5px] font-semibold text-[#cecece] tracking-wide">Keylogger</span>
        <button
          type="button"
          onClick={onClose}
          className="button-default p-1 rounded text-[#6e6e6e] hover:text-[#d4d4d4] hover:bg-[#2a2a2a] transition-colors cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>
      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-4 py-4">
        <ViewField label="date" value={entry.date} />
        <ViewField label="server" value={entry.server} />
        <ViewField label="host tag" value={entry.hostTag} />
        <ViewField label="host" value={entry.host} />
        <div className="mb-3 space-y-1.5">
          <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">content</label>
          <textarea
            readOnly
            tabIndex={-1}
            value={entry.content?.trim() ? entry.content : ""}
            className={`${inputClass} min-h-[12rem] resize-y leading-relaxed`}
          />
        </div>
      </div>
    </div>
  );
}
