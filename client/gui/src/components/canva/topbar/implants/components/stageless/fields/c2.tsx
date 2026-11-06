import CustomChannelFields from "./custom_channel";
import { sanitizeDigitsInput, sanitizeNumericInput } from "@/components/ui/lib/utils";
import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  formatServerEndpoint,
  isHttpProtocol,
  smbRelaySupported,
  useRequestBodyMarkers,
  useServerDraft,
  type ImplantFormChange,
  type ImplantFormData,
  type Protocol,
} from "../logic";

export default function C2Fields({
  formData,
  handleFormChange,
}: {
  formData: ImplantFormData;
  handleFormChange: ImplantFormChange;
}) {
  const { entries, url, setUrl, canAdd, add, remove } = useServerDraft(
    formData.servers,
    (servers) => handleFormChange("servers", servers),
  );
  const serverScheme = formData.protocol === "https" ? "https" : "http";
  const tryAdd = () => {
    if (!canAdd) return;
    const v = url.trim();
    if (/^https:\/\//i.test(v)) handleFormChange("protocol", "https");
    else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) handleFormChange("protocol", "http");
    add();
  };
  const tcpServer = formData.servers[0] ?? { host: "", port: "", path: "/" };
  const { bodyRef, addMarker, clearMarkers } = useRequestBodyMarkers(
    formData.requestBody,
    (next) => handleFormChange("requestBody", next),
  );
  const setTcpServer = (host: string, port: string) => {
    handleFormChange("servers", host.trim() || port.trim() ? [{ host, port, path: "/" }] : []);
  };

  const channelProtocolValue = isHttpProtocol(formData.protocol) ? "http" : formData.protocol;
  const onChannelProtocolChange = (v: string) => {
    if (v === "http") handleFormChange("protocol", "http");
    else handleFormChange("protocol", v as Protocol);
  };

  const channelSelect = (
    <div className="mb-3 shrink-0 space-y-1.5">
      <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Channel</label>
      <Select value={channelProtocolValue} onValueChange={onChannelProtocolChange}>
        <SelectTrigger className="w-auto text-[13.5px] bg-[#212121] border-[#363636] text-[#cecece] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel className="text-[11px] text-[#6e6e6e] uppercase">external</SelectLabel>
            <SelectItem value="http">http</SelectItem>
            <SelectItem value="custom">custom</SelectItem>
          </SelectGroup>
          <SelectGroup>
            <SelectLabel className="text-[11px] text-[#6e6e6e] uppercase">pivoting</SelectLabel>
            {smbRelaySupported(formData.os) ? <SelectItem value="smb">smb</SelectItem> : null}
            <SelectItem value="tcp">tcp</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );

  if (formData.protocol === "custom") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {channelSelect}
        <CustomChannelFields formData={formData} handleFormChange={handleFormChange} />
      </div>
    );
  }

  return (
  <>
    {channelSelect}
    <Separator className="bg-[#252525] mb-4 mt-2" />

    <div className="mb-3 space-y-1.5">
      <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">
        {formData.protocol === "smb" || formData.protocol === "tcp" ? "Relay implant" : "Server"}
      </label>
      {formData.protocol === "smb" ? (
        <div className="flex gap-1.5 items-center">
          <input
            className="flex-1 max-w-[16rem] min-w-0 text-[13.5px] bg-[#212121] border border-[#363636] text-[#cecece] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444] tabular-nums"
            value={formData.smbHost}
            onChange={(e) => handleFormChange("smbHost", e.target.value.replace(/\\/g, ""))}
            placeholder="192.168.15.72"
            required
            autoComplete="off"
            spellCheck={false}
          />
          <span className="text-[#555] text-[13.5px]">\pipe\</span>
          <input
            className="w-20 min-w-0 text-[13.5px] bg-[#212121] border border-[#363636] text-[#cecece] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444]"
            value={formData.smbPipeName}
            onChange={(e) => handleFormChange("smbPipeName", e.target.value.replace(/\\/g, ""))}
            placeholder="example"
            required
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      ) : formData.protocol === "tcp" ? (
        <div className="flex gap-1.5 items-center">
          <input
            className="flex-1 max-w-[16rem] min-w-0 text-[13.5px] bg-[#212121] border border-[#363636] text-[#cecece] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444] tabular-nums"
            value={tcpServer.host}
            onChange={(e) => setTcpServer(e.target.value, tcpServer.port)}
            placeholder="192.168.1.10"
            required
            autoComplete="off"
            spellCheck={false}
          />
          <span className="text-[#555] text-[13.5px]">:</span>
          <input
            className="w-16 shrink-0 text-[13.5px] bg-[#212121] border border-[#363636] text-[#cecece] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444] tabular-nums"
            value={tcpServer.port}
            onChange={(e) => setTcpServer(tcpServer.host, sanitizeNumericInput(e.target.value))}
            placeholder="8080"
            inputMode="numeric"
            required
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((row, i) => (
            <div
              key={formatServerEndpoint(row.host, row.port, serverScheme, row.path || "/")}
              className="flex gap-1.5 items-center"
            >
              <input
                readOnly
                tabIndex={-1}
                className="flex-1 min-w-0 select-none font-sans text-[13.5px] bg-[#212121] border border-[#363636] text-[#cecece] rounded px-3 py-1.5 outline-none"
                value={formatServerEndpoint(row.host, row.port, serverScheme, row.path || "/")}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="button-default cursor-pointer text-[17px] text-[#888] hover:text-[#c85555] shrink-0 px-1"
              >
                ×
              </button>
            </div>
          ))}
          <div
            className="flex gap-1.5 items-center"
            onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && tryAdd()}
          >
            <input
              className="flex-1 min-w-0 font-sans text-[13.5px] bg-[#212121] border border-[#363636] text-[#cecece] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444]"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), tryAdd())}
              placeholder="http://192.158.15.10:9090/"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={tryAdd}
              disabled={!canAdd}
              className="button-default cursor-pointer text-[17px] text-[#888] hover:text-[#d4d4d4] disabled:opacity-25 disabled:cursor-not-allowed shrink-0 px-1"
            >
              +
            </button>
          </div>
        </div>
      )}
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

    <div className="mb-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Second delay (optional)</label>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center text-[#666] cursor-default select-none" aria-label="Second delay help">
              <CircleHelp size={13} />
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-[#3A3A3A] max-w-xs rounded-[6px]">
            <div className="text-xs space-y-1.5">
              <p>Wait time after a command runs. Useful for sending results back before the main delay.</p>
              <p>
                Example: if the main delay is 10 minutes, set second delay to 5 seconds so output comes back
                before the implant waits the full 10 minutes again.
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
      <input
        className="w-[5rem] text-[13.5px] bg-[#212121] border border-[#363636] text-[#cecece] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444] tabular-nums"
        value={formData.secondDelay}
        onChange={(e) => handleFormChange("secondDelay", sanitizeDigitsInput(e.target.value))}
        placeholder="1"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
      />
    </div>

    {isHttpProtocol(formData.protocol) ? (
      <>
        <Separator className="bg-[#252525] mb-4 mt-4" />
        <KeyValueEditor
          className="implant-kv-table mb-4"
          label="Custom headers"
          items={formData.customHeaders}
          onChange={(next) => handleFormChange("customHeaders", next)}
          keyPlaceholder="Header"
          valuePlaceholder="Value"
        />
        <KeyValueEditor
          className="implant-kv-table mb-3"
          label="Custom cookies"
          items={formData.customCookies}
          onChange={(next) => handleFormChange("customCookies", next)}
          keyPlaceholder="Cookie"
          valuePlaceholder="Value"
        />

        <Separator className="bg-[#252525] mb-4 mt-4" />

        <div className="mb-3 space-y-1.5">
          <label className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest">Custom body</label>
          <Select
            value={formData.requestBodyType}
            onValueChange={(v) => handleFormChange("requestBodyType", v as ImplantFormData["requestBodyType"])}
          >
            <SelectTrigger className="w-full bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">off</SelectItem>
              <SelectItem value="custom">custom</SelectItem>
              <SelectGroup>
                <SelectLabel>Examples</SelectLabel>
                <SelectItem value="json">json</SelectItem>
                <SelectItem value="xml">xml</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          {formData.requestBodyType !== "off" && (
            <>
              <label className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest">
                Listener response
              </label>
              <textarea
                className="w-full bg-[#212121] border border-[#363636] h-[12rem] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] transition-colors placeholder:text-[#444] resize-w leading-relaxed"
                value={formData.responseBody}
                onChange={(e) => handleFormChange("responseBody", e.target.value)}
                spellCheck={false}
              />
              <label className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest">
                Implant request
              </label>
              <textarea
                ref={bodyRef}
                className="w-full bg-[#212121] border border-[#363636] h-[12rem] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] transition-colors placeholder:text-[#444] resize-w leading-relaxed"
                value={formData.requestBody}
                onChange={(e) => handleFormChange("requestBody", e.target.value)}
                spellCheck={false}
              />
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={addMarker}
                  className="button-default flex items-center gap-1.5 px-3 py-1 rounded bg-[#232323] text-[#cecece] text-[13px] transition-colors border border-[#333] cursor-pointer hover:bg-[#2b2b2b] hover:text-[#d4d4d4]"
                >
                  Add §
                </button>
                <button
                  type="button"
                  onClick={clearMarkers}
                  className="button-default flex items-center gap-1.5 px-3 py-1 rounded bg-[#232323] text-[#cecece] text-[13px] transition-colors border border-[#333] cursor-pointer hover:bg-[#2b2b2b] hover:text-[#d4d4d4]"
                >
                  Clear §
                </button>
              </div>
            </>
          )}
        </div>
      </>
    ) : null}
  </>
  );
}
