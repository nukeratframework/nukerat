import type { ReactNode } from "react";
import { highlight, renderLines } from "@/components/canva/workspace/terminal/components/logic";

const renderPlainLines = (text: string): ReactNode =>
  text.split("\n").map((str, j) => {
    const lineText = str.replace(/\r/g, "").replace(/ /g, "\u00A0");
    return (
      <span key={j}>
        {lineText}
        <br />
      </span>
    );
  });

const normalizeEscapes = (raw: string) =>
  raw.replace(/<br\s*\/?>/gi, "\n").replace(/\\n/g, "\n");

export const formatNsDebuggerContent = (
  content: unknown,
  searchQuery?: string,
  activeOcc?: number,
): ReactNode => {
  const raw = content == null ? "" : String(content);
  const text = normalizeEscapes(raw).replace(/\r/g, "");
  if (searchQuery?.trim()) {
    return renderLines(text, searchQuery.trim(), activeOcc);
  }
  return renderPlainLines(text);
};

export { highlight };
