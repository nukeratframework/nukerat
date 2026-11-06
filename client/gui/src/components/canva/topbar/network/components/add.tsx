import { type ComponentType } from "react";
import { X, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ServerDropdown } from "@/components/canva/topbar/listeners/components/form";
import type { NetworkFormData } from "./logic";
import AddPortForwarding from "./add-portforwarding";
import AddSocks from "./add-socks";

type TypeFormProps = {
  formData: NetworkFormData;
  handleFormChange: <K extends keyof NetworkFormData>(key: K, value: NetworkFormData[K]) => void;
  hostGroups: Record<string, import("@/api/sessions").Session[]>;
  hostsLoading: boolean;
};

const typeForms: Record<NetworkFormData["networkType"], ComponentType<TypeFormProps>> = {
  port_forwarding: AddPortForwarding,
  socks: AddSocks,
};

export default function AddNetworkPanel({
  formData,
  handleFormChange,
  submitting,
  handleClosePanel,
  handleSubmitForm,
  hostGroups = {},
  hostsLoading = false,
}: {
  formData: NetworkFormData;
  handleFormChange: <K extends keyof NetworkFormData>(key: K, value: NetworkFormData[K]) => void;
  submitting: boolean;
  handleClosePanel: () => void;
  handleSubmitForm: () => void;
  hostGroups?: Record<string, import("@/api/sessions").Session[]>;
  hostsLoading?: boolean;
}) {
  const port = Number(formData.targetPort);
  const badPort = !formData.targetPort.trim() || port < 1 || port > 65535;
  const fwd = Number(formData.forwardPort);
  const badFwd = formData.networkType === "port_forwarding" && (!formData.forwardPort.trim() || fwd < 1 || fwd > 65535);
  const submitDisabled =
    submitting ||
    !formData.host.trim() ||
    !formData.port.trim() ||
    badPort ||
    badFwd ||
    (formData.networkType === "socks" && !formData.hostTag.trim()) ||
    (formData.networkType === "port_forwarding" && (!formData.hostTag.trim() || !formData.forwardHost.trim()));
  const TypeForm = typeForms[formData.networkType];

  return (
    <div className="flex flex-col h-full min-h-0 min-w-[32rem]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0">
        <span className="text-[13.5px] font-semibold text-[#cecece] tracking-wide">
          New Connection
        </span>
        <button
          onClick={handleClosePanel}
          className="button-default p-1 rounded text-[#6b6b6b] hover:text-[#d4d4d4] hover:bg-[#2a2a2a] transition-colors cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-4 py-4">
        <ServerDropdown
          host={formData.host}
          port={formData.port}
          onSelect={(h, p) => {
            handleFormChange("host", h);
            handleFormChange("port", p);
          }}
        />

        <div className="mb-4 space-y-1.5">
          <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Type</label>
          <Select
            value={formData.networkType}
            onValueChange={(v) =>
              handleFormChange("networkType", v as NetworkFormData["networkType"])
            }
          >
            <SelectTrigger className="w-full bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded h-auto focus:border-[#555] focus-visible:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="port_forwarding">port forwarding</SelectItem>
              <SelectItem value="socks">socks</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TypeForm
          formData={formData}
          handleFormChange={handleFormChange}
          hostGroups={hostGroups}
          hostsLoading={hostsLoading}
        />
      </div>

      <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2 border-t border-[#2a2a2a] p-2">
        <button
          type="button"
          onClick={handleClosePanel}
          className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmitForm}
          disabled={submitDisabled}
          className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
        >
          {submitting && <RefreshCw size={10} className="animate-spin" />}
          Create
        </button>
      </div>
    </div>
  );
}
