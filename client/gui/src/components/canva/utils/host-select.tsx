import { Fragment } from "react";
import { CheckIcon, ChevronsUpDownIcon, RefreshCw, RotateCw } from "lucide-react";
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
import FetchToast from "@/components/canva/utils/toast_rules";
import { useHostSelect, type HostSelectBoxProps } from "./host-select-logic";

const mono = "font-mona-mono";
const serverHeadingClass = `block max-w-[27ch] truncate ${mono}`;

const formatServerHeading = (label: string) =>
  label.length > 27 ? `${label.slice(0, 27)}...` : label;

const HostSelectBox = ({ onSelect, hide, panelSelectedHost }: HostSelectBoxProps) => {
  const {
    id,
    open,
    setOpen,
    value,
    loading,
    response,
    groups,
    selectedHost,
    loadHosts,
    selectHost,
  } = useHostSelect(onSelect, panelSelectedHost);

  return (
    <div
      style={hide ? { display: "none" } : { marginLeft: "8px" }}
      id="host-select"
      className={`w-full max-w-xs space-y-2 ${mono}`}
    >
      <FetchToast response={response} />
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) loadHosts();
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={`button-default bg-background hover:bg-background justify-between px-3 min-w-0 text-[12px] border-[#292929] hover:!border-[#292929] focus:!border-[#292929] focus-visible:!border-[#292929] aria-expanded:!border-[#292929] outline-none focus-visible:ring-0 focus-visible:outline-none ${mono}`}
          >
            {selectedHost ? (
              <span className={`flex min-w-0 items-center gap-2 text-[12px] ${mono}`}>
                <span className={`truncate overflow-hidden text-[12px] ${mono}`}>
                  {selectedHost.tag || selectedHost.ip}
                </span>
              </span>
            ) : (
              <span className={`text-muted-foreground text-[12px] ${mono}`}>Host</span>
            )}
            <ChevronsUpDownIcon
              className="text-muted-foreground/80 shrink-0"
              aria-hidden="true"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          id="host-select-popover"
          className={`border-input h-48 min-h-48 max-h-48 w-full min-w-[var(--radix-popper-anchor-width)] p-0 ${mono}`}
          align="start"
        >
          <Command className={mono}>
            <div className="mt-1 flex items-center gap-1 px-1 bg-[#161616] pb-1.5">
              <Button
                style={{ borderRadius: "6px" }}
                type="button"
                variant="outline"
                size="icon"
                disabled={loading}
                onClick={loadHosts}
                className="button-default hover:text-[#9b9b9b] text-[#9b9b9b] hover:bg-[#161616] bg-[#161616] border-[#262626] hover:!border-[#262626] focus:!border-[#262626] focus-visible:!border-[#262626] focus-visible:ring-0 focus-visible:outline-none text-muted-foreground h-6 w-6 shrink-0 rounded-lg shadow-none"
              >
                <RotateCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
              <CommandInputNoIcon
                className={`w-[9.7rem] placeholder:text-[#ffffff0b] ${mono}`}
                placeholder="Search host..."
              />
            </div>
            <CommandList>
              {loading && (
                <div className={`flex items-center justify-center h-10 text-muted-foreground text-[13.5px] ${mono}`}>
                  <RefreshCw size={14} className="animate-spin mr-2" />
                  Loading...
                </div>
              )}
              {!loading && <CommandEmpty className={mono}>No host found.</CommandEmpty>}
              {Object.entries(groups).map(([server, serverHosts]) => (
                <Fragment key={server}>
                  <CommandGroup
                    heading={
                      <span title={server} className={serverHeadingClass}>
                        {formatServerHeading(server)}
                      </span>
                    }
                    className={`${mono} **:[[cmdk-group-heading]]:font-mona-mono **:[[cmdk-group-heading]]:max-w-full **:[[cmdk-group-heading]]:min-w-0`}
                  >
                    {serverHosts.map((host) => (
                      <CommandItem
                        className={`cursor-pointer ${mono}`}
                        key={host.id}
                        value={`${host.id}-${host.tag || host.ip}`}
                        onSelect={() => selectHost(host, server)}
                      >
                        {host.tag || host.ip}
                        {value === String(host.id) && (
                          <CheckIcon
                            size={16}
                            className="ml-auto"
                            style={{ stroke: "#858585" }}
                          />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Fragment>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default HostSelectBox;
