import { useRef } from "react";
import { ChevronRight, Upload } from "lucide-react";
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
import type { ListenerFormData, CertSource, CertKeyType } from "./logic";
import {
  useServerDropdown,
  useAdvancedSection,
  updateListenerCert,
  readListenerPemFile,
  getServerOptionLabel,
  truncateServerLabel,
  CERT_SUBJECT_FIELDS,
} from "./logic";

export interface ListenerFormBodyProps {
  formData: ListenerFormData;
  handleFormChange: <K extends keyof ListenerFormData>(
    key: K,
    value: ListenerFormData[K]
  ) => void;
}

export const Toggle = ({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    data-state={enabled ? "checked" : "unchecked"}
    onClick={() => onToggle(!enabled)}
    className="button-default nk-switch"
  >
    <span data-state={enabled ? "checked" : "unchecked"} className="nk-switch-thumb" />
  </button>
);

export const SegmentedButtons = <T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Record<string, string>;
}) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((opt) => (
      <button
        key={opt}
        onClick={() => onChange(opt)}
        className={`button-default px-3 py-1 rounded text-[13px] font-medium border transition-colors cursor-pointer ${value === opt
          ? "bg-[#2a2a2a] border-[#555] text-[#cecece]"
          : "bg-[#1c1c1c] border-[#2f2f2f] text-[#555] hover:text-[#9b9b9b] hover:border-[#3a3a3a]"
          }`}
      >
        {labels?.[opt] ?? opt}
      </button>
    ))}
  </div>
);

export const PortToOpenField = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) => (
  <div className="mb-3 space-y-1.5">
    <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Port to Open</label>
    <input
      aria-label="Port to open"
      className="w-full text-[13.5px] bg-[#212121] border border-[#363636] text-[#cecece] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444] tabular-nums"
      value={value}
      onChange={(e) => onChange(sanitizeNumericInput(e.target.value))}
      placeholder="8000"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
    />
  </div>
);

export const ServerDropdown = ({
  host,
  port,
  onSelect,
  onSelectHost,
  label = "Server",
  hideLabel = false,
}: {
  host: string;
  port?: string;
  onSelect?: (host: string, port: string) => void;
  onSelectHost?: (host: string) => void;
  label?: string;
  hideLabel?: boolean;
}) => {
  const { servers, selectedId, handleChange } = useServerDropdown(
    host,
    port,
    onSelect,
    onSelectHost
  );

  return (
    <div className="mb-3 space-y-1.5">
      {!hideLabel ? (
        <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">{label}</label>
      ) : null}
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
  );
};

export const AdvancedSection = ({
  formData,
  handleFormChange,
}: ListenerFormBodyProps) => {
  const {
    expanded,
    toggleExpanded,
    bodyRef,
    addImplantMarker,
    clearImplantMarkers,
    addHeader,
    removeHeader,
    updateHeader,
  } = useAdvancedSection(formData, handleFormChange);

  return (
    <>
      <div className="h-px bg-[#252525] mb-4 mt-4" />
      <button
        type="button"
        onClick={toggleExpanded}
        className="button-default flex items-center gap-1.5 w-full mb-3 cursor-pointer"
      >
        <ChevronRight
          size={11}
          className={`text-[#454545] transition-transform duration-150 ${expanded ? "rotate-90" : ""
            }`}
        />
        <span className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Advanced</span>
      </button>

      {expanded && (
        <div className="pl-3 border-l border-[#252525]">
          <div className="mb-3 space-y-1.5">
            <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Endpoint Path</label>
            <input
              className="w-full text-[13.5px] bg-[#212121] border border-[#363636] text-[#cecece] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444]"
              value={formData.endpointPath}
              onChange={(e) => handleFormChange("endpointPath", e.target.value)}
              placeholder="/api/example"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="h-px bg-[#252525] mb-4 mt-4" />

          <div className="mb-3 space-y-1.5">
            <label className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest">Custom body</label>
            <Select
              value={formData.implantBodyType}
              onValueChange={(v) =>
                handleFormChange("implantBodyType", v as ListenerFormData["implantBodyType"])
              }
            >
              <SelectTrigger className="w-full bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="text-[13.5px]">
                <SelectItem value="off" className="text-[13.5px]">off</SelectItem>
                <SelectItem value="custom" className="text-[13.5px]">custom</SelectItem>
                <SelectGroup>
                  <SelectLabel className="text-[11px] text-[#6e6e6e] uppercase">Examples</SelectLabel>
                  <SelectItem value="json" className="text-[13.5px]">json</SelectItem>
                  <SelectItem value="xml" className="text-[13.5px]">xml</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            {formData.implantBodyType !== "off" && (
              <>
                <label className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest">Listener response</label>
                <textarea
                  className="w-full bg-[#212121] border border-[#363636] h-[12rem] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] transition-colors placeholder:text-[#444] resize-w leading-relaxed"
                  value={formData.listenerResponse}
                  onChange={(e) => handleFormChange("listenerResponse", e.target.value)}
                  spellCheck={false}
                />
                <label className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest">Implant request</label>
                <textarea
                  ref={bodyRef}
                  className="w-full bg-[#212121] border border-[#363636] h-[12rem] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] transition-colors placeholder:text-[#444] resize-w leading-relaxed"
                  value={formData.implantBody}
                  onChange={(e) => handleFormChange("implantBody", e.target.value)}
                  spellCheck={false}
                />
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={addImplantMarker}
                    className="button-default flex items-center gap-1.5 px-3 py-1 rounded bg-[#232323] text-[#cecece] text-[13px] transition-colors border border-[#333] cursor-pointer hover:bg-[#2b2b2b] hover:text-[#d4d4d4]"
                  >
                    Add §
                  </button>
                  <button
                    type="button"
                    onClick={clearImplantMarkers}
                    className="button-default flex items-center gap-1.5 px-3 py-1 rounded bg-[#232323] text-[#cecece] text-[13px] transition-colors border border-[#333] cursor-pointer hover:bg-[#2b2b2b] hover:text-[#d4d4d4]"
                  >
                    Clear §
                  </button>
                </div>
              </>
            )}

          </div>

          <div className="h-px bg-[#252525] mb-4 mt-4" />

          <div className="flex items-center justify-between mb-2">
            <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Response Headers</label>
            <button
              type="button"
              onClick={addHeader}
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
                    onChange={(e) => updateHeader(i, "key", e.target.value)}
                    placeholder="Header-Name"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <input
                    className="flex-1 w-full text-[13.5px] bg-[#212121] border border-[#363636] text-[#cecece] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444] tabular-nums"
                    value={h.value}
                    onChange={(e) => updateHeader(i, "value", e.target.value)}
                    placeholder="value"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={() => removeHeader(i)}
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
};

export const CertSection = ({
  formData,
  handleFormChange,
  showSubject = false,
}: Pick<ListenerFormBodyProps, "formData" | "handleFormChange"> & { showSubject?: boolean }) => {
  const certFileInputRef = useRef<HTMLInputElement>(null);
  const keyFileInputRef = useRef<HTMLInputElement>(null);
  const cert = formData.cert;
  const patchCert = (patch: Partial<typeof cert>) =>
    updateListenerCert(cert, patch, handleFormChange);

  return (
    <>
      <div className="text-[12px] text-[#6e6e6e] uppercase tracking-widest mb-3">Certificate</div>
      <div className="pl-3 border-l border-[#252525] mb-4 space-y-3">
        <div>
          <label className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest">Source</label>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["self_signed", "Self-Signed"],
                ["manual", "Manual"],
              ] as [CertSource, string][]
            ).map(([opt, label]) => (
              <button
                key={opt}
                type="button"
                onClick={() => patchCert({ source: opt })}
                className={`button-default flex items-center gap-1.5 px-3 py-1 rounded bg-[#232323] text-[#cecece] text-[13px] transition-colors border border-[#333] cursor-pointer ${
                  cert.source === opt
                    ? "hover:bg-[#2b2b2b] hover:text-[#d4d4d4]"
                    : "opacity-25 hover:bg-[#2b2b2b] hover:text-[#d4d4d4]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {cert.source === "self_signed" && showSubject && (
          <div className="space-y-3">
            <div>
              <label className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest">Key</label>
              <SegmentedButtons
                options={["ecdsa", "rsa"] as CertKeyType[]}
                value={cert.keyType}
                onChange={(v) => patchCert({ keyType: v })}
              />
            </div>
            <div>
              <label className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest">Days</label>
              <input
                className="w-full text-[13.5px] bg-[#212121] border border-[#363636] text-[#cecece] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444] tabular-nums"
                value={cert.days}
                onChange={(e) => patchCert({ days: sanitizeNumericInput(e.target.value) })}
                placeholder="397"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
            {CERT_SUBJECT_FIELDS.map((field) => (
              <div key={field.key} className={field.key === "sanDns" ? "col-span-2" : ""}>
                <label className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest">{field.label}</label>
                <input
                  className="w-full text-[13.5px] bg-[#212121] border border-[#363636] text-[#cecece] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444]"
                  value={cert[field.key]}
                  onChange={(e) => patchCert({ [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            ))}
            </div>
          </div>
        )}
        {cert.source === "manual" && (
          <>
            <div className="mb-3 space-y-1.5">
              <label className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest">cert.pem</label>
              <input
                ref={certFileInputRef}
                type="file"
                accept=".pem,.crt,.cer,text/plain"
                className="hidden"
                onChange={(e) =>
                  readListenerPemFile(e, (content) => patchCert({ certPem: content }))
                }
              />
              <textarea
                className="w-full bg-[#212121] border border-[#363636] h-[18rem] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] transition-colors placeholder:text-[#444] resize-none leading-relaxed"
                rows={8}
                value={cert.certPem}
                onChange={(e) => patchCert({ certPem: e.target.value })}
                placeholder={
                  "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
                }
                spellCheck={false}
              />
            </div>
            <button
              type="button"
              onClick={() => certFileInputRef.current?.click()}
              className="button-default flex items-center gap-1.5 px-3 py-1 rounded bg-[#232323] text-[#cecece] text-[13px] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] transition-colors border border-[#333] cursor-pointer"
            >
              <Upload size={11} />
              Upload cert.pem
            </button>

            <div className="mb-3 space-y-1.5">
              <label className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest">key.pem</label>
              <input
                ref={keyFileInputRef}
                type="file"
                accept=".pem,.key,text/plain"
                className="hidden"
                onChange={(e) =>
                  readListenerPemFile(e, (content) => patchCert({ keyPem: content }))
                }
              />
              <textarea
                className="w-full bg-[#212121] border border-[#363636] h-[18rem] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] transition-colors placeholder:text-[#444] resize-none leading-relaxed"
                rows={8}
                value={cert.keyPem}
                onChange={(e) => patchCert({ keyPem: e.target.value })}
                placeholder={
                  "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
                }
                spellCheck={false}
              />
            </div>
            <button
              type="button"
              onClick={() => keyFileInputRef.current?.click()}
              className="button-default flex items-center gap-1.5 px-3 py-1 rounded bg-[#232323] text-[#cecece] text-[13px] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] transition-colors border border-[#333] cursor-pointer"
            >
              <Upload size={11} />
              Upload key.pem
            </button>
          </>
        )}
      </div>
    </>
  );
};
