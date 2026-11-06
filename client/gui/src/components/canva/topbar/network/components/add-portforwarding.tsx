import { sanitizeNumericInput } from "@/components/ui/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Session } from "@/api/sessions";
import type { NetworkFormData } from "./logic";

export default function AddPortForwarding({
  formData,
  handleFormChange,
  hostGroups,
  hostsLoading,
}: {
  formData: NetworkFormData;
  handleFormChange: <K extends keyof NetworkFormData>(key: K, value: NetworkFormData[K]) => void;
  hostGroups: Record<string, Session[]>;
  hostsLoading: boolean;
}) {
  return (
    <>
      <div className="mb-3 space-y-1.5">
        <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Host tag</label>
        <Select value={formData.hostTag} onValueChange={(v) => handleFormChange("hostTag", v)} disabled={hostsLoading}>
          <SelectTrigger className="w-full bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded h-auto focus:border-[#555] focus-visible:ring-0">
            <SelectValue placeholder={hostsLoading ? "Loading hosts..." : "Select host"} />
          </SelectTrigger>
          <SelectContent>
            {!hostsLoading && Object.keys(hostGroups).length === 0 && (
              <SelectItem value="__empty" disabled>No hosts found</SelectItem>
            )}
            {Object.entries(hostGroups).map(([server, serverHosts]) => (
              <SelectGroup key={server}>
                <SelectLabel>{server}</SelectLabel>
                {serverHosts.map((host) => (
                  <SelectItem key={host.id} value={host.tag?.trim() || String(host.id)}>
                    {host.tag || host.ip}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <div className="mb-3 space-y-1.5 flex-1">
          <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Listen port</label>
          <input
            className="w-full bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] transition-colors placeholder:text-[#444] tabular-nums"
            value={formData.targetPort}
            onChange={(e) => handleFormChange("targetPort", sanitizeNumericInput(e.target.value))}
            placeholder="4444"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="w-28 mb-3 space-y-1.5">
          <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Protocol</label>
          <Select value={formData.protocol} onValueChange={(v) => handleFormChange("protocol", v as NetworkFormData["protocol"])}>
            <SelectTrigger className="w-full bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded h-auto focus:border-[#555] focus-visible:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tcp">TCP</SelectItem>
              <SelectItem value="udp">UDP</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="mb-3 space-y-1.5 flex-1">
          <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Forward host</label>
          <input
            className="w-full bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] transition-colors placeholder:text-[#444]"
            value={formData.forwardHost}
            onChange={(e) => handleFormChange("forwardHost", e.target.value)}
            placeholder="10.0.0.5"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="mb-3 space-y-1.5 w-[10rem]">
          <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Forward port</label>
          <input
            className="w-full bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] transition-colors placeholder:text-[#444] tabular-nums"
            value={formData.forwardPort}
            onChange={(e) => handleFormChange("forwardPort", sanitizeNumericInput(e.target.value))}
            placeholder="3389"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>
    </>
  );
}
