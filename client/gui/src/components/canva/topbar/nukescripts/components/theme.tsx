import type { ReactNode } from "react";

const kw = new Set([
  "def", "if", "elif", "else", "for", "while", "try", "except", "finally", "with",
  "class", "return", "in", "not", "and", "or", "True", "False", "None", "pass",
  "break", "continue", "lambda", "as", "import", "from", "raise", "yield",
]);
const native = new Set([
  "cmd", "async_cmd", "agent", "approve_cmd", "reject_cmd", "conclude", "echo",
  "process", "folders", "screenshot", "message_box", "keylogs", "print",
]);
const rx = /(#.*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|event\.\w+:\w+|\b\d+\.?\d*\b|[a-zA-Z_]\w*|\s+|[^\s\w])/g;

export function theme(text: string, on = true): ReactNode {
  if (!on) return text;
  return text.split("\n").map((line, li) => {
    const ms = [...line.matchAll(rx)];
    const nodes: ReactNode[] = [];
    if (li) nodes.push("\n");
    ms.forEach((m, i) => {
      const t = m[0], p = m.index ?? 0, prev = ms[i - 1]?.[0];
      if (t.startsWith("#")) {
        nodes.push(<span key={i} style={{ color: "#6a9955" }}>{t}</span>);
        return;
      }
      if (t[0] === '"' || t[0] === "'") {
        nodes.push(<span key={i} style={{ color: "#ce9178" }}>{t}</span>);
        return;
      }
      if (/^event\.\w+:\w+$/.test(t)) {
        const [, prop, fn] = t.match(/^event\.(\w+):(\w+)$/)!;
        nodes.push(
          <span key={`${i}e`} style={{ color: "#569cd6" }}>event</span>,
          <span key={`${i}p`} style={{ color: "#4ec9b0" }}>.{prop}</span>,
          <span key={`${i}c`} style={{ color: "#d4d4d4" }}>:</span>,
          <span key={`${i}f`} style={{ color: "#dcdcaa" }}>{fn}</span>,
        );
        return;
      }
      if (/^\d/.test(t)) {
        nodes.push(<span key={i} style={{ color: "#b5cea8" }}>{t}</span>);
        return;
      }
      if (t === "None" || t === "True" || t === "False") {
        nodes.push(<span key={i} style={{ color: "#569cd6" }}>{t}</span>);
        return;
      }
      if (kw.has(t)) {
        nodes.push(<span key={i} style={{ color: "#c586c0" }}>{t}</span>);
        return;
      }
      if (native.has(t)) {
        nodes.push(<span key={i} style={{ color: "#dcdcaa" }}>{t}</span>);
        return;
      }
      if (prev === "." && /^[a-zA-Z_]/.test(t)) {
        nodes.push(<span key={i} style={{ color: "#9cdcfe" }}>{t}</span>);
        return;
      }
      if (/^[a-zA-Z_]/.test(t) && line.slice(p + t.length).trimStart().startsWith("(")) {
        nodes.push(<span key={i} style={{ color: "#dcdcaa" }}>{t}</span>);
        return;
      }
      nodes.push(t);
    });
    return <span key={li}>{nodes}</span>;
  });
}
