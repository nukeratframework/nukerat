import { RefreshCw, Upload, X } from "lucide-react";
import { useRef } from "react";
import { ServerDropdown } from "@/components/canva/topbar/listeners/components/form";
import ScriptEditor from "./editor/script";
import { canSubmitScriptForm, parseScriptServer, readScriptFile, type ScriptFormData } from "./logic";

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
  onFormat,
}: {
  mode: "add" | "edit";
  selectedName?: string;
  formData: ScriptFormData;
  editBaseline: string | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onChange: <K extends keyof ScriptFormData>(key: K, value: ScriptFormData[K]) => void;
  onServerChange: (ip: string, port: string) => void;
  onFormat: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canSubmit = canSubmitScriptForm(formData, mode, editBaseline);
  const { host: serverHost, port: serverPort } = parseScriptServer(formData.server);

  return (
    <div className="flex flex-col h-full min-h-0 min-w-[32rem]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0">
        <span className="cursor-text select-text text-[13.5px] font-medium text-[#cecece] tracking-wide min-w-0">
          {mode === "add" ? (
            "New Script"
          ) : (
            <>
              Edit -{" "}
              <span className="inline-block max-w-[180px] align-bottom overflow-hidden text-ellipsis whitespace-nowrap">
                {selectedName}
              </span>
            </>
          )}
        </span>
        <button onClick={onClose} className="button-default p-1 rounded text-[#888888] hover:text-[#d4d4d4] hover:bg-[#2a2a2a] transition-colors cursor-pointer">
          <X size={13} />
        </button>
      </div>
      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-4 py-4">
        {mode === "add" && (
          <>
            <div className="mb-3">
              <label className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest">Name</label>
              <input className="w-full bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444]" value={formData.name} onChange={(e) => onChange("name", e.target.value)} autoComplete="off" spellCheck={false} />
            </div>
            <ServerDropdown host={serverHost} port={serverPort} onSelect={onServerChange} />
            <div className="mb-3">
              <label className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest">Description</label>
              <input maxLength={100} className="w-full bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] placeholder:text-[#444]" value={formData.description} onChange={(e) => onChange("description", e.target.value)} autoComplete="off" spellCheck={false} />
            </div>
          </>
        )}
        <div className="mb-3">
          <label className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest">NukeScript</label>
          <div className="border border-[#363636] rounded overflow-hidden bg-[#0e0e0e] focus-within:border-[#555]">
            <ScriptEditor
              value={formData.content}
              onChange={(value) => onChange("content", value)}
            />
          </div>
        </div>
        <input ref={fileRef} type="file" accept=".ns" className="hidden" onChange={(e) => readScriptFile(e, (c) => onChange("content", c))} />
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="button-default flex items-center gap-1.5 px-3 py-1 rounded bg-[#232323] text-[#cecece] text-[13px] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] transition-colors border border-[#333] cursor-pointer">
            <Upload size={10} />
            Upload
          </button>
          <button
            type="button"
            onClick={onFormat}
            disabled={!formData.content.trim() || submitting}
            className="button-default flex items-center gap-1.5 px-3 py-1 rounded bg-[#232323] text-[#cecece] text-[13px] hover:bg-[#2b2b2b] transition-colors border border-[#333] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            Format
          </button>
        </div>
      </div>
      <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2 border-t border-[#252525] p-2">
        <button type="button" onClick={onClose} className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#444] bg-[#232323] px-3 text-[13px] text-[#c8c8c8] hover:bg-[#2b2b2b] cursor-pointer">
          Cancel
        </button>
        <button type="button" onClick={onSubmit} disabled={!canSubmit || submitting} className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#444] bg-[#232323] px-3 text-[13px] text-[#c8c8c8] hover:bg-[#2b2b2b] cursor-pointer disabled:cursor-not-allowed disabled:opacity-30">
          {submitting && <RefreshCw size={10} className="animate-spin" />}
          {mode === "add" ? "Add" : "Save"}
        </button>
      </div>
    </div>
  );
}
