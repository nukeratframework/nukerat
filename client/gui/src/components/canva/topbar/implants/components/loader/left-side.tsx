import { navSections, sectionLabels, type Format, type Os, type Section } from "./logic";

export default ({
  section,
  format,
  os,
  onSelect,
}: {
  section: Section;
  format: Format;
  os: Os;
  onSelect: (s: Section) => void;
}) => (
  <div className="flex-1 min-h-0 overflow-y-auto py-3">
    {navSections(format, os).map((s) => (
      <button
        key={s}
        type="button"
        onClick={() => onSelect(s)}
        className={`button-default w-full text-left px-4 py-2 text-[13.5px] transition-colors cursor-pointer ${
          section === s
            ? "bg-[#2a2a2a] text-[#d4d4d4] border-r-2 border-[#888]"
            : "text-[#666] hover:text-[#aaa] hover:bg-[#1c1c1c]"
        }`}
      >
        {sectionLabels[s]}
      </button>
    ))}
  </div>
);
