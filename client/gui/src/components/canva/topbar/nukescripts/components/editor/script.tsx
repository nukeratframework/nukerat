import Editor from "react-simple-code-editor";

const kw = new Set([
  "def", "class", "if", "elif", "else", "for", "while", "return", "import", "from",
  "as", "with", "try", "except", "finally", "raise", "pass", "break", "continue",
  "and", "or", "not", "in", "is", "lambda", "yield", "global", "nonlocal", "assert", "del",
  "async", "await",
]);
const lit = new Set(["True", "False", "None"]);
const builtin = new Set([
  "cmd", "async_cmd", "process", "folders", "screenshot",
  "approve_cmd", "reject_cmd", "conclude",
  "credentials", "keylogs", "db", "network", "file_server", "agent", "echo", "message_box",
]);
const rx =
  /(#[^\n]*|"""(?:[^"]|"(?!""))*"""|'''(?:[^']|'(?!'))*'''|f?"(?:[^"\\]|\\.)*"|f?'(?:[^'\\]|\\.)*'|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|event\.\w+|[a-zA-Z_]\w*|\s+|[^\s\w])/g;

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
    let expectMethod = false;
    for (const m of line.matchAll(rx)) {
      const t = m[0];
      const p = m.index ?? 0;
      if (t.startsWith("#")) {
        out.push(span("hljs-comment", t));
        expectName = false;
        expectMethod = false;
      } else if (
        t[0] === '"' || t[0] === "'" ||
        t.startsWith('f"') || t.startsWith("f'") ||
        t.startsWith('"""') || t.startsWith("'''")
      ) {
        out.push(span("hljs-string", t));
        expectName = false;
        expectMethod = false;
      } else if (/^\d/.test(t)) {
        out.push(span("hljs-number", t));
        expectName = false;
        expectMethod = false;
      } else if (t.startsWith("event.")) {
        out.push(span("hljs-meta", t));
        expectName = false;
        expectMethod = false;
      } else if (kw.has(t)) {
        out.push(span("hljs-keyword", t));
        expectName = t === "def" || t === "class";
        expectMethod = false;
      } else if (lit.has(t)) {
        out.push(span("hljs-keyword", t));
        expectName = false;
        expectMethod = false;
      } else if (builtin.has(t)) {
        out.push(span("hljs-built_in", t));
        expectName = false;
        expectMethod = true;
      } else if (/^[a-zA-Z_]/.test(t)) {
        const after = line.slice(p + t.length).trimStart().slice(0, 1);
        if (expectName) {
          out.push(span("hljs-title function_", t));
          expectName = false;
        } else if (expectMethod) {
          out.push(span("hljs-title function_", t));
          expectMethod = false;
        } else if (after === "(") {
          out.push(span("hljs-title function_", t));
        } else if (t[0] === t[0]?.toUpperCase() && t[0] !== t[0]?.toLowerCase()) {
          out.push(span("hljs-type", t));
        } else {
          out.push(span("hljs-variable", t));
        }
        expectMethod = false;
      } else {
        out.push(escapeHtml(t));
        if (t === ".") {
          // keep expectMethod for chained calls like network.add_socks
        } else if (/\S/.test(t) && t !== ".") {
          expectName = false;
          expectMethod = false;
        }
      }
    }
    return out.join("");
  }).join("\n");
}

export default function ScriptEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="code-editor-scroll code-editor-scroll--script">
      <Editor
        value={value}
        onValueChange={onChange}
        highlight={highlight}
        padding={12}
        className="code-editor font-mona-mono"
        textareaClassName="code-editor__input"
        preClassName="code-editor__pre"
        tabSize={4}
        style={{
          fontFamily: "'Mona Sans Mono', ui-monospace, monospace",
          fontSize: 13.5,
          lineHeight: 1.5,
          minHeight: "100%",
        }}
      />
    </div>
  );
}
