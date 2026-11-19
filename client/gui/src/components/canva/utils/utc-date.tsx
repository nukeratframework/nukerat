import { useTranslation } from "react-i18next";
import { translate } from "@/i18n";

/**
 * Table columns carry a stable `key` for sorting/selection and a `label` i18n
 * key for display. The old code appended " (UTC)" to the label and later
 * stripped it back off with `endsWith`, which cannot survive translation —
 * `utc: true` replaces that convention.
 */
export type TableColumn<Key extends string = string> = {
  key: Key;
  label: string;
  utc?: boolean;
};

export function utcColumn<Key extends string>(key: Key, label: string): TableColumn<Key> {
  return { key, label, utc: true };
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

/**
 * Renders a translated column label, followed by a dimmed localized " (UTC)"
 * suffix when `utc` is set. Labels come from table data, so resolution goes
 * through the loose `translate()` helper rather than the statically-keyed `t()`.
 */
export function TableColumnHeader({ column }: { column: TableColumn }) {
  // Subscribes this component to language changes; the lookup itself goes
  // through the loose helper because `column.label` is runtime data.
  useTranslation();
  const label = translate(column.label);
  if (!column.utc) return <>{label}</>;
  return (
    <>
      {label}
      <span className="text-[#555]">{translate("common.utcSuffix")}</span>
    </>
  );
}

// --- Legacy string-label helpers -------------------------------------------
// Still used by tables that have not been migrated to `TableColumn`. Both sides
// of the `utcTableColumnTitle`/`UtcTableColumnHeader` pair share this constant
// so the appended suffix and the `endsWith` check cannot drift apart.

export const UTC_TABLE_COLUMN_SUFFIX = " (UTC)";

/** @deprecated Build a `TableColumn` with `utc: true` instead. */
export function utcTableColumnTitle(base: string) {
  return `${base}${UTC_TABLE_COLUMN_SUFFIX}`;
}

/** @deprecated Use `TableColumnHeader` with `utc: true` instead. */
export function UtcTableColumnHeader({ label }: { label: string }) {
  if (!label.endsWith(UTC_TABLE_COLUMN_SUFFIX)) return <>{label}</>;
  return (
    <>
      {label.slice(0, -UTC_TABLE_COLUMN_SUFFIX.length)}
      <span className="text-[#555]">{UTC_TABLE_COLUMN_SUFFIX}</span>
    </>
  );
}
