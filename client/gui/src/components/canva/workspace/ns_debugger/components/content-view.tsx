import { forwardRef, memo, useCallback, useMemo, type HTMLAttributes } from "react";
import { Virtuoso } from "react-virtuoso";
import type { VirtuosoHandle } from "react-virtuoso";
import { formatNsDebuggerContent, highlight } from "./format";
import type { NsDebuggerLine } from "./logic";

interface NsDebuggerProps {
  lines: NsDebuggerLine[];
  searchQuery?: string;
}

const VirtuosoScroller = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ style, ...props }, ref) => (
    <div {...props} ref={ref} style={{ ...style, overflowAnchor: "none" }} />
  ),
);
VirtuosoScroller.displayName = "NsDebuggerVirtuosoScroller";

const virtuosoComponents = { Scroller: VirtuosoScroller };

const NsDebuggerLineItem = memo(function NsDebuggerLineItem({
  line,
  searchQuery,
}: {
  line: NsDebuggerLine;
  searchQuery?: string;
}) {
  const q = searchQuery?.trim();
  return (
    <div
      data-terminal-line
      style={{ marginBottom: "0.2px !important" }}
      className="qJ6xN select-text cursor-text"
    >
      <span className="oKD1s">
        {q ? highlight(line.time, q) : line.time}
      </span>
      <span className="sT2hJ ml-[0px]">
        {formatNsDebuggerContent(line.content, q)}
      </span>
    </div>
  );
});

const NsDebuggerInner = forwardRef<VirtuosoHandle, NsDebuggerProps>(
  function NsDebugger({ lines, searchQuery }, ref) {
    const q = searchQuery?.trim();

    const renderItem = useCallback(
      (_index: number, line: NsDebuggerLine) => (
        <NsDebuggerLineItem line={line} searchQuery={q} />
      ),
      [q],
    );

    const followOutput = useMemo(() => (q ? false : "auto"), [q]);

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Virtuoso
          ref={ref}
          className="tHa7k min-h-0 flex-1 select-text cursor-text"
          style={{ flex: 1, minHeight: 0 }}
          data={lines}
          alignToBottom={!q}
          followOutput={followOutput}
          increaseViewportBy={q ? { top: 80, bottom: 80 } : { top: 200, bottom: 200 }}
          components={virtuosoComponents}
          itemContent={renderItem}
          computeItemKey={(_index, line) => line.key}
        />
      </div>
    );
  },
);

NsDebuggerInner.displayName = "NsDebugger";

export default memo(NsDebuggerInner);
