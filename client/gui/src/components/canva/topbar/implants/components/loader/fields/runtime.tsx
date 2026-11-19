import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TriangleAlertIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ImplantFormChange, ImplantFormData } from "../logic";
import { sleepMaskOptions, usesWindowsRuntime } from "../logic";

export default ({
  formData,
  handleFormChange,
}: {
  formData: ImplantFormData;
  handleFormChange: ImplantFormChange;
}) => {
  const { t } = useTranslation();
  const windowsRuntime = usesWindowsRuntime(formData.os);

  return (
  <div className="space-y-4">
    {windowsRuntime ? (
      <>
    <div className="mb-3 space-y-1.5">
      <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">{t("implants.fields.apiResolution")}</label>
      <Select value={formData.apiResolution} disabled>
        <SelectTrigger className="w-[11rem] bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0 disabled:opacity-60 disabled:cursor-not-allowed">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="dynamic">{t("implants.options.dynamicLoading")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div className="mb-3 space-y-1.5">
      <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">{t("implants.fields.winApiMethod")}</label>
      <Select value={formData.winApiMethod} disabled>
        <SelectTrigger className="w-[11rem] bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0 disabled:opacity-60 disabled:cursor-not-allowed">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="indirect">{t("implants.options.indirectSyscall")}</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <Separator className="bg-[#252525] mb-4 mt-4" />

    <label className="flex items-center gap-2 mb-3 cursor-pointer">
      <Checkbox
        className="size-[18px] cursor-pointer shrink-0 border-[#454545] data-[state=checked]:border-[#5a5a5a] data-[state=checked]:bg-[#2a2a2a] data-[state=checked]:text-[#cecece]"
        checked={formData.etwPatch === "on"}
        onCheckedChange={(v) => handleFormChange("etwPatch", v === true ? "on" : "off")}
      />
      <span className="text-[13px] text-[#cecece]">{t("implants.fields.etwPatch")}</span>
    </label>
    <label className="flex items-center gap-2 mb-3 cursor-pointer">
      <Checkbox
        className="size-[18px] cursor-pointer shrink-0 border-[#454545] data-[state=checked]:border-[#5a5a5a] data-[state=checked]:bg-[#2a2a2a] data-[state=checked]:text-[#cecece]"
        checked={formData.amsiPatch === "on"}
        onCheckedChange={(v) => handleFormChange("amsiPatch", v === true ? "on" : "off")}
      />
      <span className="text-[13px] text-[#cecece]">{t("implants.fields.amsiPatch")}</span>
    </label>

    <Separator className="bg-[#252525] mb-4 mt-4" />

    <div className="mb-3 space-y-1.5">
      <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">{t("implants.fields.sleepMask")}</label>
      <Select value={formData.sleepMask} onValueChange={(v) => handleFormChange("sleepMask", v as ImplantFormData["sleepMask"])}>
        <SelectTrigger className="w-[6rem] bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sleepMaskOptions.map(({ value, label, labelKey }) => (
            <SelectItem key={value} value={value}>
              {labelKey ? t(labelKey) : label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    {formData.sleepMask !== "off" ? (
      <Alert className="mb-3 border-[#5c4a2a] bg-[#2a2419] text-[#e0a84b] [&_[data-slot=alert-description]]:text-[#9a9080]">
        <TriangleAlertIcon />
        <AlertDescription>{t("implants.help.sleepMask")}</AlertDescription>
      </Alert>
    ) : null}

    <Separator className="bg-[#252525] mb-4 mt-4" />
      </>
    ) : null}

    <div className="mb-3 space-y-1.5">
      <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">{t("implants.fields.stringObfuscation")}</label>
      <Select value={formData.stringObfuscation} onValueChange={(v) => handleFormChange("stringObfuscation", v as ImplantFormData["stringObfuscation"])}>
        <SelectTrigger className="w-auto bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="off">{t("implants.options.off")}</SelectItem>
          <SelectItem value="xor">{t("implants.options.xor")}</SelectItem>
          <SelectItem value="rc4">RC4</SelectItem>
        </SelectContent>
      </Select>
    </div>

    {windowsRuntime ? (
      <>
    <Separator className="bg-[#252525] mb-4 mt-4" />

    <label className="flex items-center gap-2 mb-3 cursor-pointer">
      <Checkbox
        className="size-[18px] cursor-pointer shrink-0 border-[#454545] data-[state=checked]:border-[#5a5a5a] data-[state=checked]:bg-[#2a2a2a] data-[state=checked]:text-[#cecece]"
        checked={formData.peHeadersPatch === "on"}
        onCheckedChange={(v) => handleFormChange("peHeadersPatch", v === true ? "on" : "off")}
      />
      <span className="text-[13px] text-[#cecece]">{t("implants.fields.wipePeHeaders")}</span>
    </label>
      </>
    ) : null}
  </div>
  );
};
