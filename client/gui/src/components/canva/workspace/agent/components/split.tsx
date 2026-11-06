import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { contextPlaceholder } from "./logic";

export default function SplitPanel({
  systemPrompt,
  setSystemPrompt,
  contextMode,
  setContextMode,
  customContext,
  setCustomContext,
  onClose,
  clearCustomContext,
  formatCustomContext,
}: {
  systemPrompt: string;
  setSystemPrompt: (v: string) => void;
  contextMode: "default" | "custom";
  setContextMode: (v: "default" | "custom") => void;
  customContext: string;
  setCustomContext: (v: string) => void;
  onClose: () => void;
  clearCustomContext: () => void;
  formatCustomContext: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0">
        <span className="text-[13.5px] font-semibold text-[#cecece] tracking-wide">Settings</span>
        <button type="button" onClick={onClose} className="p-1 rounded text-[#6b6b6b] hover:text-[#d4d4d4] hover:bg-[#2a2a2a] transition-colors cursor-pointer">
          <X size={13} />
        </button>
      </div>
      <div className="flex-1 min-h-0 min-w-0 overflow-x-auto overflow-y-auto">
        <div className="min-w-[280px] px-4 py-4">
          <div className="mb-3">
            <label className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest">System prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Leave empty for none"
              spellCheck={false}
              className="w-full min-h-20 resize-y bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-2 outline-none focus:border-[#555] placeholder:text-[#444]"
            />
          </div>
          <div className="mb-3">
            <label className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest">Context</label>
            <Select value={contextMode} onValueChange={(v) => setContextMode(v as "default" | "custom")}>
              <SelectTrigger className="w-full bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="text-[13.5px]">
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            {contextMode === "custom" && (
              <>
                <textarea
                  value={customContext}
                  onChange={(e) => setCustomContext(e.target.value)}
                  placeholder={contextPlaceholder}
                  spellCheck={false}
                  className="mt-2 w-full min-h-32 resize-y bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-2 outline-none focus:border-[#555] placeholder:text-[#444] font-mona-mono"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={clearCustomContext}
                    className="button-default flex h-[29px] shrink-0 items-center rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={formatCustomContext}
                    className="button-default flex h-[29px] shrink-0 items-center rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] cursor-pointer"
                  >
                    Format
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
