import { memo, type RefObject } from "react";
import { Bot, Copy, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import FetchToast from "@/components/canva/utils/toast_rules";
import AgentChatHistory from "./components/content-view";
import AgentModelFilter from "./components/model-filter";
import SplitPanel from "./components/split";
import type { IDockviewPanelProps } from "dockview";
import { useAgentPanel } from "./components/logic";
import { AgentDockviewShell } from "./components/rigth-click-menu";

type AgentChatInputProps = {
  input: string;
  submitting: boolean;
  pastedContexts: { id: string; key: string }[];
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleInputPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  handleInputKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  removePastedContext: (id: string) => void;
};

const AgentChatInput = memo(function AgentChatInput({
  input,
  submitting,
  pastedContexts,
  inputRef,
  onInputChange,
  handleInputPaste,
  handleInputKeyDown,
  removePastedContext,
}: AgentChatInputProps) {
  return (
    <div
      data-agent-input
      className="flex min-w-0 w-full shrink-0 flex-col gap-2 overflow-x-auto border-t border-[#292929] p-2"
    >
      {pastedContexts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pastedContexts.map((item) => (
            <Badge
              key={item.id}
              variant="outline"
              style={{
                fontSize: "13px",
                padding: "2px 0px 0px 12px",
              }}
              className="gap-1 border-[#363636] bg-transparent text-[#cecece] font-normal rounded px-2 py-0.5"
            >
              {item.key}
              <button
                type="button"
                onClick={() => removePastedContext(item.id)}
                className="button-default rounded-sm border-none bg-transparent p-0 text-[#6b6b6b] hover:text-[#cecece] cursor-pointer"
              >
                <X size={11} />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <textarea
        ref={inputRef}
        value={input}
        onChange={onInputChange}
        onPaste={handleInputPaste}
        onKeyDown={handleInputKeyDown}
        disabled={submitting}
        placeholder={submitting ? "Waiting for response..." : "Ask the agent..."}
        autoComplete="off"
        spellCheck={false}
        className="box-border w-full min-w-[100px] min-h-[5rem] max-h-[10rem] resize-none overflow-y-auto rounded border border-[#363636] bg-[#1e1e1e] px-3 py-2 text-[13.5px] text-[#cecece] outline-none placeholder:text-[#444] disabled:cursor-not-allowed disabled:opacity-50"
        style={{ height: "5rem" }}
      />
    </div>
  );
});

const AgentPanel = (props: IDockviewPanelProps) => {
  const {
    servers,
    model,
    contextMode,
    customContext,
    systemPrompt,
    useFullContext,
    configOpen,
    messages,
    input,
    pastedContexts,
    submitting,
    response,
    historyRef,
    inputRef,
    splitContainerRef,
    onInputChange,
    handleInputPaste,
    removePastedContext,
    handleInputKeyDown,
    panelStyle,
    serverLabel,
    getAgentsForServer,
    agentsLoading,
    modelOpen,
    setModelOpen,
    refreshAgents,
    clearModelFilter,
    selectModel,
    toggleConfigOpen,
    closeConfig,
    openClearConfirm,
    closeClearConfirm,
    setContextMode,
    setCustomContext,
    clearCustomContext,
    formatCustomContext,
    setSystemPrompt,
    setUseFullContext,
    handleCopyHistory,
    showClearConfirm,
    handleConfirmClear,
    handleResizeStart,
    handleCancelSubmit,
  } = useAgentPanel();

  return (
    <AgentDockviewShell api={props.api}>
    <div className="flex w-full h-full flex-col bg-[#171717] text-[#d4d4d4] font-mono text-[12px] overflow-hidden select-text">
      <FetchToast response={response} />
      <div className="shrink-0 min-w-0 overflow-x-auto border-b border-[#252525] bg-[#171717]">
        <div className="box-border flex w-max min-w-full flex-nowrap items-center gap-2 p-2">
          <div
            style={{ borderRadius: "10px" }}
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#454545]"
          >
            <Bot size={16} className="text-[#c7c7c7]" />
          </div>
          <h2 className="shrink-0 whitespace-nowrap text-[15px] font-semibold text-[#cecece]">
            AI Agent
          </h2>
          <div className="min-w-2 flex-1 shrink" aria-hidden />
          <button
            type="button"
            onClick={handleCopyHistory}
            disabled={messages.length === 0}
            title="Copy"
            className="button-default flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded border border-[#333] bg-[#232323] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            onClick={openClearConfirm}
            disabled={messages.length === 0}
            title="Clear"
            className="button-default flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded border border-[#333] bg-[#232323] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] cursor-pointer disabled:cursor-not-allowed disabled:opacity-25"
          >
            <Trash2 size={14} />
          </button>
          <AgentModelFilter
            servers={servers}
            getAgentsForServer={getAgentsForServer}
            serverLabel={serverLabel}
            loading={agentsLoading}
            model={model}
            open={modelOpen}
            onOpen={setModelOpen}
            onRefresh={refreshAgents}
            onSelect={selectModel}
            onClear={clearModelFilter}
            placeholder="Select a model"
          />
          <button
            type="button"
            onClick={toggleConfigOpen}
            className="button-default flex h-[29px] shrink-0 items-center rounded border border-[#333] bg-[#232323] px-3 text-[13px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#d4d4d4] cursor-pointer"
          >
            Settings
          </button>
        </div>
      </div>

      <div ref={splitContainerRef} className="flex flex-1 min-h-0 min-w-0 overflow-hidden relative">
        <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
          <div className="flex-1 min-h-0 min-w-0 overflow-hidden bg-[#171717] border-b border-[#252525]">
            <AgentChatHistory
              ref={historyRef}
              messages={messages}
              submitting={submitting}
              onCancelSubmit={handleCancelSubmit}
            />
          </div>

          <AgentChatInput
            input={input}
            submitting={submitting}
            pastedContexts={pastedContexts}
            inputRef={inputRef}
            onInputChange={onInputChange}
            handleInputPaste={handleInputPaste}
            handleInputKeyDown={handleInputKeyDown}
            removePastedContext={removePastedContext}
          />
        </div>

        {configOpen && (
          <div
            style={{ backgroundColor: "#171717" }}
            className="z-999 bg-[#171717] flex w-2 shrink-0 cursor-col-resize items-center justify-center group transition-colors border-l border-l-[#2a2a2a]"
            onMouseDown={handleResizeStart}
          />
        )}

        <div
          className={`flex flex-col min-h-0 min-w-0 bg-[#181818] overflow-hidden transition-[width] duration-300 ease-in-out ${
            configOpen
              ? "shrink border-l border-[#2a2a2a]"
              : "w-0 shrink-0 pointer-events-none overflow-hidden"
          }`}
          style={{ ...panelStyle }}
        >
          {configOpen && (
            <SplitPanel
              systemPrompt={systemPrompt}
              setSystemPrompt={setSystemPrompt}
              contextMode={contextMode}
              setContextMode={setContextMode}
              customContext={customContext}
              setCustomContext={setCustomContext}
              onClose={closeConfig}
              clearCustomContext={clearCustomContext}
              formatCustomContext={formatCustomContext}
            />
          )}
        </div>
      </div>

      {showClearConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            style={{ borderRadius: "8px" }}
            className="bg-[#191919] border border-[#2f2f2f] p-5 max-w-sm w-[90%] shadow-2xl"
          >
            <div className="flex items-center gap-2 mb-3">
              <Trash2 size={14} className="text-[#c97070] mb-0.5" />
              <span className="text-[13.5px] font-semibold text-[#cecece]">
                Clear History
              </span>
            </div>
            <p className="text-[13px] text-[#9b9b9b] mb-5 leading-relaxed">
              Clear chat history? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={closeClearConfirm}
                className="button-default px-3 py-1 rounded text-[12px] text-[#9b9b9b] hover:text-[#d4d4d4] hover:bg-[#252525] transition-colors border border-[#333] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClear}
                className="button-default flex items-center gap-1.5 px-3 py-1 rounded text-[12px] text-white bg-[#8b2020] hover:bg-[#a83232] transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </AgentDockviewShell>
  );
};

export default AgentPanel;
