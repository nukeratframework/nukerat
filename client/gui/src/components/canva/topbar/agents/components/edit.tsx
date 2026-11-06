import { X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ServerDropdown } from "@/components/canva/topbar/listeners/components/form";
import { KeyValueEditor } from "@/components/ui/key-value-editor";
import { Separator } from "@/components/ui/separator";
import {
  canSubmitAgentForm,
  type AgentFormPanelProps,
  type AgentType,
} from "./logic";

const kvRowButtonClass =
  "button-default inline-flex h-[25px] w-[90px] items-center justify-center gap-1.5 rounded border border-[#333] bg-[#232323] p-0 text-[12px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#cecece] transition-colors cursor-pointer";

const AgentFormPanel = ({
  mode,
  selectedName,
  formData,
  editBaseline,
  submitting,
  handleClosePanel,
  handleSubmitForm,
  handleFormChange,
}: AgentFormPanelProps) => {
  return (
    <div className="flex flex-col h-full min-h-0 min-w-[32rem]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0">
        <span className="text-[13.5px] font-medium text-[#cecece] tracking-wide">
          {mode === "add" ? "New Agent" : `Edit - ${selectedName ?? ""}`}
        </span>
        <button
          onClick={handleClosePanel}
          className="button-default p-1 rounded text-[#888888] hover:text-[#d4d4d4] hover:bg-[#2a2a2a] transition-colors cursor-pointer"
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
            placeholder="Agent name"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <ServerDropdown
          host={formData.host}
          port={formData.port}
          onSelect={(host, port) => {
            handleFormChange("host", host);
            handleFormChange("port", port);
          }}
        />

        <div className="mb-4 space-y-1.5">
          <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Type</label>
          <Select
            value={formData.type}
            onValueChange={(v) => handleFormChange("type", v as AgentType)}
          >
            <SelectTrigger className="w-full bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded h-auto focus:border-[#555] focus-visible:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">Custom</SelectItem>
              <SelectItem value="deepseek">DeepSeek</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formData.type === "deepseek" ? (
          <div className="space-y-1.5">
            <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">API Key</label>
            <input
              className="w-full bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] transition-colors placeholder:text-[#444] font-mono"
              value={formData.apiKey}
              onChange={(e) => handleFormChange("apiKey", e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ) : (
          <>
            <div className="mb-3 space-y-1.5">
              <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Endpoint</label>
              <input
                className="w-full bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] transition-colors placeholder:text-[#444]"
                value={formData.endpoint}
                onChange={(e) => handleFormChange("endpoint", e.target.value)}
                placeholder="https://api.example.com/v1/chat"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="mb-3 space-y-1.5">
              <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Request Body</label>
              <textarea
                className="w-full bg-[#212121] border border-[#363636] h-[12rem] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] transition-colors placeholder:text-[#444] resize-w ![font-family:'Mona_Sans_Mono',ui-monospace,monospace] leading-relaxed"
                value={formData.bodyTemplate}
                onChange={(e) => handleFormChange("bodyTemplate", e.target.value)}
                placeholder='{"model":"gpt-4o-mini","messages":[{"role":"system","content":"..."},{"role":"user","content":"..."}]}'
                autoComplete="off"
                spellCheck={false}
              />
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleFormChange("bodyTemplate", "")}
                  style={{width: "70px"}}
                  className={kvRowButtonClass}
                >
                  Clear
                </button>
                <button
                  type="button"
                  style={{width: "80px"}}
                  onClick={() => {
                    try {
                      handleFormChange(
                        "bodyTemplate",
                        JSON.stringify(JSON.parse(formData.bodyTemplate), null, 4)
                      );
                    } catch {
                      toast.error("Invalid JSON");
                    }
                  }}
                  className={kvRowButtonClass}
                >
                  Format
                </button>
              </div>
            </div>
            <Separator className="bg-[#252525] mb-4 mt-4" />
            <KeyValueEditor
              className="implant-kv-table mb-4"
              label="Custom headers"
              items={formData.headers}
              onChange={(next) => handleFormChange("headers", next)}
              keyPlaceholder="Header"
              valuePlaceholder="Value"
            />
            <KeyValueEditor
              className="implant-kv-table mb-3"
              label="Custom cookies"
              items={formData.cookies}
              onChange={(next) => handleFormChange("cookies", next)}
              keyPlaceholder="Cookie"
              valuePlaceholder="Value"
            />
            <div className="space-y-1.5">
              <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Response Field</label>
              <input
                className="w-full bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] transition-colors placeholder:text-[#444] font-mono"
                value={formData.responseField}
                onChange={(e) => handleFormChange("responseField", e.target.value)}
                placeholder="choices[0].message.content"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2 border-t border-[#252525] p-2">
        <button
          type="button"
          onClick={handleClosePanel}
          className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#444] bg-[#232323] px-3 text-[13px] text-[#c8c8c8] hover:bg-[#2b2b2b] cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmitForm}
          disabled={!canSubmitAgentForm(formData, mode, editBaseline) || submitting}
          className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#444] bg-[#232323] px-3 text-[13px] text-[#c8c8c8] hover:bg-[#2b2b2b] cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
        >
          {submitting && <RefreshCw size={10} className="animate-spin" />}
          {mode === "add" ? "Create" : "Save"}
        </button>
      </div>
    </div>
  );
};

export default AgentFormPanel;
