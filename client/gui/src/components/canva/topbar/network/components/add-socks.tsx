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

export default function AddSocks({
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
      <div className="mb-3 space-y-1.5">
        <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Port target</label>
        <input
          className="w-[10rem] bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] transition-colors placeholder:text-[#444] tabular-nums"
          value={formData.targetPort}
          onChange={(e) => handleFormChange("targetPort", sanitizeNumericInput(e.target.value))}
          placeholder="8080"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="flex gap-2">
        <div className="mb-3 space-y-1.5 flex-1">
          <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">User</label>
          <input
            className="w-full bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] transition-colors placeholder:text-[#444]"
            value={formData.authUser}
            onChange={(e) => handleFormChange("authUser", e.target.value)}
            placeholder="optional"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="mb-3 space-y-1.5 flex-1">
          <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Password</label>
          <input
            className="w-full bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] transition-colors placeholder:text-[#444]"
            value={formData.authPass}
            onChange={(e) => handleFormChange("authPass", e.target.value)}
            placeholder="optional"
            type="password"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>
    </>
  );
}
