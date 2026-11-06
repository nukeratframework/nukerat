import { ChevronRight } from "lucide-react";
import { sanitizeNumericInput } from "@/components/ui/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CertSection, type ListenerFormBodyProps } from "./form";
import {
  useServerDropdown,
  useAdvancedSection,
  getServerOptionLabel,
  truncateServerLabel,
} from "./logic";

type Props = ListenerFormBodyProps & {
  onServerSelect: (host: string, port: string) => void;
};

export default function AddFileServer({ formData, handleFormChange, onServerSelect }: Props) {
  const { servers, selectedId, handleChange } = useServerDropdown(
    formData.host,
    formData.port,
    onServerSelect
  );
  const adv = useAdvancedSection(formData, handleFormChange);

  return (
    <>
      <div className="mb-3 space-y-1.5">
        <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Server</label>
        <Select value={selectedId || undefined} onValueChange={handleChange}>
          <SelectTrigger className="w-full text-[13.5px] bg-[#212121] border-[#363636] text-[#cecece] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0">
            <SelectValue placeholder="Select a server..." />
          </SelectTrigger>
          <SelectContent className="text-[13.5px]">
            {servers.map((s) => (
              <SelectItem
                key={s.id}
                value={s.id}
                className="text-[13.5px]"
              >
                {truncateServerLabel(getServerOptionLabel(s))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-3 space-y-1.5">
        <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Port to Open</label>
        <input
          aria-label="Port to open"
          className="w-full text-[13.5px] bg-[#212121] border border-[#363636] text-[#cecece] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444] tabular-nums"
          value={formData.portToOpen}
          onChange={(e) => handleFormChange("portToOpen", sanitizeNumericInput(e.target.value))}
          placeholder="8000"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="h-px bg-[#252525] mb-4 mt-4" />

      <label className="flex items-center gap-2 mb-3 cursor-pointer">
        <Checkbox
          className="size-[18px] cursor-pointer shrink-0 border-[#454545] data-[state=checked]:border-[#5a5a5a] data-[state=checked]:bg-[#2a2a2a] data-[state=checked]:text-[#cecece]"
          checked={formData.ssl}
          onCheckedChange={(v) => handleFormChange("ssl", v === true)}
        />
        <span className="text-[12px] text-[#6e6e6e] uppercase tracking-widest">SSL</span>
      </label>

      {formData.ssl && (
        <CertSection formData={formData} handleFormChange={handleFormChange} showSubject />
      )}

      <div className="h-px bg-[#252525] mb-4 mt-4" />
      <button
        type="button"
        onClick={adv.toggleExpanded}
        className="button-default flex items-center gap-1.5 w-full mb-3 cursor-pointer"
      >
        <ChevronRight
          size={11}
          className={`text-[#454545] transition-transform duration-150 ${adv.expanded ? "rotate-90" : ""}`}
        />
        <span className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Advanced</span>
      </button>
      {adv.expanded && (
        <div className="pl-3 border-l border-[#252525]">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Response Headers</label>
            <button
              type="button"
              onClick={adv.addHeader}
              className="button-default cursor-pointer text-[17px] text-[#888] hover:text-[#d4d4d4] px-2 rounded border border-[#2f2f2f] hover:border-[#555]"
            >
              +
            </button>
          </div>
          {formData.responseHeaders.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {formData.responseHeaders.map((h, i) => (
                <div key={i} className="flex gap-1.5 items-center">
                  <input
                    className="flex-1 w-full text-[13.5px] bg-[#212121] border border-[#363636] text-[#cecece] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444] tabular-nums"
                    value={h.key}
                    onChange={(e) => adv.updateHeader(i, "key", e.target.value)}
                    placeholder="Header-Name"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <input
                    className="flex-1 w-full text-[13.5px] bg-[#212121] border border-[#363636] text-[#cecece] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444] tabular-nums"
                    value={h.value}
                    onChange={(e) => adv.updateHeader(i, "value", e.target.value)}
                    placeholder="value"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={() => adv.removeHeader(i)}
                    className="button-default cursor-pointer text-[#6b6b6b] hover:text-[#c85555] text-[17px] px-1 shrink-0"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
