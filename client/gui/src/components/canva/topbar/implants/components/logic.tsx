import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { buildImplantRequest } from "@/api/implants";
import { formatPickerDate } from "@/components/canva/workspace/keylogger/components/logic";
import { formatToastMessage } from "@/components/canva/utils/toast_rules";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  buildImplantConfig as buildLoaderConfig,
  outputDownloadName as loaderOutputDownloadName,
  requiredFields as loaderRequiredFields,
  useLoaderPanel,
} from "./loader/logic";
import {
  buildImplantConfig as buildStagelessConfig,
  outputDownloadName as stagelessOutputDownloadName,
  requiredFields as stagelessRequiredFields,
  useStagelessPanel,
} from "./stageless/logic";

export const implantBases = ["stageless", "loader"] as const;
export type ImplantBase = (typeof implantBases)[number];

export const implantBaseLabels: Record<ImplantBase, string> = {
  stageless: "Stageless",
  loader: "Loader",
};

function buildErrorText(res: any) {
  const log = [res.stderr, res.stdout].map((s) => s?.trim()).filter(Boolean).join("\n\n");
  return log || formatToastMessage(res.message ?? res.error ?? "Request failed");
}

export function PeTimestampField({
  value,
  onChange,
}: {
  value: string;
  onChange: (iso: string) => void;
}) {
  const [display, setDisplay] = useState(() => {
    const raw = value.trim();
    if (!raw) return "";
    const [y, m, d] = raw.split("-").map((x) => Number.parseInt(x, 10));
    if (!y || !m || !d) return "";
    return formatPickerDate(new Date(y, m - 1, d));
  });

  const tsDate = (() => {
    const raw = value.trim();
    if (!raw) return undefined;
    const [y, m, d] = raw.split("-").map((x) => Number.parseInt(x, 10));
    if (!y || !m || !d) return undefined;
    return new Date(y, m - 1, d);
  })();

  useEffect(() => {
    const raw = value.trim();
    if (!raw) {
      setDisplay("");
      return;
    }
    const [y, m, d] = raw.split("-").map((x) => Number.parseInt(x, 10));
    if (y && m && d) setDisplay(formatPickerDate(new Date(y, m - 1, d)));
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
    let next = digits;
    if (digits.length > 2) next = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    if (digits.length > 4) next = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    setDisplay(next);
    if (!digits.length) {
      if (value) onChange("");
      return;
    }
    if (digits.length < 6) {
      if (value) onChange("");
      return;
    }
    const mm = digits.slice(0, 2);
    const dd = digits.slice(2, 4);
    const yy = digits.slice(4, 6);
    const iso = `${2000 + Number.parseInt(yy, 10)}-${mm}-${dd}`;
    if (iso !== value) onChange(iso);
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        className="w-[7.5rem] tabular-nums bg-[#212121] border border-[#363636] text-[#cecece] text-[13px] rounded px-3 py-1.5 h-[28px] outline-none focus:border-[#555] placeholder:text-[#444]"
        value={display}
        onChange={handleInputChange}
        placeholder="MM/DD/YY"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        maxLength={8}
        aria-label="TimeDateStamp"
      />
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="h-[28px] min-w-[28px] button-default bg-[#212121] border border-[#363636] text-[#cecece] rounded px-1.5 flex items-center justify-center cursor-pointer"
            aria-label="Open calendar"
          >
            <CalendarDays className="size-3.5 shrink-0 text-[#888]" />
            <ChevronDown className="size-3 shrink-0 text-[#666] ml-0.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="text-[#d4d4d4] w-auto p-0 border-[#363636] bg-[#212121]" align="start">
          <Card size="sm" className="mx-auto w-fit border-[#363636] bg-[#212121]">
            <CardContent>
              <Calendar
                mode="single"
                selected={tsDate}
                onSelect={(d) => {
                  if (!d) {
                    onChange("");
                    return;
                  }
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, "0");
                  const day = String(d.getDate()).padStart(2, "0");
                  onChange(`${y}-${m}-${day}`);
                }}
                className="p-0"
              />
            </CardContent>
          </Card>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function useImplantsPanel() {
  const [implantBase, setImplantBase] = useState<ImplantBase>("stageless");
  const [submitting, setSubmitting] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const stageless = useStagelessPanel();
  const loader = useLoaderPanel();

  useEffect(() => () => abort.current?.abort(), []);

  const handleBuild = async () => {
    const isLoader = implantBase === "loader";
    const missing = isLoader
      ? loaderRequiredFields.find((f) => !f.ok(loader.formData))
      : stagelessRequiredFields.find((f) => !f.ok(stageless.formData));
    if (missing) return toast.error(`Missing ${missing.label}`);

    abort.current?.abort();
    abort.current = new AbortController();
    setSubmitting(true);
    setBuildError(null);

    const res = isLoader
      ? await buildImplantRequest(loader.formData, implantBase, buildLoaderConfig, abort.current.signal)
      : await buildImplantRequest(stageless.formData, implantBase, buildStagelessConfig, abort.current.signal);
    setSubmitting(false);
    if (!res) return;

    if (res.status !== "success") {
      setBuildError(buildErrorText(res));
      return;
    }

    if (res.bytes) {
      const data = Uint8Array.from(atob(res.bytes), (c) => c.charCodeAt(0));
      const blob = new Blob([data], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = isLoader
        ? loaderOutputDownloadName(loader.formData.format)
        : stagelessOutputDownloadName(stageless.formData.format);
      a.click();
      URL.revokeObjectURL(url);
    }

    toast.success(res.message ?? "Build completed");
  };

  return {
    implantBase,
    submitting,
    buildError,
    setBuildError,
    setImplantBase,
    handleBuild,
    stageless,
    loader,
  };
}
