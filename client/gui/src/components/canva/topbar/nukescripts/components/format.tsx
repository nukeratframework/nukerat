function opensBlock(line: string) {
  const t = line.trim();
  if (/^(def|class|if|elif|else|for|while|try|except|finally|with)\b/.test(t)) return true;
  return /:\s*(#.*)?$/.test(t);
}

function closesBlock(line: string) {
  return /^(elif|else|except|finally)\b/.test(line.trim());
}

function indentBlock(src: string): string {
  const out: string[] = [];
  let level = 0;
  for (const line of src.split("\n")) {
    const trim = line.trim();
    if (!trim) {
      out.push("");
      continue;
    }
    if (closesBlock(trim)) level = Math.max(0, level - 1);
    out.push(`${"    ".repeat(level)}${trim}`);
    if (opensBlock(trim)) level += 1;
  }
  return out.join("\n");
}

function splitTopLevel(source: string): { code: string[]; binds: string[] } {
  const code: string[] = [];
  const binds: string[] = [];
  const lines = source.split("\n");
  let buf: string[] = [];

  const flush = () => {
    const t = buf.join("\n").trim();
    if (t) code.push(t);
    buf = [];
  };

  for (const line of lines) {
    const trim = line.trim();
    const indent = line.length - line.trimStart().length;
    if (!trim) {
      if (buf.length) buf.push(line);
      continue;
    }
    if (indent === 0 && /^event\./.test(trim)) {
      flush();
      binds.push(trim);
      continue;
    }
    if (indent === 0 && /^def\b/.test(trim) && buf.length) flush();
    buf.push(line);
  }
  flush();
  return { code, binds };
}

export function formatNukeScript(raw: string): string {
  const src = raw.replace(/\r/g, "").trim();
  if (!src) return "";
  const { code, binds } = splitTopLevel(src);
  const parts = [...code.map(indentBlock), ...binds];
  if (!parts.length) return indentBlock(src) + "\n";
  return parts.join("\n\n").trim() + "\n";
}
