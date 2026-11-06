import ChannelEditor from "./editor/channel";
import { sanitizeDigitsInput, sanitizeNumericInput } from "@/components/ui/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KeyValueEditor } from "@/components/ui/key-value-editor";
import {
  loaderStagePayloadHint,
  loaderStageUrlPlaceholder,
  usesGoSource,
  type ImplantFormChange,
  type ImplantFormData,
  type Protocol,
} from "../logic";

export default function StageFields({
  formData,
  handleFormChange,
}: {
  formData: ImplantFormData;
  handleFormChange: ImplantFormChange;
}) {
  return (
  <>
    <div className="mb-3 space-y-1.5">
      <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Channel</label>
      <Select value={formData.protocol} onValueChange={(v) => handleFormChange("protocol", v as Protocol)}>
        <SelectTrigger className="w-auto text-[13.5px] bg-[#212121] border-[#363636] text-[#cecece] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel className="text-[11px] text-[#6e6e6e] uppercase">external</SelectLabel>
            <SelectItem value="http">http</SelectItem>
            <SelectItem value="custom">custom</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>

    {formData.protocol === "custom" ? (
      <div className="flex min-h-0 flex-1 flex-col space-y-1.5">
        <div className="flex min-h-0 flex-1 flex-col border border-[#363636] rounded bg-[#0e0e0e] focus-within:border-[#555] overflow-hidden">
          <ChannelEditor
            fill
            language={usesGoSource(formData.os) ? "go" : "nim"}
            value={formData.customChannel}
            onChange={(value) => handleFormChange("customChannel", value)}
          />
        </div>
      </div>
    ) : (
    <>
    <Separator className="bg-[#252525] mb-4 mt-2" />

    <div className="mb-3 space-y-1.5">
      <div className="flex items-baseline gap-1">
        <label className="text-[12px] text-[#6e6e6e] uppercase tracking-widest">URL</label>
        <span className="text-[12px] text-[#414141] tracking-normal">
          {loaderStagePayloadHint(formData.os)}
        </span>
      </div>
      <input
        className="w-[28rem] font-sans text-[13.5px] bg-[#212121] border border-[#363636] text-[#cecece] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444]"
        value={formData.stageUrl}
        onChange={(e) => handleFormChange("stageUrl", e.target.value)}
        placeholder={loaderStageUrlPlaceholder(formData.os)}
        autoComplete="off"
        spellCheck={false}
      />
    </div>

    <div className="mb-3 space-y-1.5">
      <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Delay (seconds)</label>
      <input
        className="w-[5rem] text-[13.5px] bg-[#212121] border border-[#363636] text-[#cecece] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444] tabular-nums"
        value={formData.sleep}
        onChange={(e) => handleFormChange("sleep", sanitizeDigitsInput(e.target.value))}
        placeholder="60"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
      />
    </div>

    <div className="mb-3 space-y-1.5">
      <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Jitter (%)</label>
      <input
        className="w-[5rem] text-[13.5px] bg-[#212121] border border-[#363636] text-[#cecece] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444] tabular-nums"
        value={formData.delay}
        onChange={(e) => handleFormChange("delay", sanitizeNumericInput(e.target.value, 100))}
        placeholder="20"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
      />
    </div>

    <Separator className="bg-[#252525] mb-4 mt-4" />
    <KeyValueEditor
      className="implant-kv-table mb-3"
      label="Custom headers"
      items={formData.customHeaders}
      onChange={(next) => handleFormChange("customHeaders", next)}
      keyPlaceholder="Header"
      valuePlaceholder="Value"
    />
    </>
    )}
  </>
  );
}
