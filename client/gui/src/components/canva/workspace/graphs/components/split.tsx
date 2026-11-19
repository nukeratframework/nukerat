import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { GraphSession } from "@/api/graphs";
import { classes } from "../style";
import { formatDate } from "./logic";

const formatValue = (value: unknown) =>
  value == null || `${value}`.trim() === "" ? "-" : String(value);

export default function SplitPanel({ host, onClose }: { host: GraphSession | null; onClose: () => void }) {
  const { t } = useTranslation();
  let implant: Record<string, unknown> | null = null;
  try {
    if (host?.implant_config) implant = JSON.parse(host.implant_config);
  } catch {}

  const fields = [
    ["lastCheck", t("graphs.detail.lastCheck"), host?.last_activity || "-"],
    ["tag", t("graphs.detail.tag"), host?.tag],
    ["hostname", t("graphs.detail.hostname"), host?.hostname],
    ["user", t("graphs.detail.user"), host?.user],
    ["privilege", t("graphs.detail.privilege"), host?.privilege || "user"],
    ["internal", t("graphs.detail.internal"), host?.internal ?? host?.ip],
    ["external", t("graphs.detail.external"), host?.external_ip],
    ["listener", t("graphs.detail.listener"), host?.listener],
    ["hostServer", t("graphs.detail.hostServer"), host?.host_server],
    ["hostPort", t("graphs.detail.hostPort"), host?.host_port],
    ["arch", t("graphs.detail.arch"), host?.arch],
    ["pid", t("graphs.detail.pid"), host?.pid],
    ["process", t("graphs.detail.process"), host?.process],
    ["os", t("graphs.detail.os"), host?.os],
    ["firstSeen", t("graphs.detail.firstSeen"), formatDate(host?.first_seen)],
    ["lastSeen", t("graphs.detail.lastSeen"), formatDate(host?.last_seen)],
    ["delay", t("graphs.detail.delay"), host?.delay],
    ["server", t("graphs.detail.server"), host?._server],
  ] as const;

  return (
    <>
      <div className={classes.splitHeader}>
        <span className={classes.splitTitle}>{t("graphs.detail.title", { tag: host?.tag ?? t("graphs.detail.fallbackHost") })}</span>
        <button type="button" onClick={onClose} className={classes.splitClose}>
          <X size={13} />
        </button>
      </div>
      <div className={classes.splitBody}>
        <div className={classes.splitContent}>
          {fields.map(([key, label, value]) => (
            <div key={key} className={classes.splitField}>
              <label className={classes.splitLabel}>{label}</label>
              <input
                type="text"
                readOnly
                tabIndex={-1}
                value={formatValue(value)}
                className={`${classes.splitValue} outline-none cursor-text${key === "listener" ? " uppercase" : ""}`}
              />
            </div>
          ))}
          <div className={classes.splitField}>
            <label className={classes.splitLabel}>{t("graphs.detail.implantConfig")}</label>
            {implant && typeof implant === "object" ? (
              <div className={classes.splitImplantBox}>
                {Object.entries(implant).map(([key, val], i, arr) => (
                  <div key={key} className={classes.splitImplantRow(i === arr.length - 1)}>
                    <span className={classes.splitImplantKey}>{key}</span>
                    <input
                      type="text"
                      readOnly
                      tabIndex={-1}
                      value={String(val)}
                      className={`${classes.splitValue} ${classes.splitImplantVal} min-w-0 flex-1 border-0 bg-transparent px-0 py-0 outline-none cursor-text`}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <input
                type="text"
                readOnly
                tabIndex={-1}
                value={host?.implant_config?.trim() ? host.implant_config : "-"}
                className={`${classes.splitValue} outline-none cursor-text`}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
