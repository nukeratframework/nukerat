import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { implantBaseLabels, implantBases, type ImplantBase } from "./logic";

export default ({
  implantBase,
  onImplantBaseChange,
}: {
  implantBase: ImplantBase;
  onImplantBaseChange: (base: ImplantBase) => void;
}) => (
  <div className="shrink-0 px-4 py-3 border-b border-[#252525] space-y-1.5">
    <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">
      IMPLANT BASE
    </label>
    <Select value={implantBase} onValueChange={(v) => onImplantBaseChange(v as ImplantBase)}>
      <SelectTrigger className="w-full bg-[#212121] border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 h-auto focus:border-[#555] focus-visible:ring-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {implantBases.map((base) => (
          <SelectItem key={base} value={base}>
            {implantBaseLabels[base]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);
