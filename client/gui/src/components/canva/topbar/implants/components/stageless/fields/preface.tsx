import { CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import PrefaceEditor from "./editor/preface";
import { usesGoSource, type ImplantFormChange, type ImplantFormData } from "../logic";

export default ({
  formData,
  handleFormChange,
}: {
  formData: ImplantFormData;
  handleFormChange: ImplantFormChange;
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            className="size-[18px] cursor-pointer shrink-0 border-[#454545] data-[state=checked]:border-[#5a5a5a] data-[state=checked]:bg-[#2a2a2a] data-[state=checked]:text-[#cecece]"
            checked={formData.customPreface}
            onCheckedChange={(v) => handleFormChange("customPreface", v === true)}
          />
          <span className="text-[13px] text-[#cecece]">{t("implants.fields.customPreface")}</span>
        </label>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center text-[#666] cursor-default select-none" aria-label={t("implants.aria.prefaceHelp")}>
              <CircleHelp size={13} />
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-[#3A3A3A] max-w-xs rounded-[6px]">
            <div className="text-xs">
              {usesGoSource(formData.os)
                ? t("implants.help.prefaceGo")
                : t("implants.help.prefaceNim")}
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-[#363636] bg-[#0e0e0e] ${
          formData.customPreface ? "focus-within:border-[#555]" : "opacity-50"
        }`}
      >
        <PrefaceEditor
          fill
          language={usesGoSource(formData.os) ? "go" : "nim"}
          disabled={!formData.customPreface}
          value={formData.preface}
          onChange={(value) => handleFormChange("preface", value)}
        />
      </div>
    </div>
  );
};
