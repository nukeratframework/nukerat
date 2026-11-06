import { X } from "lucide-react";
import type { IocEntry } from "./logic";

const inputClass =
  "w-full bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none cursor-text";

const displayValue = (value?: string | number | null): string => {
  if (value === undefined || value === null || `${value}`.trim() === "") return "";
  return String(value);
};

const ViewField = ({
  label,
  value,
}: {
  label: React.ReactNode;
  value?: string | number | null;
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

const ViewTextField = ({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) => (
  <div className="mb-3 space-y-1.5">
    <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">{label}</label>
    <textarea
      readOnly
      tabIndex={-1}
      rows={6}
      value={value?.trim() ? value : ""}
      className={`${inputClass} max-h-[12rem] resize-none leading-relaxed`}
    />
  </div>
);

export default function SplitPanel({ entry, onClose }: { entry: IocEntry; onClose: () => void }) {
  return (
    <div className="flex flex-col h-full min-h-0 min-w-[32rem]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0">
        <span className="text-[13.5px] font-semibold text-[#cecece] tracking-wide">IOC</span>
        <button
          type="button"
          onClick={onClose}
          className="button-default p-1 rounded text-[#6b6e6e] hover:text-[#d4d4d4] hover:bg-[#2a2a2a] transition-colors cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-4 py-4">
        <ViewField
          label={
            <>
              Date<span className="text-[#4a4a4a]"> (UTC)</span>
            </>
          }
          value={entry.time}
        />
        <ViewField label="Server" value={entry.server} />
        <ViewField label="Tag" value={entry.tag} />
        <ViewField label="Host" value={entry.hostTag} />
        <ViewField label="Type" value={entry.type} />
        <ViewTextField label="Value" value={entry.value} />
      </div>
    </div>
  );
}
