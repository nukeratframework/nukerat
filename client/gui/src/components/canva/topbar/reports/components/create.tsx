import { RefreshCw, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  canSubmitReportForm,
  report_file_type_options,
  report_type_options,
  type ReportFormData,
} from "./logic";
import { getServerOptionLabel, truncateServerLabel, useServerDropdown } from "@/components/canva/topbar/listeners/components/logic";
import HostTagSelector from "@/components/canva/utils/host-tag-selector";
import type { Session } from "@/api/sessions";

interface CreateReportPanelProps {
  formData: ReportFormData;
  submitting: boolean;
  serverHosts: Session[];
  handleFormChange: <K extends keyof ReportFormData>(key: K, value: ReportFormData[K]) => void;
  handleServerChange: (host: string, port: string) => void;
  toggleHost: (tag: string) => void;
  selectAllHosts: () => void;
  clearHosts: () => void;
  handleClosePanel: () => void;
  handleSubmitForm: () => void;
}

const ServerSelect = ({
  server,
  onSelect,
}: {
  server: string;
  onSelect: (host: string, port: string) => void;
}) => {
  const [host, port] = server.includes(":") ? server.split(":") : ["", ""];
  const { servers, selectedId, handleChange } = useServerDropdown(host, port, onSelect);

  return (
    <div className="mb-3 space-y-1.5">
      <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Server</label>
      <Select value={selectedId || undefined} onValueChange={handleChange}>
        <SelectTrigger className="w-full bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded h-auto focus:border-[#555] focus-visible:ring-0">
          <SelectValue placeholder="Select a server..." />
        </SelectTrigger>
        <SelectContent>
          {servers.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {truncateServerLabel(getServerOptionLabel(s))}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const CreateReportPanel = ({
  formData,
  submitting,
  serverHosts,
  handleFormChange,
  handleServerChange,
  toggleHost,
  selectAllHosts,
  clearHosts,
  handleClosePanel,
  handleSubmitForm,
}: CreateReportPanelProps) => {
  const submitDisabled = !canSubmitReportForm(formData, submitting);

  return (
    <div className="flex flex-col h-full min-h-0 min-w-[32rem]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0">
        <span className="text-[13.5px] font-semibold text-[#cecece] tracking-wide">New Report</span>
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
            className="w-full bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] transition-colors placeholder:text-[#444]"
            value={formData.name}
            onChange={(e) => handleFormChange("name", e.target.value)}
            placeholder="Report name"
            maxLength={100}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="mb-3 space-y-1.5">
          <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Description</label>
          <textarea
            className="w-full min-h-[4.5rem] bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] transition-colors placeholder:text-[#444] resize-none"
            value={formData.description}
            onChange={(e) => handleFormChange("description", e.target.value)}
            placeholder="Optional report description"
            maxLength={500}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <ServerSelect server={formData.server} onSelect={handleServerChange} />

        <div className="mb-4 space-y-1.5">
          <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Report Type</label>
          <Select
            value={formData.reportType}
            onValueChange={(v) => handleFormChange("reportType", v as ReportFormData["reportType"])}
          >
            <SelectTrigger className="w-full bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded h-auto focus:border-[#555] focus-visible:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {report_type_options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mb-4 space-y-1.5">
          <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">File Type</label>
          <Select
            value={formData.fileType}
            onValueChange={(v) => handleFormChange("fileType", v as ReportFormData["fileType"])}
          >
            <SelectTrigger className="w-full bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded h-auto focus:border-[#555] focus-visible:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {report_file_type_options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {formData.reportType === "activity" && (
          <>
            <div className="mb-5 mt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  className="size-[18px] cursor-pointer shrink-0 border-[#454545] data-[state=checked]:border-[#5a5a5a] data-[state=checked]:bg-[#2a2a2a] data-[state=checked]:text-[#cecece]"
                  checked={formData.hideCredentials}
                  onCheckedChange={(checked) => handleFormChange("hideCredentials", checked === true)}
                />
                <span className="text-[13px] text-[#6e6e6e] tracking-widest">Hide credentials</span>
              </label>
            </div>
          </>
        )}

        {formData.server ? (
          <>
            <div className="h-px bg-[#252525] mb-4" />
            <HostTagSelector
              hosts={serverHosts}
              selectedTags={formData.hostTags}
              onToggle={toggleHost}
              onSelectAll={selectAllHosts}
              onClear={clearHosts}
            />
          </>
        ) : null}
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

export default CreateReportPanel;
