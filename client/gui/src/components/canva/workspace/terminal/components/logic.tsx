import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  beginDownloadProgress,
  endDownloadProgress,
  requestServerDownloadDelete,
} from '@/components/ui/downloads_activity';
import { COMMAND_LIST, CONFIRM_COMMANDS } from './values';
import { fileBytesLogic, type DownloadExtras } from './fileBytesLogic';
import { DataFetch } from '@/api/terminal';
import type { Session } from "@/api/sessions";
import { terminalMenuRuntimeRef } from "@/components/ui/rigth-click-menu.tsx";

const TERMINAL_CONTENT_FONT = {
  defaultPx: 13.5,
  minPx: 8,
  maxPx: 20,
  stepPx: 0.5,
} as const;

const clampTerminalFontSize = (px: number) =>
  Math.min(TERMINAL_CONTENT_FONT.maxPx, Math.max(TERMINAL_CONTENT_FONT.minPx, px));

const getTerminalOutputTextSelection = (root: HTMLDivElement | null): Selection | null => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString()) return null;
  const outputEl = root?.querySelector('[data-terminal-output]');
  if (!outputEl || selection.rangeCount === 0) return null;
  if (!outputEl.contains(selection.getRangeAt(0).commonAncestorContainer)) return null;
  return selection;
};

const isTerminalRequestError = (response: any): boolean => {
  const status = response?.status;
  return status === 'failure' || status === 'error' || status === 'ERR_conn';
};

const terminalRequestErrorMessage = (response: any, fallback: string): string =>
  response?.message ?? response?.error ?? response?.custom_response ?? fallback;

// command --------------------------------------------

export const executeCommand = async (
  command: string,
  history: string[],
  currentSession: string,
  server?: string,
  extraData: object = {},
  signal?: AbortSignal
): Promise<{ output: string | any; newHistory: string[]; session?: string; cancelled?: boolean }> => {
  const trimmedCmd = command.trim();
  const cmdParts = trimmedCmd.split(' ');
  const cmdName = cmdParts[0];
  const cmdArg = cmdParts.slice(1).join(' ');

  if (cmdName === 'clear') return { output: '', newHistory: history };
  if (cmdName === 'history') {
    return { output: history.map((cmd, i) => `  ${i + 1} ${cmd}`).join('\n'), newHistory: history };
  }
  if (cmdName === 'session') {
    if (cmdArg) {
      return { output: `Session changed to: ${cmdArg}`, newHistory: trimmedCmd ? [...history, trimmedCmd] : history, session: cmdArg };
    }
    return { output: `Current session: ${currentSession.substring(0, 100)}`, newHistory: trimmedCmd ? [...history, trimmedCmd] : history };
  }
  if (cmdName === 'exit') {
    return { output: 'Session terminated', newHistory: trimmedCmd ? [...history, trimmedCmd] : history, session: '' };
  }

  // ======= download =======
  let processedCmd = trimmedCmd;
  let downloadExtras: DownloadExtras = {
    download_bytes: false,
  };
  let uploadPath: string | undefined;
  try {
    const prepared = await fileBytesLogic.prepare(trimmedCmd);
    processedCmd = prepared.processedCmd;
    downloadExtras = prepared.downloadExtras;
    uploadPath = prepared.uploadPath;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read file';
    return { output: message, newHistory: trimmedCmd ? [...history, trimmedCmd] : history };
  }

  if (signal?.aborted) return { output: null, newHistory: history, cancelled: true };

  let fetchSignal = signal;

  const abortController =
    extraData && typeof extraData === 'object' && '__abortController' in extraData
      ? (extraData as { __abortController?: AbortController }).__abortController
      : undefined;
  let fetchExtra: Record<string, unknown> = { ...extraData, ...downloadExtras };
  delete fetchExtra.__abortController;
  if (uploadPath) fetchExtra.upload_path = uploadPath;
  if (downloadExtras.download_bytes) {
    const dest =
      downloadExtras.download_output ??
      (window.electronAPI
        ? await window.electronAPI.invoke('file:pickSavePath', {
            defaultName: downloadExtras.download_name ?? 'download',
          })
        : null);
    if (!dest) {
      return { output: 'Download cancelled', newHistory: trimmedCmd ? [...history, trimmedCmd] : history };
    }
    const progressName =
      downloadExtras.download_name ?? String(dest).split(/[/\\]/).filter(Boolean).pop() ?? 'download';
    const downloadProgress = await beginDownloadProgress(
      progressName,
      String(dest),
      downloadExtras.download_source ?? progressName,
      abortController,
      server,
    );
    fetchExtra = {
      ...fetchExtra,
      download_dest: dest,
      download_id: downloadProgress.id,
      download_file: progressName,
    };
    fetchSignal = downloadProgress.signal;
  }
  const response = await DataFetch(processedCmd, server, fetchExtra, currentSession || false, fetchSignal);
  if (response?.status === 'aborted') {
    if (downloadExtras.download_bytes) {
      const extra = fetchExtra as { download_dest?: string; download_id?: string };
      if (extra.download_id) {
        requestServerDownloadDelete(extra.download_id);
        if (window.electronAPI && extra.download_dest) {
          void window.electronAPI.invoke('file:downloadClose', extra.download_dest).catch(() => {});
        }
        endDownloadProgress(extra.download_id, false, true);
      }
    }
    return { output: null, newHistory: history, cancelled: true };
  }
  if (isTerminalRequestError(response) || response?.custom_response) {
    const message = terminalRequestErrorMessage(response, 'Request failed');
    if (downloadExtras.download_bytes) {
      const progressName =
        downloadExtras.download_name ??
        String((fetchExtra as { download_dest?: string }).download_dest ?? '')
          .split(/[/\\]/)
          .filter(Boolean)
          .pop() ??
        'download';
      const failId = (fetchExtra as { download_id?: string }).download_id;
      if (failId) endDownloadProgress(failId, false);
    }
    return { output: message, newHistory: trimmedCmd ? [...history, trimmedCmd] : history };
  }

  if (downloadExtras.download_bytes) {
    const output = await fileBytesLogic.saveDownload(response, downloadExtras);
    return { output, newHistory: trimmedCmd ? [...history, trimmedCmd] : history };
  }
  // =======================

  // ============= normal ============
  return {
    output: response?.output ?? response,
    newHistory: trimmedCmd ? [...history, trimmedCmd] : history,
  };
};

const joinPrefix = (prefix: string | null, input: string) =>
  (prefix ? `${prefix} ${input}` : input).trim();

const splitPrefixed = (cmd: string, prefix: string | null) => {
  if (!prefix) return { prefix: null as string | null, input: cmd };
  const lead = `${prefix} `;
  return cmd.startsWith(lead)
    ? { prefix, input: cmd.slice(lead.length) }
    : { prefix: null, input: cmd };
};

const isPrefixMeta = (s: string) => /^prefix(\s|$)/i.test(s.trim());

export const getAutocomplete = (input: string, prefix: string | null = null): string | null => {
  const full = prefix ? `${prefix} ${input}` : input;
  const match = COMMAND_LIST.find((cmd) => cmd.startsWith(full));
  if (!match || (!input && !prefix)) return null;
  const rest = prefix ? match.slice(prefix.length + 1) : match;
  return rest ? `${rest} ` : null;
};

// content-view --------------------------------------------

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeTerminalText = (s: string) => s.replace(/\r/g, '').replace(/ /g, '\u00A0');

export const terminalLineSearchText = (line: unknown): string => {
  let text = typeof line === 'object' && line !== null ? JSON.stringify(line) : String(line);
  if (text.startsWith('$')) text = text.slice(2);
  return text.split('\n').map(normalizeTerminalText).join('\n');
};

const nextSearchMatchIndex = (prev: number, len: number) => (prev < 0 ? 0 : (prev + 1) % len);

export const highlight = (text: string, query: string, activeOcc?: number) => {
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
  let matchCount = 0;
  return (
    <>
      {parts.map((part, i) => {
        if (part.toLowerCase() === query.toLowerCase()) {
          const isActive = activeOcc != null && matchCount === activeOcc;
          matchCount++;
          return isActive
            ? (
              <mark
                key={i}
                data-terminal-active-match
                style={{ background: '#ff9843', color: '#010910', borderRadius: 2 }}
              >
                {part}
              </mark>
            )
            : <mark key={i} style={{ background: '#feff49', color: '#010910', borderRadius: 2 }}>{part}</mark>;
        }
        return part;
      })}
    </>
  );
};

export const renderLines = (text: string, query?: string, activeOcc?: number) => {
  const lines = text.split('\n');
  let occsSoFar = 0;
  return lines.map((str, j) => {
    const lineText = normalizeTerminalText(str);
    let activeOccInLine: number | undefined;
    if (query && activeOcc != null) {
      const q = query.toLowerCase();
      const lower = lineText.toLowerCase();
      let lineCount = 0;
      let p = 0;
      while ((p = lower.indexOf(q, p)) !== -1) { lineCount++; p += q.length; }
      if (activeOcc >= occsSoFar && activeOcc < occsSoFar + lineCount) activeOccInLine = activeOcc - occsSoFar;
      occsSoFar += lineCount;
    }
    return (
      <span key={j}>
        {query ? highlight(lineText, query, activeOccInLine) : lineText}
        <br />
      </span>
    );
  });
};

// index --------------------------------------------

const generateRandomId = (length = 6) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
};

export const useTerminal = (selectedHost?: { host: Session, server: string } | null) => {
  const hostUnavailable = !selectedHost;
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [output, setOutput] = useState<any[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [sourceTerminal] = useState(generateRandomId(6));
  const inputRef = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmingCommand, setConfirmingCommand] = useState('');
  const [isSearch, setIsSearch] = useState(false);
  const [searchMatchIndex, setSearchMatchIndex] = useState(-1);
  const [commandPrefix, setCommandPrefix] = useState<string | null>(null);
  const inputLengthRef = useRef(0);
  inputLengthRef.current = input.length;
  const [contentFontSize, setContentFontSize] = useState<number>(TERMINAL_CONTENT_FONT.defaultPx);
  const terminalRootRef = useRef<HTMLDivElement>(null);
  const isTerminalHoveredRef = useRef(false);

  useEffect(() => {
    const el = terminalRootRef.current;
    if (!el) return;

    const onEnter = () => {
      isTerminalHoveredRef.current = true;
    };
    const onLeave = () => {
      isTerminalHoveredRef.current = false;
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey || !isTerminalHoveredRef.current) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -TERMINAL_CONTENT_FONT.stepPx : TERMINAL_CONTENT_FONT.stepPx;
      setContentFontSize((prev) => clampTerminalFontSize(prev + delta));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isTerminalHoveredRef.current) return;
      if (!e.ctrlKey || !e.altKey || e.metaKey) return;
      if (e.key !== '0' && e.code !== 'Digit0') return;
      e.preventDefault();
      setContentFontSize(TERMINAL_CONTENT_FONT.defaultPx);
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const matchOccurrences = useMemo(() => {
    if (!isSearch || !input.trim()) return [] as { itemIndex: number; occurrenceInItem: number }[];
    const query = input.toLowerCase();
    const result: { itemIndex: number; occurrenceInItem: number }[] = [];
    for (let i = 0; i < output.length; i++) {
      const lower = terminalLineSearchText(output[i]).toLowerCase();
      let pos = 0;
      let occ = 0;
      while ((pos = lower.indexOf(query, pos)) !== -1) {
        result.push({ itemIndex: i, occurrenceInItem: occ });
        pos += query.length;
        occ++;
      }
    }
    return result;
  }, [isSearch, input, output]);

  useEffect(() => {
    setSearchMatchIndex(
      !isSearch || !input.trim() || !matchOccurrences.length ? -1 : 0
    );
  }, [input, isSearch, matchOccurrences]);

  const activeOccurrenceInItem = searchMatchIndex >= 0 ? matchOccurrences[searchMatchIndex]?.occurrenceInItem : undefined;

  const exitSearch = () => {
    setIsSearch(false);
    setInput('');
    setSearchMatchIndex(-1);
  };

  const clearCommandPrefix = useCallback(() => {
    setCommandPrefix(null);
    setInput('');
    setHistoryIndex(-1);
    inputRef.current?.focus();
  }, []);

  const handlePrefixMeta = (raw: string) => {
    const trimmed = raw.trim();
    const arg = trimmed.slice(6).trim();
    let msg: string;
    if (!arg) msg = commandPrefix ? `Current prefix: ${commandPrefix}` : 'No prefix set\n';
    else if (arg.toLowerCase() === 'clear') { setCommandPrefix(null); msg = 'Prefix cleared\n'; }
    else { setCommandPrefix(arg); msg = `Prefix set: ${arg}\n`; }
    setOutput([...output, `$ ${trimmed}`, msg]);
    setHistory([...history, trimmed]);
    setCommandHistory([...commandHistory, trimmed]);
    setInput('');
    setHistoryIndex(-1);
  };

  const handleSubmit = async (suffix: string) => {
    if (isConfirming) {
      const answer = suffix.trim().toLowerCase();
      const pending = confirmingCommand;
      setIsConfirming(false);
      setConfirmingCommand('');
      if (answer !== 'y') { setInput(''); setHistoryIndex(-1); return; }
      await runCommand(pending);
      return;
    }

    if (!commandPrefix && isPrefixMeta(suffix)) {
      handlePrefixMeta(suffix);
      return;
    }

    let cmd = suffix.trim();
    if (commandPrefix) cmd = `${commandPrefix} ${cmd}`.trim();
    if (!cmd) return;

    if (CONFIRM_COMMANDS.some(c => cmd.toLowerCase().startsWith(c))) {
      setIsConfirming(true);
      setConfirmingCommand(cmd.toLowerCase());
      setInput('');
      setHistoryIndex(-1);
      return;
    }

    await runCommand(cmd);
  };

  const runCommand = async (cmd: string) => {
    setHistory([...history, cmd]);
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsSearch(false);
    setSearchMatchIndex(-1);
    setIsLoading(true);

    try {
      const { output: result, session: newSession, cancelled } = await executeCommand(
        cmd, [...history, cmd], session, selectedHost?.server,
        {
          source_terminal: sourceTerminal,
          host_tag: selectedHost?.host?.tag ?? null,
          __abortController: controller,
        },
        controller.signal
      );

      if (cancelled) return;

      if (newSession !== undefined) setSession(newSession);

      if (cmd === 'clear') {
        setOutput([]);
      } else {
        let displayResult = result;
        if (typeof result === 'object' && result !== null) {
          displayResult = result.message !== undefined ? result.message : JSON.stringify(result);
        }
        setOutput([...output, `$ ${cmd}`, displayResult]);
        setCommandHistory([...commandHistory, cmd]);
      }

      setInput('');
      setHistoryIndex(-1);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsLoading(false);
    }
  };

  const cancelLoading = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, []);

  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.key.toLowerCase() !== 'c') return;
      if (!isTerminalHoveredRef.current) return;
      if (!isLoadingRef.current) return;
      const outputSelection = getTerminalOutputTextSelection(terminalRootRef.current);
      if (outputSelection) {
        queueMicrotask(() => outputSelection.removeAllRanges());
        return;
      }
      e.preventDefault();
      cancelLoading();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cancelLoading]);

  const handleEmptyEnter = () => {
    setOutput([...output, '$ ']);
    setInput('');
    setHistoryIndex(-1);
  };

  const handleCtrlC = () => {
    if (isConfirming) {
      setIsConfirming(false);
      setConfirmingCommand('');
      setInput('');
      setHistoryIndex(-1);
      return;
    }
    setOutput([...output, `$ ${joinPrefix(commandPrefix, input)}^C`]);
    setInput('');
    setHistoryIndex(-1);
  };

  const terminalKeyStateRef = useRef({
    input, isConfirming, isSearch, isLoading, historyIndex, commandHistory, commandPrefix,
  });
  terminalKeyStateRef.current = {
    input, isConfirming, isSearch, isLoading, historyIndex, commandHistory, commandPrefix,
  };

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    const prefix = terminalKeyStateRef.current.commandPrefix;
    if (prefix) {
      const lead = `${prefix} `;
      if (value.startsWith(lead)) value = value.slice(lead.length);
    }
    setInput(value);
  }, []);

  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;
  const handleEmptyEnterRef = useRef(handleEmptyEnter);
  handleEmptyEnterRef.current = handleEmptyEnter;
  const handleCtrlCRef = useRef(handleCtrlC);
  handleCtrlCRef.current = handleCtrlC;
  const exitSearchRef = useRef(exitSearch);
  exitSearchRef.current = exitSearch;
  const clearCommandPrefixRef = useRef(clearCommandPrefix);
  clearCommandPrefixRef.current = clearCommandPrefix;
  const matchOccurrencesRef = useRef(matchOccurrences);
  matchOccurrencesRef.current = matchOccurrences;

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const {
      input: currentInput,
      isConfirming: confirming,
      isSearch: searching,
      isLoading: loading,
      historyIndex: histIdx,
      commandHistory: cmdHist,
      commandPrefix: activePrefix,
    } = terminalKeyStateRef.current;

    const isCtrlC = e.ctrlKey && e.key.toLowerCase() === 'c';
    const isCtrlF = e.ctrlKey && e.key.toLowerCase() === 'f';
    const isEnter = e.key === 'Enter';

    if (isCtrlF) {
      e.preventDefault();
      if (!confirming && !loading) {
        setIsSearch((prev) => {
          setInput('');
          setSearchMatchIndex(-1);
          if (!prev) setCommandPrefix(null);
          return !prev;
        });
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (searching) exitSearchRef.current();
      else if (confirming) handleCtrlCRef.current();
      else if (activePrefix) clearCommandPrefixRef.current();
      return;
    }
    if (isCtrlC && searching) { e.preventDefault(); exitSearchRef.current(); return; }

    if (searching && !loading) {
      if (isEnter) {
        e.preventDefault();
        const matches = matchOccurrencesRef.current;
        if (matches.length > 0) setSearchMatchIndex((prev) => nextSearchMatchIndex(prev, matches.length));
      }
      return;
    }

    if (loading && isEnter) { e.preventDefault(); return; }
    if (loading && isCtrlC) {
      const outputSelection = getTerminalOutputTextSelection(terminalRootRef.current);
      if (outputSelection) {
        queueMicrotask(() => outputSelection.removeAllRanges());
        return;
      }
      e.preventDefault();
      return;
    }

    if (isCtrlC) {
      if (confirming) { e.preventDefault(); handleCtrlCRef.current(); return; }
      const hasSelection = inputRef.current && inputRef.current.selectionStart !== inputRef.current.selectionEnd;
      if (!hasSelection) { e.preventDefault(); handleCtrlCRef.current(); }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const suggestion = getAutocomplete(currentInput, activePrefix);
      if (suggestion) setInput(suggestion);
    } else if (isEnter) {
      if (!currentInput.trim()) {
        if (!confirming && !activePrefix) handleEmptyEnterRef.current();
      } else handleSubmitRef.current(currentInput);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const goingUp = e.key === 'ArrowUp';
      const newIndex = goingUp ? histIdx + 1 : histIdx - 1;
      if (goingUp && newIndex >= cmdHist.length) return;
      if (!goingUp && newIndex < 0) { setHistoryIndex(-1); setInput(''); return; }
      const { prefix, input: histInput } = splitPrefixed(cmdHist[cmdHist.length - 1 - newIndex], activePrefix);
      setHistoryIndex(newIndex);
      setCommandPrefix(prefix);
      setInput(histInput);
    }
  }, []);

  const sendInput = useCallback(() => {
    const {
      input: currentInput,
      isConfirming: confirming,
      isSearch: searching,
      isLoading: loading,
      commandPrefix: activePrefix,
    } = terminalKeyStateRef.current;

    if (searching && !loading) {
      const matches = matchOccurrencesRef.current;
      if (matches.length > 0) setSearchMatchIndex((prev) => nextSearchMatchIndex(prev, matches.length));
      return;
    }
    if (loading) return;

    if (!currentInput.trim()) {
      if (!confirming && !activePrefix) handleEmptyEnterRef.current();
    } else handleSubmitRef.current(currentInput);
  }, []);

  const handleContainerClick = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;
    if (inputRef.current !== document.activeElement) {
      const len = inputLengthRef.current;
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.setSelectionRange(len, len);
    }
  }, []);

  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const selection = window.getSelection();
    const hasSelection = selection && selection.toString().length > 0;
    const inputHasFocus = inputRef.current === document.activeElement;
    if (hasSelection && !inputHasFocus) selection?.removeAllRanges();
    if (!inputHasFocus) {
      const len = inputLengthRef.current;
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.setSelectionRange(len, len);
    }
  }, []);

  const setInputValue = useCallback((value: string) => {
    setInput(value);
  }, []);

  terminalMenuRuntimeRef.current = {
    inputRef,
    getInput: () => input,
    setInput: setInputValue,
    canEditInput: () => !hostUnavailable && !isLoading && !isSearch && !isConfirming,
    getOutput: () => output,
    canCopyContext: () => output.length > 0,
    getFontSize: () => contentFontSize,
    increaseFont: () =>
      setContentFontSize((prev) => clampTerminalFontSize(prev + TERMINAL_CONTENT_FONT.stepPx)),
    decreaseFont: () =>
      setContentFontSize((prev) => clampTerminalFontSize(prev - TERMINAL_CONTENT_FONT.stepPx)),
    resetFont: () => setContentFontSize(TERMINAL_CONTENT_FONT.defaultPx),
    canIncreaseFont: () => contentFontSize < TERMINAL_CONTENT_FONT.maxPx,
    canDecreaseFont: () => contentFontSize > TERMINAL_CONTENT_FONT.minPx,
    canResetFont: () => contentFontSize !== TERMINAL_CONTENT_FONT.defaultPx,
  };

  useEffect(() => {
    return () => {
      terminalMenuRuntimeRef.current = null;
    };
  }, []);

  return {
    hostUnavailable, input, output, session, isLoading, isConfirming, confirmingCommand,
    isSearch, searchMatchIndex, matchOccurrences, activeOccurrenceInItem, commandPrefix,
    contentFontSize, terminalRootRef,
    inputRef, cancelLoading, clearCommandPrefix,
    handleChange, handleKeyDown, sendInput, handleContainerClick, handleContainerMouseDown
  };
};
