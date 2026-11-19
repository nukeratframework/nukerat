import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { isSocks, isPortForward } = getViewFlags(connection);

  return (
    <div className="flex flex-col h-full min-h-0 min-w-[32rem]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-semibold text-[#cecece] tracking-wide">
            {t("network.view.title", { name: getViewTitle(connection) })}
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
        <ViewField label={t("network.view.tag")} value={connection?.tag ?? connection?.id} />
        <ViewField label={t("network.view.type")} value={typeLabel(connection?.networkType)} />
        <ViewField label={t("network.view.server")} value={connection?.server} />
        <ViewField label={t("network.view.bindHost")} value={connection?.host} />
        <ViewField label={t("network.view.port")} value={connection?.targetPort} />
        <ViewField label={t("network.view.protocol")} value={connection ? formatProtocol(connection) : ""} />
        <ViewField label={t("network.view.implantTag")} value={connection?.hostTag} />

        {isSocks && (
          <>
            <ViewField label={t("network.view.authUser")} value={connection?.authUser} />
            <ViewField label={t("network.view.authPassword")} value={connection?.authPass} />
          </>
        )}

        {isPortForward && (
          <>
            <ViewField label={t("network.view.forward")} value={connection ? formatForward(connection) : ""} />
            <ViewField label={t("network.view.forwardHost")} value={connection?.forwardHost} />
            <ViewField label={t("network.view.forwardPort")} value={connection?.forwardPort} />
          </>
        )}
      </div>

      <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2 border-t border-[#2a2a2a] p-2">
        <button
          type="button"
          onClick={handleClosePanel}
          className="button-default z-10 flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
        >
          {t("network.view.close")}
        </button>
      </div>
    </div>
  );
};

export default ViewNetworkPanel;
