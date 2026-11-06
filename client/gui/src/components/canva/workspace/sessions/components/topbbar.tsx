import { X } from "lucide-react";

interface TopBarProps {
  search: string;
  onSearchChange: (v: string) => void;
}

const TopBar = ({ search, onSearchChange }: TopBarProps) => (
  <div
    style={{ borderColor: "#222323" }}
    className="shrink-0 min-w-0 overflow-x-auto border-b dv-bg-window"
  >
    <div className="box-border flex w-max min-w-full flex-nowrap items-center gap-2 p-2">
      <div className="relative min-w-[6rem] w-[14rem] max-w-full flex-1 shrink-0" data-sessions-search-input>
        <input
          data-sessions-search-field="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter sessions..."
          className="box-border h-[29px] w-full rounded border border-[#363636] bg-[#212121] py-0 px-3 text-[13.5px] text-[#cecece] outline-none transition-colors placeholder:text-[#444] focus:border-[#555]"
        />
      </div>
      {search && (
        <button
          type="button"
          onClick={() => onSearchChange("")}
          className="button-default border-none bg-transparent p-0 text-[#555] hover:text-[#cecece] cursor-pointer"
        >
          <X size={11} />
        </button>
      )}
    </div>
  </div>
);

export default TopBar;
