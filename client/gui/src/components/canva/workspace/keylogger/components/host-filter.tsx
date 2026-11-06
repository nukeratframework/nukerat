import { CheckIcon, ChevronsUpDownIcon, RefreshCw, RotateCw, X } from "lucide-react";
import type { Session } from "@/api/sessions";
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

export default function KeyloggerHostFilter({
  groups,
  loading,
  hostId,
  selected,
  open,
  onOpen,
  onRefresh,
  onSelect,
  onClear,
}: {
  groups: Record<string, Session[]>;
  loading: boolean;
  hostId: string;
  selected?: Session;
  open: boolean;
  onOpen: (open: boolean) => void;
  onRefresh: () => void;
  onSelect: (host: Session) => void;
  onClear: () => void;
}) {
  const filtered = Boolean(hostId);

  return (
    <Popover open={open} onOpenChange={onOpen}>
      <div className="relative shrink-0">
        <PopoverTrigger asChild style={{ borderRadius: "5px" }}>
          <Button
            size="sm"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={`button-default h-[29px] min-w-[9rem] max-w-[12rem] shrink-0 justify-between gap-1 border-[#363636] bg-[#212121] py-0 text-[13.5px] font-normal text-[#cecece] outline-none hover:bg-[#212121] focus-visible:ring-0 ${filtered ? "pl-2.5 pr-7" : "px-2.5"}`}
          >
            <span className="truncate">{selected?.tag || selected?.ip || "Host"}</span>
            <ChevronsUpDownIcon className="text-[#666] shrink-0" size={14} />
          </Button>
        </PopoverTrigger>
        {filtered && (
          <button
            type="button"
            aria-label="Clear host filter"
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
          <div className="mt-1 flex items-center gap-1 px-1 bg-[#161616] pb-1.5">
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
            <CommandInputNoIcon className="w-[9.7rem] placeholder:text-[#ffffff0b]" placeholder="Search host..." />
          </div>
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center h-10 text-[#666] text-[13.5px]">
                <RefreshCw size={14} className="animate-spin mr-2" />
                Loading...
              </div>
            ) : (
              <>
                <CommandGroup>
                  <CommandItem
                    className="cursor-pointer whitespace-nowrap text-[#9b9b9b]"
                    value="all-hosts"
                    onSelect={() => onClear()}
                  >
                    All hosts
                    {!filtered && (
                      <CheckIcon size={16} className="ml-auto" style={{ stroke: "#858585" }} />
                    )}
                  </CommandItem>
                </CommandGroup>
                <CommandEmpty>No host found.</CommandEmpty>
                {Object.entries(groups).map(([server, list]) => (
                  <CommandGroup key={server} heading={server}>
                    {list.map((host) => (
                      <CommandItem
                        key={`${server}-${host.id}`}
                        className="cursor-pointer"
                        value={`${host.id}-${host.tag || host.ip}`}
                        onSelect={() => onSelect(host)}
                      >
                        {host.tag || host.ip}
                        {hostId === String(host.id) && (
                          <CheckIcon size={16} className="ml-auto" style={{ stroke: "#858585" }} />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
