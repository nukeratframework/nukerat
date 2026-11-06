import { Virtuoso } from "react-virtuoso";
import { CHUNK_SIZE, useContentPreview } from "./logic";

const implantActionButtonClass =
  "button-default flex items-center gap-1.5 px-3 py-1 rounded bg-[#232323] text-[#cecece] text-[13px] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] transition-colors border border-[#333] cursor-pointer";

interface ContentViewProps {
  content: string;
  fileKey?: string;
  oversizedOnly?: boolean;
  onDismissOversized: () => void;
}

const ContentView = ({ content, fileKey, oversizedOnly, onDismissOversized }: ContentViewProps) => {
  const { isLargeContent, useChunkMode, lines, chunkCount } = useContentPreview(content, fileKey);

  if (oversizedOnly || isLargeContent) {
    return (
      <div className="flex-1 overflow-y-auto p-3">
        <div className="h-full flex flex-col items-center justify-center text-center gap-4">
          <p className="text-[13px] text-[#cecece] max-w-[560px]">
            This file is over 25 MB.<br />Download it from the terminal instead.
          </p>
          <button type="button" onClick={onDismissOversized} className={implantActionButtonClass}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="explorer-file-preview" className="flex-1 overflow-hidden p-3.5">
      {useChunkMode ? (
        <Virtuoso
          style={{ height: "100%" }}
          totalCount={chunkCount}
          itemContent={(index) => {
            const start = index * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, content.length);
            return (
              <div
                className="text-[13.5px] text-[#d4d4d4] font-inherit whitespace-pre-wrap break-all explorer-content-view "
              >
                {content.slice(start, end)}
              </div>
            );
          }}
        />
      ) : (
        <Virtuoso
          style={{ height: "100%" }}
          totalCount={lines.length}
          itemContent={(index) => (
            <div
              className="text-[13.5px] text-[#d4d4d4] font-inherit whitespace-pre-wrap break-all explorer-content-view "
            >
              {lines[index] === "" ? " " : lines[index]}
            </div>
          )}
        />
      )}
    </div>
  );
};

export default ContentView;
