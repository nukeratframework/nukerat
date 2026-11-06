import type { ComponentType } from "react";
import { X, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChannelPayload, ListenerType } from "./logic";
import type { ListenerFormBodyProps } from "./form";
import {
  createServerSelectHandler,
  getAddFormFlags,
  isAddSubmitDisabled,
  CHANNEL_OPTIONS,
} from "./logic";
import AddHttpChannel from "./add-http";
import AddHttpsChannel from "./add-https";
import AddFileServer from "./add-file-server";

export interface AddListenerPanelProps extends ListenerFormBodyProps {
  submitting: boolean;
  handleClosePanel: () => void;
  handleSubmitForm: () => void;
}

const channelForms: Record<ChannelPayload, ComponentType<ListenerFormBodyProps & { onServerSelect: (h: string, p: string) => void }>> = {
  http: AddHttpChannel,
  https: AddHttpsChannel,
};

const AddListenerPanel = ({
  submitting,
  handleClosePanel,
  handleSubmitForm,
  formData,
  handleFormChange,
}: AddListenerPanelProps) => {
  const handleServerSelect = createServerSelectHandler(handleFormChange);
  const { isChannel, isFileServer, cp } = getAddFormFlags(formData);
  const submitDisabled = isAddSubmitDisabled(formData, submitting);
  const ChannelForm = isChannel ? channelForms[cp] : null;

  return (
    <div className="flex flex-col h-full min-h-0 min-w-[32rem]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-semibold text-[#cecece] tracking-wide">
            New Listener
          </span>
        </div>
        <button
          onClick={handleClosePanel}
          className="button-default p-1 rounded text-[#6b6b6b] hover:text-[#d4d4d4] hover:bg-[#2a2a2a] transition-colors cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-4 py-4">
        <div className="mb-3 space-y-1.5">
          <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Name</label>
          <input
            className="w-full text-[13.5px] bg-[#212121] border border-[#363636] text-[#cecece] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444]"
            value={formData.name}
            onChange={(e) => handleFormChange("name", e.target.value)}
            placeholder="Listener name"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="mb-3 space-y-1.5">
          <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Type</label>
          <Select
            value={formData.listenerType}
            onValueChange={(v) => handleFormChange("listenerType", v as ListenerType)}
          >
            <SelectTrigger className="w-full text-[13.5px] bg-[#212121] border-[#363636] text-[#cecece] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="text-[13.5px]">
              <SelectItem value="channel" className="text-[13.5px]">Channel</SelectItem>
              <SelectItem value="file_server" className="text-[13.5px]">File server</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="h-px bg-[#252525] mb-4 mt-4" />

        {isChannel && (
          <>
            <div className="mb-3 space-y-1.5">
              <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Channel</label>
              <Select
                value={cp}
                onValueChange={(v) => handleFormChange("channelPayload", v as ChannelPayload)}
              >
                <SelectTrigger className="w-full text-[13.5px] bg-[#212121] border-[#363636] text-[#cecece] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-[13.5px]">
                  {CHANNEL_OPTIONS.map(([opt, label]) => (
                    <SelectItem key={opt} value={opt} className="text-[13.5px]">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="h-px bg-[#252525] mb-4 mt-4" />
            {ChannelForm && (
              <ChannelForm
                formData={formData}
                handleFormChange={handleFormChange}
                onServerSelect={handleServerSelect}
              />
            )}
          </>
        )}

        {isFileServer && (
          <AddFileServer
            formData={formData}
            handleFormChange={handleFormChange}
            onServerSelect={handleServerSelect}
          />
        )}

        <div className="h-6" />
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
};

export default AddListenerPanel;
