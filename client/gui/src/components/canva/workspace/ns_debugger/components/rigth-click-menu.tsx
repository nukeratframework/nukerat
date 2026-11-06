import type { ReactNode } from "react";
import type { DockviewPanelApi } from "dockview";
import { PanelDockviewShell } from "@/components/ui/rigth-click-menu.tsx";

export function NsDebuggerDockviewShell({
  api,
  children,
}: {
  api: DockviewPanelApi;
  children: ReactNode;
}) {
  return (
    <PanelDockviewShell api={api} kind="nsDebugger">
      {children}
    </PanelDockviewShell>
  );
}
