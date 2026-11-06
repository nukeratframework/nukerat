import { useRef } from "react";
import { CircleHelp, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/components/ui/attachment";
import { sanitizeDigitsInput, sanitizeNumericInput } from "@/components/ui/lib/utils";
import {
  createImplantAttachmentHandler,
  formatAttachmentSize,
  attachmentByteLength,
  isDllFormat,
  isExeFormat,
  usesNimCompile,
  usesPeHeaders,
  peHeaderPlaceholders,
  type ImplantFormChange,
  type ImplantFormData,
} from "../logic";
import StringsEditor from "./editor/strings";
import { PeTimestampField } from "../../logic";

export default ({
  formData,
  handleFormChange,
}: {
  formData: ImplantFormData;
  handleFormChange: ImplantFormChange;
}) => {
  const iconRef = useRef<HTMLInputElement>(null);
  const onIcon = createImplantAttachmentHandler("exeIcon", handleFormChange);
  return (
    <div className="space-y-4">
      {isExeFormat(formData.format) ? (
        <div className="mb-3 space-y-1.5">
          <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">EXE icon</label>
          <input
            ref={iconRef}
            type="file"
            accept=".ico"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onIcon(file);
              e.target.value = "";
            }}
          />
          <Attachment state={formData.exeIcon ? "done" : "idle"} className="w-full border-[#363636] bg-[#212121]">
            <AttachmentContent>
              <AttachmentTitle className="text-[#4e4e4e] text-[13px] truncate">
                {formData.exeIcon?.name ?? "Choose file"}
              </AttachmentTitle>
            </AttachmentContent>
            <AttachmentDescription className="text-[#4e4e4e]">
              {formData.exeIcon ? formatAttachmentSize(attachmentByteLength(formData.exeIcon)) : "No file selected"}
            </AttachmentDescription>
            {formData.exeIcon ? (
              <AttachmentActions>
                <AttachmentAction type="button" onClick={() => handleFormChange("exeIcon", null)} className="text-[#888] hover:text-[#cecece]">
                  <X className="size-3.5" />
                </AttachmentAction>
              </AttachmentActions>
            ) : (
              <AttachmentTrigger type="button" className="cursor-pointer" onClick={() => iconRef.current?.click()} />
            )}
          </Attachment>
        </div>
      ) : null}

      {isExeFormat(formData.format) || isDllFormat(formData.format) ? (
        <>
          <Separator className="bg-[#252525] mb-4 mt-4" />

          {usesNimCompile(formData.format) ? (
            <div className="mb-3 space-y-3">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    className="size-[18px] cursor-pointer shrink-0 border-[#454545] data-[state=checked]:border-[#5a5a5a] data-[state=checked]:bg-[#2a2a2a] data-[state=checked]:text-[#cecece]"
                    checked={formData.customCopyPeStrings}
                    onCheckedChange={(v) => handleFormChange("customCopyPeStrings", v === true)}
                  />
                  <span className="text-[13px] text-[#cecece]">PE strings</span>
                </label>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center text-[#666] cursor-default select-none" aria-label="PE strings help">
                      <CircleHelp size={13} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-[#3A3A3A] max-w-xs rounded-[6px]">
                    <div className="text-xs">
                      Embeds decoy values into PE sections at build.
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div
                className={`border border-[#363636] rounded bg-[#0e0e0e] overflow-hidden ${
                  formData.customCopyPeStrings ? "focus-within:border-[#555]" : "opacity-50"
                }`}
              >
                <StringsEditor
                  disabled={!formData.customCopyPeStrings}
                  value={formData.copyPeStrings}
                  onChange={(value) => handleFormChange("copyPeStrings", value)}
                />
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {usesPeHeaders(formData.format) ? (
        <>
          <Separator className="bg-[#252525] mb-4 mt-4" />

          <div className="mb-3 space-y-3">
            <div className="space-y-1.5">
              <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">TimeDateStamp</label>
              <PeTimestampField
                value={formData.peTimestampDate}
                onChange={(iso) => handleFormChange("peTimestampDate", iso)}
              />
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-1.5">
                <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Linker major</label>
                <input
                  className="w-full tabular-nums bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444]"
                  value={formData.peMajorLinkerVersion}
                  onChange={(e) =>
                    handleFormChange("peMajorLinkerVersion", sanitizeNumericInput(e.target.value, 255))
                  }
                  placeholder={peHeaderPlaceholders.peMajorLinkerVersion}
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Linker minor</label>
                <input
                  className="w-full tabular-nums bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444]"
                  value={formData.peMinorLinkerVersion}
                  onChange={(e) =>
                    handleFormChange("peMinorLinkerVersion", sanitizeNumericInput(e.target.value, 255))
                  }
                  placeholder={peHeaderPlaceholders.peMinorLinkerVersion}
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">OS major</label>
                <input
                  className="w-full tabular-nums bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444]"
                  value={formData.peMajorOsVersion}
                  onChange={(e) =>
                    handleFormChange("peMajorOsVersion", sanitizeDigitsInput(e.target.value))
                  }
                  placeholder={peHeaderPlaceholders.peMajorOsVersion}
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">OS minor</label>
                <input
                  className="w-full tabular-nums bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444]"
                  value={formData.peMinorOsVersion}
                  onChange={(e) =>
                    handleFormChange("peMinorOsVersion", sanitizeDigitsInput(e.target.value))
                  }
                  placeholder={peHeaderPlaceholders.peMinorOsVersion}
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Image major</label>
                <input
                  className="w-full tabular-nums bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444]"
                  value={formData.peMajorImageVersion}
                  onChange={(e) =>
                    handleFormChange("peMajorImageVersion", sanitizeDigitsInput(e.target.value))
                  }
                  placeholder={peHeaderPlaceholders.peMajorImageVersion}
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Image minor</label>
                <input
                  className="w-full tabular-nums bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444]"
                  value={formData.peMinorImageVersion}
                  onChange={(e) =>
                    handleFormChange("peMinorImageVersion", sanitizeDigitsInput(e.target.value))
                  }
                  placeholder={peHeaderPlaceholders.peMinorImageVersion}
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Subsystem major</label>
                <input
                  className="w-full tabular-nums bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444]"
                  value={formData.peMajorSubsystemVersion}
                  onChange={(e) =>
                    handleFormChange("peMajorSubsystemVersion", sanitizeDigitsInput(e.target.value))
                  }
                  placeholder={peHeaderPlaceholders.peMajorSubsystemVersion}
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Subsystem minor</label>
                <input
                  className="w-full tabular-nums bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444]"
                  value={formData.peMinorSubsystemVersion}
                  onChange={(e) =>
                    handleFormChange("peMinorSubsystemVersion", sanitizeDigitsInput(e.target.value))
                  }
                  placeholder={peHeaderPlaceholders.peMinorSubsystemVersion}
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
