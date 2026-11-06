import type { ReactNode } from "react";

export const UTC_TABLE_COLUMN_SUFFIX = " (UTC)";

export function utcTableColumnTitle(base: string) {
  return `${base}${UTC_TABLE_COLUMN_SUFFIX}`;
}

const DISPLAY_DATETIME_RE = /^(\d{4})\/(\d{2})\/(\d{2}) - (\d{2}):(\d{2})$/;

export function formatUtcDateOnly(raw?: string | null): string {
  if (!raw?.trim()) return "-";
  const s = raw.trim();
  if (DISPLAY_DATETIME_RE.test(s)) return s;
  const m = s.replace(/\s*UTC\s*$/i, "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const iso = /[zZ]|[+-]\d{2}:\d{2}$/.test(s) ? s : `${s}Z`;
  const d = new Date(iso);
  if (!isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${mo}-${dd}`;
  }
  return s;
}

export function UtcTableColumnHeader({ label }: { label: string }) {
  if (!label.endsWith(UTC_TABLE_COLUMN_SUFFIX)) return label;
  const base = label.slice(0, -UTC_TABLE_COLUMN_SUFFIX.length);
  return (
    <>
      {base}
      <span className="text-[#555]">{UTC_TABLE_COLUMN_SUFFIX}</span>
    </>
  );
}

export function renderUtcTableColumnHeader(col: string): ReactNode {
  return <UtcTableColumnHeader label={col} />;
}
