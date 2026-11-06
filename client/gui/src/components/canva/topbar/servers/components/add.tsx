import { X, RefreshCw, Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  canAuthServerForm,
  readServerKeyFile,
  type ServerFormPanelProps,
} from "./logic";

const ServerFormPanel = ({
  mode,
  selectedName,
  formData,
  submitting,
  handleClosePanel,
  handleAuth,
  handleClearAuth,
  canClearAuth,
  handleFormChange,
}: ServerFormPanelProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canAuth = canAuthServerForm(formData);

  return (
    <div className="flex flex-col h-full min-h-0 min-w-[32rem]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="cursor-text select-text text-[13.5px] font-medium text-[#cecece] tracking-wide min-w-0">
            {mode === "add" ? (
              "New Server"
            ) : (
              <>
                Edit -{" "}
                <span className="inline-block max-w-[180px] align-bottom overflow-hidden text-ellipsis whitespace-nowrap">
                  {selectedName}
                </span>
              </>
            )}
          </span>
        </div>
        <button
          onClick={handleClosePanel}
          className="button-default p-1 rounded text-[#888888] hover:text-[#d4d4d4] hover:bg-[#2a2a2a] transition-colors cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-4 py-4">
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <label
              className="block text-[12px] text-[#6e6e6e] mb-1.5 uppercase tracking-widest"
              style={{ marginBottom: 0 }}
            >
              Key (.key)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".key"
              className="hidden"
              onChange={(e) =>
                readServerKeyFile(e, (key) => handleFormChange("key", key))
              }
            />
          </div>
          <textarea
            className="w-full bg-[#212121] border border-[#363636] h-[10rem] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555] transition-colors placeholder:text-[#444] resize-none font-mono leading-relaxed"
            rows={6}
            value={formData.key}
            onChange={(e) => handleFormChange("key", e.target.value)}
            placeholder="nome:pass:secret"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="button-default mb-4 flex items-center gap-1.5 px-3 py-1 rounded bg-[#232323] text-[#cecece] text-[13px] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] transition-colors border border-[#333] disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
        >
          <Upload size={10} />
          Upload .key
        </button>

        <div className="grid grid-cols-[5rem_1fr] gap-2 mb-2">
          <label className="text-[12px] text-[#6e6e6e] uppercase tracking-widest self-center">
            Protocol
          </label>
          <Select
            value={formData.scheme}
            onValueChange={(v) => handleFormChange("scheme", v)}
          >
            <SelectTrigger className="w-auto ![font-family:'Mona_Sans_Mono',ui-monospace,monospace] text-[13.5px] bg-[#212121] border-[#363636] text-[#cecece] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="http">http</SelectItem>
              <SelectItem value="https">https</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-[5rem_1fr] gap-2 mb-2">
          <label className="text-[12px] text-[#6e6e6e] uppercase tracking-widest self-center">
            Host
          </label>
          <input
            value={formData.host}
            onChange={(e) => handleFormChange("host", e.target.value)}
            placeholder="127.0.0.1"
            className="bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555]"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="grid grid-cols-[5rem_1fr] gap-2">
          <label className="text-[12px] text-[#6e6e6e] uppercase tracking-widest self-center">
            Port
          </label>
          <input
            value={formData.port}
            onChange={(e) => handleFormChange("port", e.target.value)}
            placeholder="9000"
            className="bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none focus:border-[#555]"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>
      <div className="flex shrink-0 flex-nowrap items-center justify-between gap-2 border-t border-[#252525] p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void handleClearAuth()}
          disabled={!canClearAuth || submitting}
          className="h-7 px-0 text-[13px] text-[#888888] hover:text-[#d4d4d4] hover:bg-transparent"
        >
          Clear Session
        </Button>
        <button
          type="button"
          onClick={() => void handleAuth()}
          disabled={!canAuth || submitting}
          className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#444] bg-[#232323] px-3 text-[13px] text-[#c8c8c8] hover:bg-[#2b2b2b] cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
        >
          {submitting && <RefreshCw size={10} className="animate-spin" />}
          Auth
        </button>
      </div>
    </div>
  );
};

export default ServerFormPanel;
