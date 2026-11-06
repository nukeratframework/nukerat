import type { ReactNode } from "react";
import type { DockviewPanelApi } from "dockview";
import { PanelDockviewShell } from "@/components/ui/rigth-click-menu.tsx";

export function FileServerDockviewShell({
  api,
  children,
}: {
  api: DockviewPanelApi;
  children: ReactNode;
}) {
  return (
    <PanelDockviewShell api={api} kind="fileServer">
      {children}
    </PanelDockviewShell>
  );
}
