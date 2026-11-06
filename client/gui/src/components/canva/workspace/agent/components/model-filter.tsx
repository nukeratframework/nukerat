import { CheckIcon, ChevronsUpDownIcon, RefreshCw, RotateCw, X } from "lucide-react";
import type { ServerEntry } from "@/api/system/config";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInputNoIcon,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type AgentOption = { id: string; name: string; label?: React.ReactNode; server?: string };

const formatServerHeading = (label: string) =>
  label.length > 27 ? `${label.slice(0, 27)}...` : label;

const monaMono = "font-mona-mono";

export default function AgentModelFilter({
  servers,
  getAgentsForServer,
  serverLabel,
  loading,
  model,
  open,
  onOpen,
  onRefresh,
  onSelect,
  onSelectItem,
  onClear,
  disabled = false,
  placeholder = "Select a model",
  selectedId,
  displayLabel,
  searchPlaceholder = "Search model...",
  emptyLabel = "No model found.",
  clearAriaLabel = "Clear model",
  triggerClassName,
  mono = false,
}: {
  servers: ServerEntry[];
  getAgentsForServer: (s: ServerEntry) => AgentOption[];
  serverLabel: (s: ServerEntry) => string;
  loading: boolean;
  model: string;
  open: boolean;
  onOpen: (open: boolean) => void;
  onRefresh: () => void;
  onSelect?: (name: string) => void;
  onSelectItem?: (option: AgentOption, server: ServerEntry) => void;
  onClear: () => void;
  disabled?: boolean;
  placeholder?: string;
  selectedId?: string;
  displayLabel?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  clearAriaLabel?: string;
  triggerClassName?: string;
  mono?: boolean;
}) {
  const monoClass = mono ? monaMono : "";
  const resolvedLabel = (displayLabel || model).trim();
  const hasSelection = Boolean(resolvedLabel);
  const buttonLabel = hasSelection ? resolvedLabel : placeholder;
  const triggerClass =
    triggerClassName ??
    `button-default h-[29px] w-[12.5rem] shrink-0 justify-between gap-1 rounded border border-[#363636] bg-[#212121] py-0 text-[13.5px] font-normal text-[#cecece] outline-none hover:bg-[#212121] focus:border-[#555] focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 ${hasSelection ? "pl-2.5 pr-7" : "px-2.5"}`;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (disabled) return;
        onOpen(next);
      }}
    >
      <div className="relative shrink-0">
        <PopoverTrigger asChild style={{ borderRadius: "5px" }}>
          <Button
            size="sm"
            variant="outline"
            role="combobox"
            disabled={disabled}
            aria-expanded={open}
            className={triggerClass}
          >
            <span
              className={`truncate text-[13.5px] ${mono && hasSelection ? monaMono : ""} ${hasSelection ? "text-[#cecece]" : "text-[#888888]"}`}
            >
              {buttonLabel}
            </span>
            <ChevronsUpDownIcon className="text-[#666] shrink-0" size={14} />
          </Button>
        </PopoverTrigger>
        {hasSelection && (
          <button
            type="button"
            aria-label={clearAriaLabel}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="button-default absolute right-6 top-1/2 z-10 -translate-y-1/2 border-none bg-transparent p-0 text-[#555] hover:text-[#cecece] cursor-pointer"
          >
            <X size={12} />
          </button>
        )}
      </div>
      <PopoverContent
        className="border-[#363636] bg-[#212121] h-48 min-h-48 max-h-48 min-w-[var(--radix-popper-anchor-width)] p-0"
        align="start"
      >
        <Command>
          <div className="mt-1 flex w-full min-w-0 items-center gap-1 px-1 bg-[#161616] pb-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={loading}
              onClick={onRefresh}
              className="button-default text-[#9b9b9b] hover:bg-[#161616] bg-[#161616] border-[#202020] h-6 w-6 shrink-0 rounded-lg shadow-none"
            >
              <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <div className="min-w-0 flex-1">
              <CommandInputNoIcon
                wrapperClassName="w-full min-w-0"
                className="w-full placeholder:text-[#ffffff0b]"
                placeholder={searchPlaceholder}
              />
            </div>
          </div>
          <CommandList className={monoClass}>
            {loading ? (
              <div
                className={`flex items-center justify-center h-10 text-[#666] text-[13.5px] ${monoClass}`}
              >
                <RefreshCw size={14} className="animate-spin mr-2" />
                Loading...
              </div>
            ) : (
              <>
                <CommandEmpty className={monoClass}>{emptyLabel}</CommandEmpty>
                {servers.map((s) => {
                  const items = getAgentsForServer(s);
                  if (!items.length) return null;
                  const heading = serverLabel(s);
                  return (
                    <CommandGroup
                      key={s.id}
                      heading={
                        <span
                          title={heading}
                          className={`block max-w-[27ch] truncate whitespace-nowrap ${monoClass}`}
                        >
                          {formatServerHeading(heading)}
                        </span>
                      }
                      className={
                        mono
                          ? `${monoClass} **:[[cmdk-group-heading]]:font-mona-mono **:[[cmdk-group-heading]]:max-w-full **:[[cmdk-group-heading]]:min-w-0 **:[[cmdk-group-heading]]:whitespace-nowrap`
                          : "**:[[cmdk-group-heading]]:max-w-full **:[[cmdk-group-heading]]:min-w-0 **:[[cmdk-group-heading]]:whitespace-nowrap"
                      }
                    >
                      {items.map((a) => (
                        <CommandItem
                          key={a.id}
                          className={`cursor-pointer ${monoClass}`}
                          value={`${a.id}-${a.name}`}
                          onSelect={() => {
                            if (onSelectItem) onSelectItem(a, s);
                            else onSelect?.(a.name);
                          }}
                        >
                          {a.label ?? a.name}
                          {(selectedId ? selectedId === a.id : model === a.name) && (
                            <CheckIcon size={16} className="ml-auto" style={{ stroke: "#858585" }} />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
