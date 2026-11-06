import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import type { VirtuosoHandle } from "react-virtuoso";
import { toast } from "sonner";
import { getServers, type ServerEntry } from "@/api/system/config";
import { agentUsageRequest, fetchAgents } from "@/api/agents";
import {
  getServerOptionLabel,
  truncateServerLabel,
} from "@/components/canva/topbar/listeners/components/logic";
import { agentMenuRuntimeRef } from "@/components/ui/rigth-click-menu.tsx";
import { tryConfirmDialogEnter } from "@/components/canva/utils/confirm-dialog-keydown";

export type ChatMessage = {
  role: "user" | "agent";
  text: string;
  contexts?: { id: string; key: string }[];
};

type PastedContext = { id: string; key: string; payload: Record<string, unknown[]> };

const contextKeys = new Set(["folders", "terminal", "sessions", "process"]);

function parseContextPaste(text: string): Omit<PastedContext, "id"> | null {
  try {
    const parsed = JSON.parse(text.trim());
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const keys = Object.keys(parsed);
    if (keys.length !== 1 || !contextKeys.has(keys[0]) || !Array.isArray(parsed[keys[0]])) return null;
    return { key: keys[0], payload: parsed };
  } catch {
    return null;
  }
}

function buildOutgoingMessage(message: string, contexts: PastedContext[]): string {
  if (!contexts.length) return message;

  const keyTotals = contexts.reduce<Record<string, number>>((acc, c) => {
    acc[c.key] = (acc[c.key] ?? 0) + 1;
    return acc;
  }, {});
  const keySeen: Record<string, number> = {};

  const sections = contexts
    .map((c) => {
      keySeen[c.key] = (keySeen[c.key] ?? 0) + 1;
      const label =
        keyTotals[c.key] > 1
          ? `## ${c.key.toUpperCase()} [${keySeen[c.key]}]`
          : `## ${c.key.toUpperCase()}`;
      const content = JSON.stringify(c.payload, null, 2);
      return `${label}\n\`\`\`json\n${content}\n\`\`\``;
    })
    .join("\n\n");

  const messageBlock = `# MESSAGE\n\n${message}`;
  const contextBlock = `# CONTEXT\n\n${sections}`;
  return `${messageBlock}\n\n${contextBlock}`;
}

export const contextPlaceholder = `[
  {
    "role": "user",
    "content": "Hello, how are you?"
  },
  {
    "role": "assistant",
    "content": "I'm good, thank you!"
  }
]`;

export function useAgentPanel() {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string; server?: string }[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [serverId, setServerId] = useState("");
  const [model, setModel] = useState("");
  const [contextMode, setContextMode] = useState<"default" | "custom">("default");
  const [customContext, setCustomContext] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [useFullContext, setUseFullContext] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [rightWidth, setRightWidth] = useState(440);
  const [isDragging, setIsDragging] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pastedContexts, setPastedContexts] = useState<PastedContext[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const clearConfirmRef = useRef<() => void>(() => {});
  const [response, setResponse] = useState<any>(null);
  const historyRef = useRef<VirtuosoHandle>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const syncInputHeight = (el: HTMLTextAreaElement) => {
    el.style.height = "5rem";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const onInputChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    syncInputHeight(e.target);
  }, []);

  const handleInputPaste = useCallback((e: ReactClipboardEvent<HTMLTextAreaElement>) => {
    const ctx = parseContextPaste(e.clipboardData.getData("text/plain"));
    if (!ctx) return;
    e.preventDefault();
    setPastedContexts((prev) => [...prev, { id: crypto.randomUUID(), ...ctx }]);
    toast.success(`${ctx.key} context attached`);
  }, []);

  const removePastedContext = useCallback((id: string) => {
    setPastedContexts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const serverLabel = (s: ServerEntry) =>
    truncateServerLabel(getServerOptionLabel(s));

  const serverKey = (s: ServerEntry) =>
    `${s.ip?.trim().replace(/\/$/, "")}:${s.port?.trim()}`;

  const getAgentsForServer = (s: ServerEntry) =>
    agents.filter((a) => a.server === serverKey(s));

  const buildContext = () => {
    if (!useFullContext || contextMode !== "custom") return [];
    try {
      const parsed = JSON.parse(customContext);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  useEffect(() => {
    getServers().then(setServers).catch(() => {});
  }, []);

  const agentsFetchRef = useRef<AbortController | null>(null);

  const refreshAgents = useCallback(() => {
    agentsFetchRef.current?.abort();
    const ctrl = new AbortController();
    agentsFetchRef.current = ctrl;
    setAgentsLoading(true);
    fetchAgents(ctrl.signal)
      .then((res) => {
        if (ctrl.signal.aborted) return;
        if (res?.status === "success" && Array.isArray(res.agents)) setAgents(res.agents);
      })
      .catch(() => {})
      .finally(() => {
        if (!ctrl.signal.aborted) setAgentsLoading(false);
      });
  }, []);

  useEffect(() => {
    refreshAgents();
    return () => agentsFetchRef.current?.abort();
  }, [refreshAgents]);

  useEffect(() => {
    if (!input && inputRef.current) inputRef.current.style.height = "5rem";
  }, [input]);

  useEffect(() => {
    if (!configOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfigOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [configOpen]);

  useEffect(() => {
    if (!showClearConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setShowClearConfirm(false);
        return;
      }
      tryConfirmDialogEnter(e, () => clearConfirmRef.current());
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [showClearConfirm]);

  const handleSend = async () => {
    const message = input.trim();
    if ((!message && !pastedContexts.length) || submitting) return;
    if (!serverId || !model) {
      toast.error(!serverId ? "Select a model" : "Select a model");
      return;
    }
    const server = servers.find((s) => s.id === serverId);
    const ip = server?.ip?.trim().replace(/\/$/, "");
    const port = server?.port?.trim();
    if (!ip || !port) {
      toast.error("Select a model");
      return;
    }
    const outgoingMessage = buildOutgoingMessage(message, pastedContexts);
    const contexts = pastedContexts.map(({ id, key }) => ({ id, key }));
    setInput("");
    setPastedContexts([]);
    setMessages((prev) => [...prev, { role: "user", text: message, contexts }]);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setSubmitting(true);
    try {
      const res = await agentUsageRequest(
        `${ip}:${port}/api/agents/`,
        {
          model,
          id: sessionId,
          message: outgoingMessage,
          context: buildContext(),
          system_prompt: systemPrompt.trim(),
          use_full_context: useFullContext,
        },
        controller.signal
      );
      if (controller.signal.aborted) return;
      setResponse(res);
      const reply =
        typeof res?.agent_response === "string"
          ? res.agent_response
          : typeof res?.message === "string" && res.status === "success"
            ? res.message
            : null;
      if (reply) {
        setMessages((prev) => [...prev, { role: "agent", text: reply }]);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setSubmitting(false);
        abortControllerRef.current = null;
      }
    }
  };

  const handleSendRef = useRef(handleSend);
  handleSendRef.current = handleSend;

  const handleCancelSubmit = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setSubmitting(false);
  }, []);

  const handleInputKeyDown = useCallback((e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendRef.current();
      if (inputRef.current) syncInputHeight(inputRef.current);
    }
  }, []);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightWidth;
    const maxWidth = splitContainerRef.current
      ? Math.max(280, splitContainerRef.current.offsetWidth - 8)
      : Math.round(1500 * 0.4);
    setIsDragging(true);
    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      setRightWidth(Math.max(280, Math.min(maxWidth, startWidth + delta)));
    };
    const onUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const panelStyle = {
    ...(configOpen ? { width: rightWidth } : { width: 0 }),
    ...(isDragging ? { transition: "none" } : {}),
  } as React.CSSProperties;

  const handleCopyHistory = () => {
    const context = messages.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    }));
    navigator.clipboard.writeText(`"context": ${JSON.stringify(context, null, 2)}`);
    toast.success("History copied");
  };

  const onModelChange = (name: string) => {
    setModel(name);
    const agent = agents.find((a) => a.name === name);
    if (!agent?.server) return;
    const match = servers.find(
      (s) => `${s.ip?.trim().replace(/\/$/, "")}:${s.port?.trim()}` === agent.server
    );
    if (match) setServerId(match.id);
  };

  const setInputValue = useCallback((value: string) => {
    setInput(value);
    requestAnimationFrame(() => {
      if (inputRef.current) syncInputHeight(inputRef.current);
    });
  }, []);

  agentMenuRuntimeRef.current = {
    inputRef,
    getInput: () => input,
    setInput: setInputValue,
    canEditInput: () => !submitting,
    hasHistory: () => messages.length > 0,
    copyHistory: handleCopyHistory,
    clearHistory: () => setShowClearConfirm(true),
  };

  useEffect(() => {
    return () => {
      agentMenuRuntimeRef.current = null;
    };
  }, []);

  clearConfirmRef.current = () => {
    setMessages([]);
    setShowClearConfirm(false);
  };

  return {
    servers,
    agents,
    serverId,
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
    toggleConfigOpen: () => setConfigOpen((v) => !v),
    closeConfig: () => setConfigOpen(false),
    openClearConfirm: () => setShowClearConfirm(true),
    closeClearConfirm: () => setShowClearConfirm(false),
    setServerId,
    setModel: onModelChange,
    setContextMode,
    setCustomContext,
    clearCustomContext: () => setCustomContext(""),
    formatCustomContext: () => {
      try {
        setCustomContext(JSON.stringify(JSON.parse(customContext), null, 4));
      } catch {
        toast.error("Invalid JSON");
      }
    },
    setSystemPrompt,
    setUseFullContext,
    setConfigOpen,
    setInput,
    handleSend,
    handleCancelSubmit,
    handleCopyHistory,
    showClearConfirm,
    setShowClearConfirm,
    handleConfirmClear: () => {
      setMessages([]);
      setShowClearConfirm(false);
    },
    handleResizeStart,
    agentsLoading,
    modelOpen,
    setModelOpen,
    refreshAgents,
    clearModelFilter: () => {
      setModel("");
      setServerId("");
      setModelOpen(false);
    },
    selectModel: (name: string) => {
      onModelChange(name);
      setModelOpen(false);
    },
  };
}
