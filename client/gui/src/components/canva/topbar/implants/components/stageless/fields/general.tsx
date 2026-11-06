import { useEffect, useState } from "react";
import { ChevronRight, CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getServers } from "@/api/system/config";
import { ServerDropdown } from "@/components/canva/topbar/listeners/components/form";
import type { ImplantFormChange, ImplantFormData } from "../logic";
import { archOptions, cpuOptions, isExeFormat, isShellcodeFormat } from "../logic";

export default ({
  formData,
  handleFormChange,
}: {
  formData: ImplantFormData;
  handleFormChange: ImplantFormChange;
}) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    getServers()
      .then((servers) => {
        const first = servers[0];
        if (!first) return;
        handleFormChange("teamHost", first.ip);
        handleFormChange("teamPort", first.port);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <div className="space-y-1.5">
        <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Compile server</label>
        <ServerDropdown
          hideLabel
          host={formData.teamHost}
          port={formData.teamPort}
          onSelect={(host, port) => {
            handleFormChange("teamHost", host);
            handleFormChange("teamPort", port);
          }}
        />
      </div>
      
      <Separator className="bg-[#252525] mb-4 mt-2" />

      <div className="mb-3 space-y-1.5">
        <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Operational system</label>
        <Select value={formData.os} onValueChange={(v) => handleFormChange("os", v as ImplantFormData["os"])}>
          <SelectTrigger className="w-auto bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="windows">Windows</SelectItem>
            <SelectItem value="linux">Linux</SelectItem>
            <SelectItem value="macos">macOS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4 space-y-1.5">
        <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Architecture</label>
        <div className="flex gap-2">
          <Select
            value={formData.cpu}
            disabled={formData.os === "windows"}
            onValueChange={(v) => handleFormChange("cpu", v as ImplantFormData["cpu"])}
          >
            <SelectTrigger className="w-auto bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0 disabled:opacity-60 disabled:cursor-not-allowed">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cpuOptions(formData.os).map((cpu) => (
                <SelectItem key={cpu} value={cpu}>
                  {cpu}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={formData.arch} disabled>
            <SelectTrigger className="w-auto bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0 disabled:opacity-60 disabled:cursor-not-allowed">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {archOptions(formData.cpu, formData.os).map((arch) => (
                <SelectItem key={arch} value={arch}>
                  {arch}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-3 space-y-1.5">
        <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Format</label>
        <Select
          value={formData.os === "macos" ? "app" : formData.format}
          disabled={formData.os === "macos"}
          onValueChange={(v) => handleFormChange("format", v as ImplantFormData["format"])}
        >
          <SelectTrigger className="w-auto bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0 disabled:opacity-60 disabled:cursor-not-allowed">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {formData.os === "linux" ? (
              <>
                <SelectItem value="elf">elf</SelectItem>
                <SelectItem value="so">so</SelectItem>
              </>
            ) : formData.os === "macos" ? (
              <>
                <SelectItem value="app">app</SelectItem>
              </>
            ) : (
              <>
                <SelectItem value="exe">exe</SelectItem>
                <SelectItem value="dll">dll</SelectItem>
                <SelectItem value="shellcode">shellcode</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {formData.os === "windows" ? (
        <div className="mt-2 mb-5.5 space-y-1.5">
          <div className="flex items-center gap-2">
            <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Shellcode encoder</label>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center text-[#666] cursor-default select-none" aria-label="Shellcode encoder help">
                  <CircleHelp size={13} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[#3A3A3A] max-w-xs rounded-[6px]">
                <div className="text-xs">
                  For shellcode format builds and migration payloads injected into another process.
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
          <Select
            value={formData.shellcodeEncoder}
            onValueChange={(v) => handleFormChange("shellcodeEncoder", v as ImplantFormData["shellcodeEncoder"])}
          >
            <SelectTrigger className="w-auto bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">off</SelectItem>
              <SelectItem value="sgn">sgn</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {formData.os === "windows" && isExeFormat(formData.format) ? (
        <>
          <Separator className="bg-[#252525] mb-5" />
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <Checkbox
              className="size-[18px] cursor-pointer shrink-0 border-[#454545] data-[state=checked]:border-[#5a5a5a] data-[state=checked]:bg-[#2a2a2a] data-[state=checked]:text-[#cecece]"
              checked={formData.showConhost}
              onCheckedChange={(v) => handleFormChange("showConhost", v === true)}
            />
            <span className="text-[13px] text-[#cecece]">Show conhost window</span>
          </label>
        </>
      ) : null}

      {isShellcodeFormat(formData.format) ? (
        <>
          <Separator className="bg-[#252525] mb-4 mt-1" />
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="button-default flex items-center gap-1.5 w-full mb-3 cursor-pointer"
          >
            <ChevronRight size={11} className={`text-[#454545] transition-transform ${advancedOpen ? "rotate-90" : ""}`} />
            <span className="text-[12px] text-[#6e6e6e] uppercase tracking-widest">Advanced</span>
          </button>
          {advancedOpen ? (
            <div className="pl-3 border-l border-[#252525]">
              <div className="mb-3 space-y-1.5">
                <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Entropy</label>
                <Select value={formData.donutEntropy} onValueChange={(v) => handleFormChange("donutEntropy", v as ImplantFormData["donutEntropy"])}>
                  <SelectTrigger className="w-full bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">none</SelectItem>
                    <SelectItem value="random">random names</SelectItem>
                    <SelectItem value="encrypt">random + encrypt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="mb-3 space-y-1.5">
                <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Compression</label>
                <Select value={formData.donutCompress} onValueChange={(v) => handleFormChange("donutCompress", v as ImplantFormData["donutCompress"])}>
                  <SelectTrigger className="w-full bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">none</SelectItem>
                    <SelectItem value="aplib">aPLib</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="mb-3 space-y-1.5">
                <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">PE headers</label>
                <Select value={formData.donutHeaders} onValueChange={(v) => handleFormChange("donutHeaders", v as ImplantFormData["donutHeaders"])}>
                  <SelectTrigger className="w-full bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overwrite">overwrite</SelectItem>
                    <SelectItem value="keep">keep all</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="mb-3 space-y-1.5">
                <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Exit behavior</label>
                <Select value={formData.donutExit} onValueChange={(v) => handleFormChange("donutExit", v as ImplantFormData["donutExit"])}>
                  <SelectTrigger className="w-full bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thread">exit thread</SelectItem>
                    <SelectItem value="process">exit process</SelectItem>
                    <SelectItem value="block">block indefinitely</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <Checkbox
                  className="size-[18px] cursor-pointer shrink-0 border-[#454545] data-[state=checked]:border-[#5a5a5a] data-[state=checked]:bg-[#2a2a2a] data-[state=checked]:text-[#cecece]"
                  checked={formData.donutThread}
                  onCheckedChange={(v) => handleFormChange("donutThread", v === true)}
                />
                <span className="text-[13px] text-[#cecece]">Run entry as thread</span>
              </label>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
};
