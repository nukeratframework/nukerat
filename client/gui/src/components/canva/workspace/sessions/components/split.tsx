import { useEffect, useState } from "react";
import { X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { EditSession, type Session } from "@/api/sessions";
import { formatDate, sessionIcon } from "./logic";
import { useTranslation } from "react-i18next";

const inputClass =
  "w-full bg-[#212121] border border-[#363636] text-[#cecece] text-[13.5px] rounded px-3 py-1.5 outline-none cursor-text";

const displayValue = (value?: string | null): string => {
  if (value === undefined || value === null || `${value}`.trim() === "") return "-";
  return String(value);
};

const ViewField = ({
  label,
  value,
  uppercase,
}: {
  label: string;
  value?: string | null;
  uppercase?: boolean;
}) => (
  <div className="mb-3 space-y-1.5">
    <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">{label}</label>
    <input
      type="text"
      readOnly
      tabIndex={-1}
      value={displayValue(value)}
      className={`${inputClass}${uppercase ? " uppercase" : ""}`}
    />
  </div>
);

export default function SplitPanel({ session, onClose, onSaved }: { session: Session | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [note, setNote] = useState(session?.notes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNote(session?.notes ?? "");
  }, [session?.id, session?.notes]);

  let implant: Record<string, unknown> | null = null;
  try {
    if (session?.implant_config) implant = JSON.parse(session.implant_config);
  } catch {}

  const dirty = note !== (session?.notes ?? "");

  return (
    <div className="flex flex-col h-full min-h-0 min-w-[22rem]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0">
        <span className="text-[13.5px] font-semibold text-[#cecece] tracking-wide flex items-center gap-2">
          {session && <img src={sessionIcon(session)} alt="" className="w-[16px] h-[16px] opacity-90" />}
          {t("sessions.view.title", { tag: session?.tag ?? t("sessions.view.fallbackTag") })}
        </span>
        <button type="button" onClick={onClose} className="p-1 rounded text-[#6b6b6b] hover:text-[#d4d4d4] hover:bg-[#2a2a2a] transition-colors cursor-pointer">
          <X size={13} />
        </button>
      </div>
      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-4 py-4">
        <div className="mb-3 space-y-1.5">
          <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">{t("sessions.view.note")}</label>
          <textarea
            className={`${inputClass} min-h-[72px] resize-y py-2 focus:border-[#555] transition-colors`}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <ViewField label={t("sessions.view.fields.lastCheck")} value={session?.last_activity || "-"} />
        <ViewField label={t("sessions.view.fields.tag")} value={session?.tag} />
        <ViewField label={t("sessions.view.fields.hostname")} value={session?.hostname} />
        <ViewField label={t("sessions.view.fields.user")} value={session?.user} />
        <ViewField label={t("sessions.view.fields.privilege")} value={session?.privilege || "user"} />
        <ViewField label={t("sessions.view.fields.internal")} value={session?.internal ?? session?.ip} />
        <ViewField label={t("sessions.view.fields.external")} value={session?.external_ip} />
        <ViewField label={t("sessions.view.fields.listener")} value={session?.listener} uppercase />
        <ViewField label={t("sessions.view.fields.hostServer")} value={session?.host_server} />
        <ViewField label={t("sessions.view.fields.hostPort")} value={session?.host_port != null ? String(session.host_port) : undefined} />
        <ViewField label={t("sessions.view.fields.arch")} value={session?.arch} />
        <ViewField label={t("sessions.view.fields.pid")} value={session?.pid != null ? String(session.pid) : undefined} />
        <ViewField label={t("sessions.view.fields.process")} value={session?.process || "-"} />
        <ViewField label={t("sessions.view.fields.os")} value={session?.os} />
        <ViewField label={t("sessions.view.fields.firstSeen")} value={formatDate(session?.first_seen)} />
        <ViewField label={t("sessions.view.fields.lastSeen")} value={formatDate(session?.last_seen)} />
        <ViewField label={t("sessions.view.fields.delay")} value={session?.delay != null ? String(session.delay) : undefined} />
        <ViewField label={t("sessions.view.fields.server")} value={session?._server} />
        <div className="mb-3 space-y-1.5">
          <label className="block text-[12px] text-[#6e6e6e] uppercase tracking-widest">{t("sessions.view.fields.implantConfig")}</label>
          {implant && typeof implant === "object" ? (
            <div className="rounded border border-[#363636] bg-[#212121] overflow-hidden">
              {Object.entries(implant).map(([key, val], i, arr) => (
                <div key={key} className={`flex items-center gap-3 px-2 py-0.5 ${i < arr.length - 1 ? "border-b border-[#363636]" : ""}`}>
                  <span className="text-[12px] text-[#6e6e6e] uppercase tracking-widest shrink-0">{key}</span>
                  <input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={String(val)}
                    className={`${inputClass} font-mono border-0 bg-transparent px-0 py-0`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <input
              type="text"
              readOnly
              tabIndex={-1}
              value={session?.implant_config?.trim() ? session.implant_config : "-"}
              className={inputClass}
            />
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-nowrap items-center justify-end gap-2 border-t border-[#252525] p-2">
        <button
          type="button"
          disabled={!dirty || saving || !session?._server}
          onClick={async () => {
            if (!session?._server) return;
            setSaving(true);
            const res = await EditSession(session.tag, note, session._server);
            setSaving(false);
            if (res?.status === "success") {
              toast.success(t("sessions.toast.noteSaved"));
              onSaved();
            } else {
              toast.error(res?.message ?? t("sessions.toast.saveFailed"));
            }
          }}
          className="button-default flex h-[29px] shrink-0 items-center gap-1.5 rounded border border-[#444] bg-[#232323] px-3 text-[13px] text-[#c8c8c8] hover:bg-[#2b2b2b] cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
        >
          {saving && <RefreshCw size={10} className="animate-spin" />}
          Save
        </button>
      </div>
    </div>
  );
}
