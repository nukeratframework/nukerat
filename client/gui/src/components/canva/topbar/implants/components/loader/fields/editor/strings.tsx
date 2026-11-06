import Editor from "react-simple-code-editor";

const kw = new Set([
  "proc", "func", "method", "var", "let", "const", "static", "while", "if",
  "elif", "else", "when", "case", "of", "for", "break", "continue", "return",
  "discard", "import", "from", "include", "export", "try", "except", "finally",
  "raise", "defer", "echo", "block", "type", "object", "enum", "tuple",
  "template", "macro", "concept", "using", "mixin", "iterator",
]);
const lit = new Set(["true", "false", "nil"]);
const rx =
  /(#[\[](?:[^\]]|\](?!#))*[\]]#|#[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b\d+(?:\.\d+)?\b|[a-zA-Z_][\w*]*|\s+|[^\s\w])/g;

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function span(cls: string, text: string) {
  return `<span class="${cls}">${escapeHtml(text)}</span>`;
}

function highlight(code: string) {
  return code.split("\n").map((line) => {
    const out: string[] = [];
    let expectName = false;
    for (const m of line.matchAll(rx)) {
      const t = m[0];
      const p = m.index ?? 0;
      if (t.startsWith("#")) {
        out.push(span("hljs-comment", t));
        expectName = false;
      } else if (t[0] === '"' || t[0] === "'" || t[0] === "`") {
        out.push(span("hljs-string", t));
        expectName = false;
      } else if (/^\d/.test(t)) {
        out.push(span("hljs-number", t));
        expectName = false;
      } else if (kw.has(t)) {
        out.push(span("hljs-keyword", t));
        expectName = t === "proc" || t === "func" || t === "method" || t === "template" || t === "macro";
      } else if (lit.has(t)) {
        out.push(span("hljs-keyword", t));
        expectName = false;
      } else if (/^[a-zA-Z_]/.test(t)) {
        const name = t.replace(/\*+$/, "");
        const after = line.slice(p + t.length).trimStart().slice(0, 1);
        if (expectName || after === "(") {
          out.push(span("hljs-title function_", t));
          expectName = false;
        } else if (name[0] === name[0]?.toUpperCase() && name[0] !== name[0]?.toLowerCase()) {
          out.push(span("hljs-type", t));
        } else {
          out.push(span("hljs-variable", t));
        }
      } else {
        out.push(escapeHtml(t));
        if (/\S/.test(t)) expectName = false;
      }
    }
    return out.join("");
  }).join("\n");
}

export default function StringsEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="code-editor-scroll code-editor-scroll--strings">
      <Editor
        value={value}
        onValueChange={onChange}
        highlight={highlight}
        padding={12}
        className="code-editor font-mona-mono"
        textareaClassName="code-editor__input"
        preClassName="code-editor__pre"
        disabled={disabled}
        tabSize={4}
        style={{
          fontFamily: "'Mona Sans Mono', ui-monospace, monospace",
          fontSize: 13.5,
          lineHeight: "normal",
        }}
      />
    </div>
  );
}
