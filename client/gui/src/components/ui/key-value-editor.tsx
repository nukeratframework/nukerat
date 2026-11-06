"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/lib/utils";

type Row = { key: string; value: string };

export function KeyValueEditor({
  label,
  items,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  className,
}: {
  label: string;
  items: Row[];
  onChange: (items: Row[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] text-[#6e6e6e] uppercase tracking-widest">{label}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...items, { key: "", value: "" }])}
          className="h-[25px] w-[90px] gap-1.5 rounded border-[#333] bg-[#232323] p-0 text-[12px] text-[#cecece] hover:bg-[#2b2b2b] hover:text-[#cecece]"
        >
          <Plus size={11} />
          Add row
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#292929] bg-transparent">
        {items.length > 0 ? (
          <table className="w-full border-collapse">
            <colgroup>
              <col />
              <col className="w-[55%]" />
              <col className="w-0" />
            </colgroup>
            <thead>
              <tr className="text-[11px] text-[#5a5a5a] uppercase tracking-wider">
                <th
                  scope="col"
                  className="border-b border-r border-[#292929] px-3 py-1 text-left font-normal"
                >
                  {keyPlaceholder}
                </th>
                <th
                  scope="col"
                  className="border-b border-r border-[#292929] px-3 py-1 text-left font-normal"
                >
                  {valuePlaceholder}
                </th>
                <th
                  scope="col"
                  className="w-0 border-b border-[#292929] p-0 font-normal"
                >
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, index) => (
                <tr key={index}>
                  <td className="border-r border-t border-[#292929] px-1 py-0">
                    <Input
                      value={row.key}
                      onChange={(e) =>
                        onChange(
                          items.map((r, i) => (i === index ? { ...r, key: e.target.value } : r))
                        )
                      }
                      placeholder={keyPlaceholder}
                      autoComplete="off"
                      spellCheck={false}
                      className="!h-auto !min-h-0 !py-0 w-full rounded-none border-0 bg-transparent px-2 leading-none text-[13.5px] text-[#cecece] shadow-none placeholder:text-[#444] focus-visible:ring-0"
                    />
                  </td>
                  <td className="border-r border-t border-[#292929] px-1 py-0">
                    <Input
                      value={row.value}
                      onChange={(e) =>
                        onChange(
                          items.map((r, i) => (i === index ? { ...r, value: e.target.value } : r))
                        )
                      }
                      placeholder={valuePlaceholder}
                      autoComplete="off"
                      spellCheck={false}
                      className="!h-auto !min-h-0 !py-0 w-full rounded-none border-0 bg-transparent px-2 leading-none text-[13.5px] text-[#cecece] shadow-none placeholder:text-[#444] focus-visible:ring-0"
                    />
                  </td>
                  <td className="w-0 border-t border-[#292929] p-0 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove row ${index + 1}`}
                      onClick={() => onChange(items.filter((_, i) => i !== index))}
                      className="size-6 min-h-6 min-w-6 shrink-0 p-0 text-[#6b6b6b] hover:bg-transparent hover:text-[#6b6b6b]"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <span className="block px-3 py-6 text-center text-[13px] text-[#555]">Empty</span>
        )}
      </div>
    </div>
  );
}
