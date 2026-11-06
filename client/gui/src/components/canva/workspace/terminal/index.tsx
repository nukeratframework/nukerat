import { memo, type RefObject } from 'react';
import { MdOutlineCancel } from 'react-icons/md';
import { useTerminal } from './components/logic';
import TerminalOutput from './components/content-view';
import type { Session } from "@/api/sessions";
import { SendHorizontal } from 'lucide-react';
import type { IDockviewPanelProps } from 'dockview';
import { TerminalDockviewShell } from './components/rigth-click-menu';

type TerminalPanelParams = {
  selectedHost?: { host: Session, server: string } | null;
};

type TerminalInputBarProps = {
  input: string;
  session: string;
  isLoading: boolean;
  hostUnavailable: boolean;
  isSearch: boolean;
  isConfirming: boolean;
  confirmingCommand: string;
  commandPrefix: string | null;
  searchMatchIndex: number;
  matchOccurrences: { itemIndex: number; occurrenceInItem: number }[];
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onCancelLoading: () => void;
  onClearPrefix: () => void;
  onSend: () => void;
};

const TerminalInputBar = memo(function TerminalInputBar({
  input,
  session,
  isLoading,
  hostUnavailable,
  isSearch,
  isConfirming,
  confirmingCommand,
  commandPrefix,
  searchMatchIndex,
  matchOccurrences,
  inputRef,
  onChange,
  onKeyDown,
  onCancelLoading,
  onClearPrefix,
  onSend,
}: TerminalInputBarProps) {
  const sendDisabled = input.trim() ? hostUnavailable || isLoading : true;
  const searchActive = isSearch && !isLoading;

  return (
    <div className="qX9lW overflow-x-auto" style={{ minWidth: '10rem' }}>
      {session ? <span className="oKD1s">({session})</span> : null}
      {isLoading && (
        <>
          <button className="button-default" onClick={onCancelLoading}>
            <MdOutlineCancel style={{ color: '#8d8d8d', marginRight: '1px', cursor: 'pointer' }} />
          </button>
          <svg style={{ minWidth: 12 }} className="animate-spin shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
            <path d="M2 12a10 10 0 0 1 10 -10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </>
      )}
      <span
        className={`whitespace-nowrap bZ5cQ ${hostUnavailable && !searchActive && !isConfirming ? 'opacity-60' : ''}`}
        style={searchActive ? { color: '#ff9843' } : isConfirming ? { color: '#fbbf24' } : undefined}
      >
        {searchActive
          ? <>
              search
              {input.trim() && (
                <span style={{ color: '#929193' }}>
                  {' '}({matchOccurrences.length === 0 ? '0/0' : `${searchMatchIndex < 0 ? 0 : searchMatchIndex + 1}/${matchOccurrences.length}`})
                </span>
              )}
              {' >'}
            </>
          : isConfirming
            ? `Execute "${confirmingCommand}"? [Y/n]`
            : 'implant >'}
      </span>
      {commandPrefix && !searchActive && !isConfirming && (
        <span
          className="shrink-0 whitespace-nowrap"
          style={{ color: '#6eb5ff', userSelect: 'none' }}
        >
          {commandPrefix}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClearPrefix(); }}
            className="button-default opacity-50 hover:opacity-100"
            style={{ color: '#6eb5ff', padding: '0 2px', marginLeft: 1, lineHeight: 1, cursor: 'pointer' }}
            title="Clear prefix (Esc)"
          >
            ×
          </button>
        </span>
      )}
      <div className="min-w-0 flex-1" data-terminal-input>
        <input
          ref={inputRef}
          data-terminal-input-field="command"
          type="text"
          value={input}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onClick={(e) => e.stopPropagation()}
          className={`pL8mF w-full ${hostUnavailable ? 'cursor-not-allowed opacity-60' : ''}`}
          autoComplete="off"
          spellCheck={false}
          readOnly={isLoading}
          disabled={hostUnavailable}
        />
      </div>
      <button
        type="button"
        title="Send (Enter)"
        disabled={sendDisabled}
        onClick={(e) => {
          e.stopPropagation();
          onSend();
        }}
        className="button-default flex shrink-0 items-center justify-center border-none bg-transparent p-0 text-[#888] shadow-none hover:bg-transparent hover:text-[#cecece] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      >
        <SendHorizontal size={16} className="shrink-0" strokeWidth={2} />
      </button>
    </div>
  );
});

const TerminalWindow = (props: IDockviewPanelProps<TerminalPanelParams>) => {
  const selectedHost = props.params?.selectedHost ?? null;
  const {
    hostUnavailable, input, output, session, isLoading, isConfirming, confirmingCommand,
    isSearch, searchMatchIndex, matchOccurrences, activeOccurrenceInItem, commandPrefix,
    contentFontSize, terminalRootRef,
    inputRef, cancelLoading, clearCommandPrefix,
    handleChange, handleKeyDown, sendInput, handleContainerClick, handleContainerMouseDown
  } = useTerminal(selectedHost);

  return (
    <TerminalDockviewShell api={props.api}>
      <div
        ref={terminalRootRef}
        data-terminal-panel
        className="tHa7k dv-bg-window cursor-text select-text h-full"
        style={{ fontSize: contentFontSize }}
        onClick={handleContainerClick}
        onMouseDown={handleContainerMouseDown}
      >
        <div id="output" className="mK2vP">
          <div data-terminal-output className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <TerminalOutput
              output={output}
              searchQuery={isSearch && !isLoading && input.trim() ? input : undefined}
              searchMatchIndex={searchMatchIndex}
              activeItemIndex={searchMatchIndex >= 0 ? matchOccurrences[searchMatchIndex]?.itemIndex : undefined}
              activeOccurrenceInItem={activeOccurrenceInItem}
            />
          </div>
          <TerminalInputBar
            input={input}
            session={session}
            isLoading={isLoading}
            hostUnavailable={hostUnavailable}
            isSearch={isSearch}
            isConfirming={isConfirming}
            confirmingCommand={confirmingCommand}
            commandPrefix={commandPrefix}
            searchMatchIndex={searchMatchIndex}
            matchOccurrences={matchOccurrences}
            inputRef={inputRef}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onCancelLoading={cancelLoading}
            onClearPrefix={clearCommandPrefix}
            onSend={sendInput}
          />
        </div>
      </div>
    </TerminalDockviewShell>
  );
};

export default TerminalWindow;
