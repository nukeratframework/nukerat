import { forwardRef, memo, useCallback, useEffect, useMemo, useRef } from "react";
import { Virtuoso } from "react-virtuoso";
import type { VirtuosoHandle } from "react-virtuoso";
import { Badge } from "@/components/ui/badge";
import { MdFormat } from "./md-format";
import type { ChatMessage } from "./logic";

interface AgentChatHistoryProps {
  messages: ChatMessage[];
  submitting: boolean;
  onCancelSubmit: () => void;
}

const UserMessage = memo(function UserMessage({ msg }: { msg: ChatMessage }) {
  return (
    <div className="flex justify-end my-8">
      <div style={{borderRadius: "6px"}} className="w-fit max-w-[85%] px-3 py-2 bg-[#232323] border border-[#333] text-[13.5px] text-[#cecece] whitespace-pre-wrap break-words text-right">
        {msg.contexts && msg.contexts.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5 mb-2">
            {msg.contexts.map((item) => (
              <Badge
                key={item.id}
                variant="outline"
                style={{ fontSize: "13px", padding: "2px 12px 0px 12px" }}
                className="select-none gap-1 border-[#363636] bg-[#ffffff00] text-[#cecece] font-normal rounded px-2 py-0.5"
              >
                {item.key}
              </Badge>
            ))}
          </div>
        )}
        {msg.text}
      </div>
    </div>
  );
});

const AgentMessage = memo(function AgentMessage({ msg }: { msg: ChatMessage }) {
  return (
    <div className="px-1">
      <MdFormat text={msg.text} />
    </div>
  );
});

const ChatMessageItem = memo(function ChatMessageItem({ msg }: { msg: ChatMessage }) {
  return (
    <div className="agent-chat-message min-w-0 w-full max-w-full px-3 overflow-x-hidden [overflow-wrap:anywhere] [overflow-anchor:none]">
      {msg.role === "user" ? <UserMessage msg={msg} /> : <AgentMessage msg={msg} />}
    </div>
  );
});

function SubmittingRow({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="px-4 pt-1 pb-6">
      <div
        style={{ borderRadius: "5px" }}
        className="inline-flex items-center gap-2 rounded-md border border-[#2a2a2a] bg-[#17171700] px-3 py-1 shadow-sm"
        role="status"
        aria-live="polite"
      >
        <div className="mr-[4px] flex items-center gap-2.5 text-[13px] text-[#8a8a8a]">
          <span className="flex items-center gap-[3px]" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-[5px] rounded-full bg-[#6e6e6e] animate-bounce"
                style={{ animationDelay: `${i * 160}ms`, animationDuration: "0.9s" }}
              />
            ))}
          </span>
          <span>Thinking</span>
        </div>
        <span className="h-3 w-px shrink-0 bg-[#333]" aria-hidden="true" />
        <button
          style={{
            paddingLeft: "4px !important",
            paddingRight: "0px !important",
            paddingTop: "0px !important",
            paddingBottom: "0px !important",
          }}
          type="button"
          onClick={onCancel}
          title="Cancel request"
          className="button-default flex text-left items-center gap-1.5 rounded px-1 py-0.5 text-[12px] text-[#7a7a7a] hover:text-[#c97070] transition-colors cursor-pointer"
        >
          Stop
        </button>
      </div>
    </div>
  );
}

const VirtuosoScroller = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ style, ...props }, ref) => (
    <div {...props} ref={ref} style={{ ...style, overflowAnchor: "none" }} />
  )
);
VirtuosoScroller.displayName = "VirtuosoScroller";

const AgentChatHistoryInner = forwardRef<VirtuosoHandle, AgentChatHistoryProps>(
  ({ messages, submitting, onCancelSubmit }, ref) => {
    const internalRef = useRef<VirtuosoHandle>(null);
    const scrollerEl = useRef<HTMLElement | null>(null);

    const scrollEnd = useCallback(() => {
      if (!messages.length) return;
      const el = scrollerEl.current;
      if (el) el.scrollTop = el.scrollHeight;
      else internalRef.current?.autoscrollToBottom();
    }, [messages.length]);

    useEffect(() => {
      scrollEnd();
      requestAnimationFrame(scrollEnd);
    }, [messages, submitting, scrollEnd]);

    const renderItem = useCallback(
      (_index: number, msg: ChatMessage) => <ChatMessageItem msg={msg} />,
      []
    );

    const virtuosoComponents = useMemo(
      () => ({
        Scroller: VirtuosoScroller,
        Footer: () => (submitting ? <SubmittingRow onCancel={onCancelSubmit} /> : null),
      }),
      [submitting, onCancelSubmit]
    );

    return (
      <Virtuoso
        id="agent-chat-history"
        className="h-full min-h-0 min-w-0"
        ref={(instance) => {
          internalRef.current = instance;
          if (typeof ref === "function") ref(instance);
          else if (ref) ref.current = instance;
        }}
        style={{ flex: 1, minHeight: 0 }}
        scrollerRef={(el) => {
          scrollerEl.current = el as HTMLElement | null;
        }}
        followOutput="auto"
        totalListHeightChanged={scrollEnd}
        increaseViewportBy={{ top: 400, bottom: 400 }}
        data={messages}
        itemContent={renderItem}
        computeItemKey={(_index, msg) => `${msg.role}-${msg.text.length}-${_index}`}
        components={virtuosoComponents}
      />
    );
  }
);

AgentChatHistoryInner.displayName = "AgentChatHistory";

const AgentChatHistory = memo(AgentChatHistoryInner);

export default AgentChatHistory;
