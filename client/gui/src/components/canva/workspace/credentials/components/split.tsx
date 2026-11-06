import { RefreshCw, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FetchToast from "@/components/canva/utils/toast_rules";
import { ServerDropdown } from "@/components/canva/topbar/listeners/components/form";
import {
  canSubmitCredentialForm,
  parseCredentialServer,
  useCredentialHostSelect,
  type CredentialFormData,
  type FormMode,
} from "./logic";

function HostSelect({ server, value, onChange }: { server: string; value: string; onChange: (host: string) => void }) {
  const { hosts, loading, response } = useCredentialHostSelect(server);
  return (
    <div className="mb-3">
      <FetchToast response={response} />
      <label className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest">Host</label>
      <Select value={value || undefined} onValueChange={onChange} disabled={!server || loading}>
        <SelectTrigger className="w-full bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-2 h-auto outline-none focus:border-[#555] placeholder:text-[#444] disabled:opacity-40 focus-visible:ring-0">
          <SelectValue placeholder={!server ? "Select a server first..." : loading ? "Loading hosts..." : "Select host..."} />
        </SelectTrigger>
        <SelectContent>
          {hosts.map((host) => {
            const label = host.tag?.trim() || host.ip;
            return (
              <SelectItem key={host.id} value={label}>
                {label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function SplitPanel({
  mode,
  selectedName,
  formData,
  editBaseline,
  submitting,
  onClose,
  onSubmit,
  onChange,
  onServerChange,
}: {
  mode: FormMode;
  selectedName?: string;
  formData: CredentialFormData;
  editBaseline: string | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onChange: <K extends keyof CredentialFormData>(key: K, value: CredentialFormData[K]) => void;
  onServerChange: (ip: string, port: string) => void;
}) {
  const canSubmit = canSubmitCredentialForm(formData, mode, editBaseline);
  const { host: serverHost, port: serverPort } = parseCredentialServer(formData.server);
  const panelActionClass =
    "button-default flex h-[29px] shrink-0 items-center rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] cursor-pointer";

  return (
    <div className="flex flex-col h-full min-h-0 min-w-[22rem]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0">
        <span className="text-[13.5px] font-semibold text-[#cecece] tracking-wide min-w-0">
          {mode === "add" ? "New Credential" : <>Edit - <span className="inline-block max-w-[180px] truncate align-bottom">{selectedName}</span></>}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="button-default p-1 rounded text-[#6e6e6e] hover:text-[#d4d4d4] hover:bg-[#2a2a2a] transition-colors cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>
      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-4 py-4" data-credentials-input>
        <div className="min-w-[280px]">
          <div className="mb-3">
            <label className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest">Name</label>
            <input data-credential-field="name" className="w-full bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-2 outline-none focus:border-[#555] placeholder:text-[#444]" value={formData.name} onChange={(e) => onChange("name", e.target.value)} placeholder="Credential name" autoComplete="off" spellCheck={false} />
          </div>
          <ServerDropdown host={serverHost} port={serverPort} onSelect={onServerChange} />
          <HostSelect server={formData.server} value={formData.host} onChange={(host) => onChange("host", host)} />
          <div className="mb-3">
            <label className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest">Description</label>
            <input data-credential-field="desc" className="w-full bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-2 outline-none focus:border-[#555] placeholder:text-[#444]" value={formData.desc} onChange={(e) => onChange("desc", e.target.value)} placeholder="Optional" autoComplete="off" spellCheck={false} />
          </div>
          <div className="mb-3">
            <label className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest">Credentials</label>
            <textarea data-credential-field="content" className="w-full h-48 resize-none font-mono bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-2 outline-none focus:border-[#555] placeholder:text-[#444]" value={formData.content} onChange={(e) => onChange("content", e.target.value)} placeholder="username:password" autoComplete="off" spellCheck={false} />
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2 border-t border-[#2a2a2a] p-2">
        <button type="button" onClick={onClose} className={panelActionClass}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          className={`${panelActionClass} disabled:cursor-not-allowed disabled:opacity-25`}
        >
          {submitting && <RefreshCw size={10} className="animate-spin" />}
          {mode === "add" ? "Add" : "Edit"}
        </button>
      </div>
    </div>
  );
}
