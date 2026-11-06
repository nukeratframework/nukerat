import type { ReactNode } from "react";
import type { DockviewPanelApi } from "dockview";
import { CircleX, ExternalLink } from "lucide-react";
import type { NotifyHost } from "@/api/notification";
import type { PanelCustomMenuItem } from "@/components/ui/rigth-click-menu.tsx";
import { PanelDockviewShell, sessionsMenuRuntimeRef } from "@/components/ui/rigth-click-menu.tsx";
import { hostOpenPanels } from "@/components/canva/topbar/index";

export const sessionsOpenRef = {
  current: null as null | { closeFloat: () => void; openWindowForNotify: (type: string, n: NotifyHost) => void },
};

const hostNotify = (s: {
  tag: string;
  ip: string;
  os: string;
  hostname?: string;
  first_seen: string;
  last_seen: string;
  delay: number;
}): NotifyHost => ({
  tag: s.tag,
  ip: s.ip,
  os: s.os,
  hostname: s.hostname ?? "",
  first_seen: s.first_seen,
  last_seen: s.last_seen,
  delay: s.delay,
});

export function buildSessionsMenuHeader(): PanelCustomMenuItem[] {
  const s = sessionsMenuRuntimeRef.current?.getMenuSession?.();
  if (!s) return [];
  const tag = s.tag?.trim() || "Untagged";
  const ip = (s.internal ?? s.ip)?.trim();
  const sub = [ip, s.hostname?.trim(), s.os?.trim()].filter(Boolean).join(" · ");
  return [{ kind: "header", label: tag, description: sub || undefined }];
}

export function buildSessionsOpenMenu(): PanelCustomMenuItem[] {
  if (!sessionsMenuRuntimeRef.current?.getMenuSession?.()) return [];
  return [
    {
      kind: "action",
      label: "Open",
      icon: ExternalLink,
      items: hostOpenPanels.map((p) => ({
        kind: "action" as const,
        label: p.label,
        icon: p.icon,
        onClick: () => {
          const s = sessionsMenuRuntimeRef.current?.getMenuSession?.();
          if (!s) return;
          sessionsOpenRef.current?.closeFloat();
          sessionsOpenRef.current?.openWindowForNotify(p.type, hostNotify(s));
        },
      })),
    },
  ];
}

export function buildSessionsKillMenu(): PanelCustomMenuItem[] {
  if (!sessionsMenuRuntimeRef.current?.getMenuSession?.()) return [];
  return [
    {
      kind: "action",
      label: "Kill session",
      icon: CircleX,
      onClick: () => {
        const rt = sessionsMenuRuntimeRef.current;
        if (!rt?.canKill()) return;
        rt.openKillConfirm();
      },
      disabled: () => !sessionsMenuRuntimeRef.current?.canKill(),
    },
  ];
}

export function SessionsDockviewShell({
  api,
  children,
}: {
  api: DockviewPanelApi;
  children: ReactNode;
}) {
  return (
    <PanelDockviewShell api={api} kind="sessions">
      {children}
    </PanelDockviewShell>
  );
}
