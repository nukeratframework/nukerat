import { X } from "lucide-react";
import type { CredentialEntry } from "@/api/credentials";

const panelActionClass =
  "button-default flex h-[29px] shrink-0 items-center rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] cursor-pointer";

const contentClass =
  "w-full min-h-[12rem] resize-y bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-2 outline-none font-mono leading-relaxed";

export default function ViewPanel({ credential, onClose }: { credential: CredentialEntry | null; onClose: () => void }) {
  const content = credential?.content ?? "";

  return (
    <div className="flex flex-col h-full min-h-0 min-w-[22rem]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0">
        <span className="text-[13.5px] font-semibold text-[#cecece] tracking-wide min-w-0">
          View - <span className="inline-block max-w-[180px] truncate align-bottom">{credential?.name ?? "Credential"}</span>
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
        <div className="mb-3 space-y-1.5">
          <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">Credentials</label>
          <textarea
            data-credential-field="content"
            readOnly
            tabIndex={-1}
            value={content}
            spellCheck={false}
            className={contentClass}
          />
        </div>
      </div>
      <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2 border-t border-[#2a2a2a] p-2">
        <button type="button" onClick={onClose} className={panelActionClass}>
          Close
        </button>
      </div>
    </div>
  );
}
