import { useState } from "react";
import { RefreshCw, X } from "lucide-react";

const LOG_MIN = 80;
const LOG_MAX = 420;
const LOG_DEFAULT = 120;

function resizeLog(e: React.MouseEvent, height: number, setHeight: (h: number) => void) {
  e.preventDefault();
  const y0 = e.clientY;
  const h0 = height;
  const move = (ev: MouseEvent) => setHeight(Math.max(LOG_MIN, Math.min(LOG_MAX, h0 + y0 - ev.clientY)));
  const up = () => {
    document.removeEventListener("mousemove", move);
    document.removeEventListener("mouseup", up);
  };
  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", up);
}

export default function StagelessBuildBar({
  submitting,
  error,
  onBuild,
  onClear,
}: {
  submitting: boolean;
  error: string | null;
  onBuild: () => void;
  onClear: () => void;
}) {
  const [logHeight, setLogHeight] = useState(LOG_DEFAULT);

  return (
    <div className="shrink-0 border-t border-[#2a2a2a]">
      <div className="px-2 py-2">
        <button
          type="button"
          onClick={onBuild}
          disabled={submitting}
          className="button-default flex items-center gap-1.5 px-3 py-1 rounded bg-[#232323] text-[#cecece] text-[13px] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] transition-colors border border-[#333] disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
        >
          {submitting ? <RefreshCw size={13} className="animate-spin" /> : null}
          Build
        </button>
      </div>
      {error ? (
        <div className="bg-[#141414]">
          <div
            className="h-1.5 cursor-row-resize border-t border-[#2a2a2a] hover:bg-[#2f2f2f]"
            onMouseDown={(e) => resizeLog(e, logHeight, setLogHeight)}
          />
          <div className="flex items-center justify-between px-3 border-b border-[#252525]">
            <span className="text-[13px] text-[#b65959]">Build failed</span>
            <button
              type="button"
              onClick={onClear}
              className="button-default p-1 rounded text-[#9B9B9B] hover:text-[#d4d4d4] hover:bg-[#232323] cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>
          <pre
            style={{ height: logHeight }}
            className="overflow-auto px-3 py-2 text-[13px] text-[#c8c8c8] whitespace-pre-wrap break-words select-text"
          >
            {error}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
