import { X } from "lucide-react";
import type { Connection } from "./logic";
import {
  formatForward,
  formatProtocol,
  getViewFlags,
  getViewTitle,
  typeLabel,
} from "./logic";

export interface ViewNetworkPanelProps {
  connection: Connection | null;
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

const ViewNetworkPanel = ({ connection, handleClosePanel }: ViewNetworkPanelProps) => {
  const { isSocks, isPortForward } = getViewFlags(connection);

  return (
    <div className="flex flex-col h-full min-h-0 min-w-[32rem]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-semibold text-[#cecece] tracking-wide">
            View - {getViewTitle(connection)}
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
        <ViewField label="Tag" value={connection?.tag ?? connection?.id} />
        <ViewField label="Type" value={typeLabel(connection?.networkType)} />
        <ViewField label="Server" value={connection?.server} />
        <ViewField label="Bind Host" value={connection?.host} />
        <ViewField label="Port" value={connection?.targetPort} />
        <ViewField label="Protocol" value={connection ? formatProtocol(connection) : ""} />
        <ViewField label="Implant Tag" value={connection?.hostTag} />

        {isSocks && (
          <>
            <ViewField label="Auth User" value={connection?.authUser} />
            <ViewField label="Auth Password" value={connection?.authPass} />
          </>
        )}

        {isPortForward && (
          <>
            <ViewField label="Forward" value={connection ? formatForward(connection) : ""} />
            <ViewField label="Forward Host" value={connection?.forwardHost} />
            <ViewField label="Forward Port" value={connection?.forwardPort} />
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

export default ViewNetworkPanel;
