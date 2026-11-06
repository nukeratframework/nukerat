import { X } from "lucide-react";
import type { Listener } from "./logic";
import {
  getViewFlags,
  getViewTypeLabel,
  getViewProtocolLabel,
  showViewAdvancedSection,
} from "./logic";

export interface ViewListenerPanelProps {
  listener: Listener | null;
  handleClosePanel: () => void;
}

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
  label: string;
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

const ViewListenerPanel = ({ listener, handleClosePanel }: ViewListenerPanelProps) => {
  const { isChannel, isFileServer } = getViewFlags(listener);
  const showAdvanced = showViewAdvancedSection(listener);

  return (
    <div className="flex flex-col h-full min-h-0 min-w-[32rem]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-semibold text-[#cecece] tracking-wide">
            View - {listener?.name ?? "Listener"}
          </span>
        </div>
        <button
          onClick={handleClosePanel}
          className="button-default p-1 rounded text-[#6e6e6e] hover:text-[#d4d4d4] hover:bg-[#2a2a2a] transition-colors cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-4 py-4">
        <ViewField label="Name" value={listener?.name} />
        <ViewField label="Type" value={getViewTypeLabel(listener)} />
        <ViewField label="Server" value={listener?.server} />
        <ViewField label="Protocol" value={getViewProtocolLabel(listener)} />

        {isChannel && (
          <>
            <ViewField label="Host" value={listener?.host} />
            <ViewField label="Port" value={listener?.port} />
          </>
        )}

        {showAdvanced && (
          <>
            <ViewField label="Endpoint Path" value={listener?.endpointPath} />
            <ViewField label="Custom Body" value={listener?.implantBodyType} />
            {(listener?.responseHeaders?.length ?? 0) > 0 && (
              <div className="mb-3 space-y-1.5">
                <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">
                  Response Headers
                </label>
                <div className="space-y-1.5">
                  {listener?.responseHeaders?.map((h, i) => (
                    <div key={i} className="flex gap-1.5 items-center">
                      <input
                        type="text"
                        readOnly
                        tabIndex={-1}
                        value={h.key}
                        className={`${inputClass} flex-1 min-w-0`}
                      />
                      <input
                        type="text"
                        readOnly
                        tabIndex={-1}
                        value={h.value}
                        className={`${inputClass} flex-1 min-w-0`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <ViewTextField label="Listener response" value={listener?.listenerResponse} />
            <ViewTextField label="Implant request" value={listener?.implantBody} />
          </>
        )}

        {isFileServer && (
          <>
            <ViewField label="Host" value={listener?.host} />
            <ViewField label="Port to Open" value={listener?.port} />
          </>
        )}
      </div>

      <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2 border-t border-[#2a2a2a] p-2">
        <button
          type="button"
          onClick={handleClosePanel}
          className="button-default z-10 flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default ViewListenerPanel;
