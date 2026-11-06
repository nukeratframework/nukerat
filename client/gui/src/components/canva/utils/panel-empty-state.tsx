import type { ReactNode } from "react";
import { cn } from "@/components/ui/lib/utils";

export const panelEmptyTextClass = "text-[13px] text-[#5E5D5F] select-none";

type PanelEmptyStateProps = {
  children: ReactNode;
  className?: string;
};

export function PanelEmptyState({ children, className }: PanelEmptyStateProps) {
  return (
    <div className={cn("flex flex-1 items-center justify-center min-h-0", className)}>
      <span className={panelEmptyTextClass}>{children}</span>
    </div>
  );
}
