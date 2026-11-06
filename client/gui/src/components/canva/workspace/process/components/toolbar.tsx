import { useId, useState } from "react";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PROCESS_FILTERS, type ProcessFilter } from "./logic";

interface ToolbarProps {
  search: string;
  loading: boolean;
  disabled: boolean;
  onSearchChange: (v: string) => void;
  onRefresh: () => void;
  filter: ProcessFilter;
  onFilterChange: (v: ProcessFilter) => void;
  treeMode: boolean;
  onTreeModeChange: (value: boolean) => void;
}

const Toolbar = ({
  search,
  loading,
  disabled,
  onSearchChange,
  onRefresh,
  filter,
  onFilterChange,
  treeMode,
  onTreeModeChange,
}: ToolbarProps) => {
  const id = useId();
  const [filterOpen, setFilterOpen] = useState(false);
  const controlsDisabled = loading || disabled;
  const refreshClassName = loading ? "animate-spin" : "";
  const selectedFilter =
    PROCESS_FILTERS.find((item) => item.value === filter) ?? PROCESS_FILTERS[0];

  return (
    <div
      style={{ borderColor: "#222323" }}
      className="shrink-0 min-w-0 overflow-x-auto border-b dv-bg-window"
    >
      <div className="box-border flex w-max min-w-full flex-nowrap items-center gap-2 p-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={controlsDisabled}
          className="button-default h-[29px] shrink-0 rounded-[5px] border border-[#ffffff26] px-2 text-[13.5px] text-[#cecece] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={14} className={refreshClassName} />
        </button>

        <div className="relative w-[14rem] min-w-[6rem] shrink-0" data-process-search-input>
          <input
            data-process-search-field="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter processes..."
            className="h-[29px] w-full rounded border border-[#363636] bg-[#212121] px-3 py-0 text-[13.5px] text-[#cecece] outline-none transition-colors placeholder:text-[#444] focus:border-[#555]"
          />
        </div>
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="button-default text-[#555] hover:text-[#cecece] cursor-pointer bg-transparent border-none p-0"
          >
            <X size={11} />
          </button>
        )}

        <div id="process-filter-select" className="shrink-0">
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                id={id}
                size="sm"
                variant="outline"
                role="combobox"
                aria-expanded={filterOpen}
                disabled={controlsDisabled}
                className="button-default h-[30px] w-[140px] min-w-0 justify-between gap-1 border-input bg-background px-0 py-0 font-normal outline-none outline-offset-0 hover:bg-background focus-visible:outline-[3px]"
              >
                <span className="min-w-0 truncate text-[13.5px] text-[#cecece]">
                  {selectedFilter.label}
                </span>
                <ChevronsUpDownIcon
                  className="text-muted-foreground/80 shrink-0"
                  aria-hidden="true"
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="border-input min-h-fit w-full min-w-[var(--radix-popper-anchor-width)] p-0"
              align="start"
            >
              <Command>
                <CommandList>
                  <CommandGroup>
                    {PROCESS_FILTERS.map((item) => (
                      <CommandItem
                        className="cursor-pointer"
                        key={item.value}
                        value={`${item.value}-${item.label}`}
                        onSelect={() => {
                          onFilterChange(item.value);
                          setFilterOpen(false);
                        }}
                      >
                        {item.label}
                        {filter === item.value && (
                          <CheckIcon
                            size={16}
                            className="ml-auto"
                            style={{ stroke: "#858585" }}
                          />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <button
          type="button"
          onClick={() => onTreeModeChange(true)}
          className={`button-default h-[29px] shrink-0 rounded-[5px] border px-2 text-[13.5px] cursor-pointer ${treeMode ? "border-[#ffffff26] text-[#cecece]" : "border-transparent text-[#555]"}`}
        >
          Tree
        </button>
        <button
          type="button"
          onClick={() => onTreeModeChange(false)}
          className={`button-default h-[29px] shrink-0 rounded-[5px] border px-2 text-[13.5px] cursor-pointer ${!treeMode ? "border-[#ffffff26] text-[#cecece]" : "border-transparent text-[#555]"}`}
        >
          Flat
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
