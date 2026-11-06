import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { PanelEmptyState } from "@/components/canva/utils/panel-empty-state";
import type { ProcessNode } from "@/api/process";
import { ProcessIcon } from "./icons";
import {
  TABLE_HEADERS,
  useProcessTable,
  privilegeClass,
  type SortDir,
  type SortKey,
} from "./logic";

const HeaderCell = ({
  label, sortKey, width, currentSort, dir, onSort, onResizeStart,
}: {
  label: string; sortKey: string; width?: number;
  currentSort: SortKey | null; dir: SortDir;
  onSort: (k: SortKey) => void;
  onResizeStart: (e: React.MouseEvent, key: string) => void;
}) => (
  <th
    style={width != null ? { width, minWidth: width } : undefined}
    aria-sort={currentSort === sortKey ? (dir === "asc" ? "ascending" : "descending") : "none"}
    onClick={() => onSort(sortKey as SortKey)}
    className={`relative text-center px-3 py-2 text-[12px] font-medium uppercase tracking-widest whitespace-nowrap cursor-pointer select-none transition-colors hover:text-[#b0b0b0] ${currentSort === sortKey ? "text-[#b8b8b8]" : "text-[#888888]"}`}
  >
    <span className="inline-flex items-center justify-center gap-0.5">
      {label}
      {currentSort === sortKey ? (
        dir === "asc" ? (
          <ChevronUp size={13} strokeWidth={2.25} className="shrink-0 opacity-80" />
        ) : (
          <ChevronDown size={13} strokeWidth={2.25} className="shrink-0 opacity-80" />
        )
      ) : null}
    </span>
    <div
      onMouseDown={(e) => {
        e.stopPropagation();
        onResizeStart(e, sortKey);
      }}
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize hover:bg-[#444] z-10"
    />
  </th>
);

const Cell = ({
  width, children, className = "", title,
}: {
  width?: number; children: React.ReactNode; className?: string; title?: string;
}) => (
  <td
    style={width != null ? { width, minWidth: width } : undefined}
    title={title}
    className={`px-3 py-2 text-[13.5px] whitespace-nowrap text-center ${className}`}
  >
    {children}
  </td>
);

const ProcessRow = ({
  node, depth, selected, expandedPids, onSelect, onToggle, widths, treeMode,
}: {
  node: ProcessNode; depth: number; selected: number | null;
  expandedPids: Set<number>;
  onSelect: (pid: number) => void;
  onToggle: (pid: number) => void;
  widths: Record<string, number | undefined>;
  treeMode: boolean;
}) => {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isOpen = !treeMode || expandedPids.has(node.pid);
  const isSelected = selected === node.pid;

  return (
    <>
      <tr
        onClick={() => onSelect(node.pid)}
        className={`border-b border-[#222] cursor-pointer transition-colors ${
          isSelected ? "bg-[#282828]" : "hover:bg-[#232323]"
        }`}
      >
        <td
          style={widths.name != null ? { width: widths.name, minWidth: widths.name } : undefined}
          className="px-3 py-2 text-[13.5px] text-[#d4d4d4] whitespace-nowrap"
          title={node.path || node.name}
        >
          <div
            style={{ paddingLeft: (treeMode ? depth * 14 : 0) + 6 }}
            className="flex min-w-0 items-center gap-[3px] overflow-hidden"
          >
            <span
              className="w-3 h-3 shrink-0 select-none flex items-center justify-center text-[#a4a4a4] mr-1"
              onClick={(e) => { e.stopPropagation(); if (treeMode && hasChildren) onToggle(node.pid); }}
            >
              {treeMode && hasChildren ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
            </span>
            <ProcessIcon name={node.name} size={17} className="shrink-0 text-[#cccccc]" />
            <span
              className="process-cell-truncate process-cell-name ml-1 min-w-0 flex-1 text-left text-[#d4d4d4]"
              title={node.name}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {node.name}
            </span>
          </div>
        </td>
        <Cell width={widths.pid} className="text-[#9b9b9b]">{node.pid}</Cell>
        <Cell width={widths.cpu} className="text-[#d4d4d4]">{node.cpu.toFixed(1)}%</Cell>
        <Cell width={widths.memory} className="text-[#d4d4d4]">{node.memory.toFixed(1)} MB</Cell>
        <Cell width={widths.user} className="text-[#d4d4d4]">{node.user || "-"}</Cell>
        <Cell width={widths.privilege} className={privilegeClass(node.privilege)}>
          {node.privilege || "-"}
        </Cell>
        <Cell width={widths.integrity} className="text-[#d4d4d4]">{node.integrity || "-"}</Cell>
        <Cell width={widths.session} className="text-[#9b9b9b]">{node.session ?? "-"}</Cell>
        <Cell width={widths.arch} className="text-[#d4d4d4]">{node.arch || "-"}</Cell>
        <Cell width={widths.network} className="text-[#d4d4d4]">
          <span className="process-cell-truncate mx-auto" title={node.network || undefined}>
            {node.network || "-"}
          </span>
        </Cell>
      </tr>
      {isOpen && hasChildren && node.children!.map((child) => (
        <ProcessRow
          key={child.pid}
          node={child}
          depth={depth + 1}
          selected={selected}
          expandedPids={expandedPids}
          onSelect={onSelect}
          onToggle={onToggle}
          widths={widths}
          treeMode={treeMode}
        />
      ))}
    </>
  );
};

const ProcessTable = ({
  table, treeMode, selected, onSelect, sort, sortDir, onSort,
}: {
  table: ReturnType<typeof useProcessTable>;
  treeMode: boolean;
  selected: number | null;
  onSelect: (pid: number) => void;
  sort: SortKey | null;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) => {
  const { expandedPids, colWidths, toggle, handleResizeStart, visibleNodes } = table;

  return (
    <div className="flex flex-1 min-h-0 relative overflow-hidden">
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex-1 overflow-auto flex flex-col min-h-0">
          <table className="w-full border-collapse shrink-0">
            <colgroup>
              {TABLE_HEADERS.map((h) => {
                const w = colWidths[h.key];
                return w != null ? <col key={h.key} style={{ width: w }} /> : <col key={h.key} />;
              })}
            </colgroup>
            <thead>
              <tr className="bg-[#171717] border-b border-[#252525]">
                {TABLE_HEADERS.map((h) => (
                  <HeaderCell
                    key={h.key}
                    label={h.label}
                    sortKey={h.key}
                    width={colWidths[h.key]}
                    currentSort={sort}
                    dir={sortDir}
                    onSort={onSort}
                    onResizeStart={handleResizeStart}
                  />
                ))}
              </tr>
            </thead>
            {visibleNodes.length > 0 && (
              <tbody>
                {visibleNodes.map((node) => (
                  <ProcessRow
                    key={node.pid}
                    node={node}
                    depth={0}
                    selected={selected}
                    expandedPids={expandedPids}
                    onSelect={onSelect}
                    onToggle={toggle}
                    widths={colWidths}
                    treeMode={treeMode}
                  />
                ))}
              </tbody>
            )}
          </table>
          {visibleNodes.length === 0 && <PanelEmptyState>No processes</PanelEmptyState>}
        </div>
      </div>
    </div>
  );
};

export default ProcessTable;
