import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CircleAlertIcon } from "lucide-react";
import type { NotifyHost } from "@/api/notification";

export default function HostAlert({ host }: { host: NotifyHost }) {
  return (
    <Alert className="flex items-center justify-between gap-2">
      <div className="flex-1 flex flex-col gap-1">
        <AlertTitle>{host.hostname || host.tag}</AlertTitle>
        <AlertDescription>
          {host.ip} · {host.os}
        </AlertDescription>
      </div>
      <CircleAlertIcon className="shrink-0" />
    </Alert>
  );
}
