import React, { memo } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";

const tableRe = /(^|\n)(\|[^\n]+\|\n\|[-:\s|]+\|\n(?:\|[^\n]+\|\n?)+)/gm;
const codeRe = /```[\s\S]*?```|`[^`\n]+`/g;
const htmlTagRe = /<\/?[a-z][a-z0-9]*\b[^>]*\/?>/i;

const allowed_tags = new Set([
  "p", "br", "strong", "em", "b", "i", "u", "del", "s", "strike", "sub", "sup", "mark",
  "code", "pre", "blockquote", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
  "a", "img", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "hr", "div", "span",
  "details", "summary", "kbd", "abbr",
]);

const global_attrs = new Set(["class", "id", "title", "lang", "dir"]);
const tag_attrs: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height", "loading"]),
  th: new Set(["colspan", "rowspan", "scope"]),
  td: new Set(["colspan", "rowspan"]),
  col: new Set(["span"]),
};

type Footnotes = Map<string, string>;

const mdComponents: Components = {
  a: ({ href, children, ...props }) => {
    if (typeof href === "string" && !isSafeUrl(href)) return <span>{children}</span>;
    return (
      <a
        href={href}
        {...props}
        {...(typeof href === "string" && /^https?:\/\//i.test(href) ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      >
        {children}
      </a>
    );
  },
  img: ({ src, alt, ...props }) => {
    if (typeof src !== "string" || !isSafeUrl(src)) return null;
    return <img src={src} alt={alt ?? ""} loading="lazy" className="max-w-full h-auto" {...props} />;
  },
};

const inlineMdComponents: Components = { ...mdComponents, p: ({ children }) => <>{children}</> };

function isSafeUrl(url: string): boolean {
  const u = url.trim();
  if (!u || /^\s*javascript:/i.test(u) || /^\s*vbscript:/i.test(u)) return false;
  if (/^data:/i.test(u)) return /^data:image\//i.test(u);
  return /^(https?:|blob:|#|\/)/i.test(u) || !/^[a-z][a-z0-9+.-]*:/i.test(u);
}

function allowedAttr(tag: string, name: string): boolean {
  if (name.startsWith("on") || name === "style") return false;
  if (global_attrs.has(name)) return true;
  return tag_attrs[tag]?.has(name) ?? false;
}

function protectCode(text: string): { text: string; slots: string[] } {
  const slots: string[] = [];
  const out = text.replace(codeRe, (m) => {
    slots.push(m);
    return `\x00C${slots.length - 1}\x00`;
  });
  return { text: out, slots };
}

function restoreCode(text: string, slots: string[]): string {
  return text.replace(/\x00C(\d+)\x00/g, (_, i) => slots[Number(i)] ?? "");
}

function parseFootnotes(text: string): { body: string; defs: Footnotes } {
  const defs: Footnotes = new Map();
  const lines: string[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\[\^([^\]]+)\]:\s*(.*)$/);
    if (m) defs.set(m[1], m[2]);
    else lines.push(line);
  }
  return { body: lines.join("\n"), defs };
}

function applyStrike(text: string): string {
  return text.replace(/~~([^~\n]+?)~~/g, "<del>$1</del>");
}

function applyFootnoteRefs(text: string, defs: Footnotes): string {
  if (!defs.size) return text;
  return text.replace(/\[\^([^\]]+)\]/g, (full, id) => {
    if (!defs.has(id)) return full;
    const safe = id.replace(/[^\w-]/g, "");
    return `<sup class="md-fn-ref"><a href="#fn-${safe}">[${id}]</a></sup>`;
  });
}

function prepare(text: string, defs: Footnotes): string {
  const { text: t, slots } = protectCode(text);
  let out = applyStrike(t);
  out = applyFootnoteRefs(out, defs);
  return restoreCode(out, slots);
}

function toReactAttrs(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) out[k === "class" ? "className" : k] = v;
  return out;
}

function elementAttrs(el: Element): Record<string, string> {
  const tag = el.tagName.toLowerCase();
  const out: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (!allowedAttr(tag, name)) continue;
    const val = attr.value;
    if ((name === "href" || name === "src") && !isSafeUrl(val)) continue;
    out[name] = val;
  }
  if (tag === "a" && out.href && /^https?:\/\//i.test(out.href)) {
    out.target = "_blank";
    out.rel = "noreferrer noopener";
  }
  if (tag === "img") out.loading = "lazy";
  return out;
}

function nodeToReact(node: Node, key: string, defs: Footnotes, inline?: boolean): React.ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = node.textContent ?? "";
    if (!t.trim()) return t || null;
    if (/[*_`#[\]]/.test(t)) {
      return (
        <ReactMarkdown key={key} components={inline ? inlineMdComponents : mdComponents}>
          {t}
        </ReactMarkdown>
      );
    }
    return t;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const children = Array.from(el.childNodes)
    .map((c, i) => nodeToReact(c, `${key}-${i}`, defs, inline))
    .filter((c) => c != null);

  if (!allowed_tags.has(tag)) return children.length ? <React.Fragment key={key}>{children}</React.Fragment> : null;

  const props = toReactAttrs(elementAttrs(el));
  if (tag === "img") {
    return React.createElement(
      tag,
      { key, ...props, className: props.className ? `${props.className} max-w-full h-auto` : "max-w-full h-auto" },
      ...children
    );
  }
  return React.createElement(tag, { key, ...props }, ...children);
}

function hasHtml(text: string): boolean {
  return htmlTagRe.test(text);
}

function htmlToReact(html: string, key: string, defs: Footnotes, inline?: boolean): React.ReactNode {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const nodes = Array.from(doc.body.childNodes)
    .map((n, i) => nodeToReact(n, `${key}-${i}`, defs, inline))
    .filter((n) => n != null);
  if (!nodes.length) return null;
  return inline ? <span key={key}>{nodes}</span> : <div key={key}>{nodes}</div>;
}

function splitBlocks(text: string): string[] {
  const blocks: string[] = [];
  let buf = "";
  const lines = text.split("\n");
  for (const line of lines) {
    if (line.trim() === "" && buf) {
      blocks.push(buf);
      buf = "";
    } else if (line.trim() === "" && !buf) {
      continue;
    } else {
      buf += (buf ? "\n" : "") + line;
    }
  }
  if (buf) blocks.push(buf);
  return blocks.length ? blocks : [text];
}

function MdBlock({ text, defs, inline }: { text: string; defs: Footnotes; inline?: boolean }) {
  const prepared = prepare(text, defs);
  const blocks = inline ? [prepared] : splitBlocks(prepared);

  return (
    <>
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (hasHtml(trimmed)) return htmlToReact(trimmed, `b-${i}`, defs, inline);
        return (
          <ReactMarkdown key={`m-${i}`} components={inline ? inlineMdComponents : mdComponents}>
            {trimmed}
          </ReactMarkdown>
        );
      })}
    </>
  );
}

function MdCell({ text, defs }: { text: string; defs: Footnotes }) {
  return <MdBlock text={text} defs={defs} inline />;
}

function FootnotesList({ defs }: { defs: Footnotes }) {
  if (!defs.size) return null;
  return (
    <section className="md-footnotes mt-4 pt-3 border-t border-[#222323] text-[13px] text-[#9a9a9a]">
      {Array.from(defs).map(([id, content]) => (
        <p key={id} id={`fn-${id.replace(/[^\w-]/g, "")}`} className="mb-1.5">
          <sup className="mr-1.5 text-[#6e6e6e]">[{id}]</sup>
          <MdBlock text={content} defs={defs} inline />
        </p>
      ))}
    </section>
  );
}

export const MdFormat = memo(function MdFormat({ text }: { text: string }) {
  const { body, defs } = parseFootnotes(text);
  const parts: React.ReactNode[] = [];
  let last = 0;
  let n = 0;

  for (const m of body.matchAll(tableRe)) {
    const start = m.index! + m[1].length;
    if (start > last) parts.push(<MdBlock key={n++} text={body.slice(last, start)} defs={defs} />);

    const rows = m[2]
      .trim()
      .split("\n")
      .filter((_, i) => i !== 1)
      .map((l) => l.trim().slice(1, -1).split("|").map((c) => c.trim()));
    const [head, ...tblBody] = rows;
    parts.push(
      <table key={n++}>
        <thead>
          <tr>
            {head.map((c, i) => (
              <th key={i}>
                <MdCell text={c} defs={defs} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tblBody.map((row, ri) => (
            <tr key={ri}>
              {row.map((c, ci) => (
                <td key={ci}>
                  <MdCell text={c} defs={defs} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
    last = start + m[2].length;
  }

  if (last < body.length) parts.push(<MdBlock key={n++} text={body.slice(last)} defs={defs} />);
  if (!parts.length) parts.push(<MdBlock key={0} text={body} defs={defs} />);

  return (
    <div
      className="docs-md-content p-0 max-w-full min-w-0 overflow-x-hidden text-[13.5px] text-[#9b9b9b] break-words [overflow-wrap:anywhere] [overflow-anchor:none]"
      style={{ padding: "10px 0px 0px 0px !important" }}
    >
      {parts}
      <FootnotesList defs={defs} />
    </div>
  );
});
