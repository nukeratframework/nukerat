import type { ReactElement } from "react";
import iconCatalog from "../../../../../assets/icons/folders/catalog.json";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export {
  downloadBase64File,
  getBase64Bytes,
  hasValidBase64Content,
  useHorizontalResize,
  useTruncatedNames,
} from "./logic";

const iconModules = import.meta.glob("../../../../../assets/icons/folders/*.svg", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const iconUrlByName: Record<string, string> = Object.fromEntries(
  Object.entries(iconModules)
    .map(([path, url]) => {
      const name = path.split("/").pop()?.replace(/\.svg$/i, "").toLowerCase();
      return name ? [name, url] : null;
    })
    .filter((entry): entry is [string, string] => entry !== null)
);

const catalogSet = new Set((iconCatalog as string[]).map((item) => item.toLowerCase()));

function getFileExtension(fileName: string): string {
  const baseName = fileName.split(/[\\/]/).pop()?.trim().toLowerCase() ?? "";
  if (!baseName) return "";
  const dotIndex = baseName.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === baseName.length - 1) return "";
  return baseName.slice(dotIndex + 1);
}

export function getFileIconSrc(fileName: string): string | null {
  const extension = getFileExtension(fileName);
  if (!extension || !catalogSet.has(extension)) {
    return iconUrlByName.blank ?? null;
  }
  return iconUrlByName[extension] ?? iconUrlByName.blank ?? null;
}

export function getFolderIconSrc(): string | null {
  return iconUrlByName.folder ?? iconUrlByName.default ?? iconUrlByName.blank ?? null;
}

export const FileFallbackIcon = ({ size = 44 }: { size?: number }) => (
  <svg
    width={Math.round(size * 0.72)}
    height={size}
    viewBox="0 0 32 44"
    fill="none"
    onDragStart={(e) => e.preventDefault()}
  >
    <path d="M2 1 L21 1 L31 11 L31 43 L2 43 Z" fill="#d4d4d4" stroke="#aaa" strokeWidth="0.8" />
    <path d="M21 1 L21 11 L31 11 Z" fill="#9b9b9b" />
    <line x1="7" y1="17" x2="25" y2="17" stroke="#bbb" strokeWidth="1.2" />
    <line x1="7" y1="22" x2="25" y2="22" stroke="#bbb" strokeWidth="1.2" />
    <line x1="7" y1="27" x2="20" y2="27" stroke="#bbb" strokeWidth="1.2" />
    <line x1="7" y1="32" x2="22" y2="32" stroke="#bbb" strokeWidth="1.2" />
  </svg>
);

export function NameTooltip({ name, enabled, children }: { name: string; enabled: boolean; children: ReactElement }) {
  if (!enabled) return children;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" className="bg-[#3A3A3A] flex flex-col gap-1">
        <span>{name}</span>
      </TooltipContent>
    </Tooltip>
  );
}
