import { forwardRef, memo, useEffect, useRef, type HTMLAttributes } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { VirtuosoHandle } from 'react-virtuoso';
import { highlight, renderLines } from './logic';

interface TerminalOutputProps {
  output: any[];
  searchQuery?: string;
  searchMatchIndex?: number;
  activeItemIndex?: number | null;
  activeOccurrenceInItem?: number;
}

const markPadding = 12;

const VirtuosoScroller = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ style, ...props }, ref) => (
    <div {...props} ref={ref} style={{ ...style, overflowAnchor: 'none' }} />
  )
);
VirtuosoScroller.displayName = 'TerminalVirtuosoScroller';

const virtuosoComponents = { Scroller: VirtuosoScroller };

const scrollActiveMark = (scroller: HTMLElement | null, root: HTMLElement | null) => {
  if (!scroller || !root) return;
  const mark = root.querySelector('[data-terminal-active-match]');
  if (!mark) return;
  const s = scroller.getBoundingClientRect();
  const m = mark.getBoundingClientRect();
  if (m.top < s.top + markPadding) scroller.scrollTop += m.top - s.top - markPadding;
  else if (m.bottom > s.bottom - markPadding) scroller.scrollTop += m.bottom - s.bottom + markPadding;
};

const TerminalLineItem = memo(function TerminalLineItem({
  line,
  searchQuery,
  activeOcc,
}: {
  line: any;
  searchQuery?: string;
  activeOcc?: number;
}) {
  return (
    <div className="qJ6xN cursor-text select-text" data-terminal-line>
      {typeof line === 'string' && line.startsWith('$') ? (
        <>
          <span className="bZ5cQ">$</span>
          <span className="sT2hJ">
            {searchQuery ? highlight(line.slice(2), searchQuery, activeOcc) : line.slice(2)}
          </span>
        </>
      ) : (
        <span className="sT2hJ">
          {typeof line === 'object'
            ? searchQuery ? highlight(JSON.stringify(line), searchQuery, activeOcc) : JSON.stringify(line)
            : renderLines(String(line), searchQuery, activeOcc)}
        </span>
      )}
    </div>
  );
});

const TerminalOutputInner = forwardRef<VirtuosoHandle, TerminalOutputProps>(
  ({ output, searchQuery, searchMatchIndex, activeItemIndex, activeOccurrenceInItem }, ref) => {
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const listRootRef = useRef<HTMLDivElement>(null);
    const scrollerRef = useRef<HTMLElement | null>(null);
    const prevSearchItemRef = useRef<number | null>(null);

    useEffect(() => {
      if (!searchQuery) prevSearchItemRef.current = null;
    }, [searchQuery]);

    useEffect(() => {
      if (searchMatchIndex == null || searchMatchIndex < 0 || activeItemIndex == null || activeItemIndex < 0) return;

      const itemChanged = prevSearchItemRef.current !== activeItemIndex;
      prevSearchItemRef.current = activeItemIndex;

      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        if (itemChanged) {
          virtuosoRef.current?.scrollToIndex({
            index: activeItemIndex,
            behavior: 'auto',
            align: 'start',
            offset: -markPadding,
          });
        }
        raf2 = requestAnimationFrame(() => scrollActiveMark(scrollerRef.current, listRootRef.current));
      });

      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }, [searchMatchIndex, activeItemIndex, activeOccurrenceInItem]);

    return (
      <div ref={listRootRef} className="flex min-h-0 flex-1 flex-col">
      <Virtuoso
        className="mb-3 min-h-0 cursor-default"
        ref={(instance) => {
          virtuosoRef.current = instance;
          if (typeof ref === 'function') ref(instance);
          else if (ref) ref.current = instance;
        }}
        style={{ flex: 1, minHeight: 0 }}
        alignToBottom={!searchQuery}
        followOutput={!searchQuery}
        increaseViewportBy={searchQuery ? { top: 80, bottom: 80 } : { top: 200, bottom: 200 }}
        scrollerRef={(el) => { scrollerRef.current = el as HTMLElement | null; }}
        components={virtuosoComponents}
        data={output}
        itemContent={(index, line) => (
          <TerminalLineItem
            line={line}
            searchQuery={searchQuery}
            activeOcc={
              (searchMatchIndex ?? -1) >= 0 && index === activeItemIndex ? activeOccurrenceInItem : undefined
            }
          />
        )}
      />
      </div>
    );
  }
);

TerminalOutputInner.displayName = 'TerminalOutput';

const TerminalOutput = memo(TerminalOutputInner);

export default TerminalOutput;
