import { X } from "lucide-react";
import type { GraphSession } from "@/api/graphs";
import { classes } from "../style";
import { formatDate } from "./logic";

const formatValue = (value: unknown) =>
  value == null || `${value}`.trim() === "" ? "-" : String(value);

export default function SplitPanel({ host, onClose }: { host: GraphSession | null; onClose: () => void }) {
  let implant: Record<string, unknown> | null = null;
  try {
    if (host?.implant_config) implant = JSON.parse(host.implant_config);
  } catch {}

  const fields = [
    ["Last Check", host?.last_activity || "-"],
    ["Tag", host?.tag],
    ["Hostname", host?.hostname],
    ["User", host?.user],
    ["Privilege", host?.privilege || "user"],
    ["Internal", host?.internal ?? host?.ip],
    ["External", host?.external_ip],
    ["Listener", host?.listener],
    ["Host Server", host?.host_server],
    ["Host Port", host?.host_port],
    ["Arch", host?.arch],
    ["PID", host?.pid],
    ["Process", host?.process],
    ["OS", host?.os],
    ["First Seen", formatDate(host?.first_seen)],
    ["Last Seen", formatDate(host?.last_seen)],
    ["delay", host?.delay],
    ["Server", host?._server],
  ] as const;

  return (
    <>
      <div className={classes.splitHeader}>
        <span className={classes.splitTitle}>View - {host?.tag ?? "Host"}</span>
        <button type="button" onClick={onClose} className={classes.splitClose}>
          <X size={13} />
        </button>
      </div>
      <div className={classes.splitBody}>
        <div className={classes.splitContent}>
          {fields.map(([label, value]) => (
            <div key={label} className={classes.splitField}>
              <label className={classes.splitLabel}>{label}</label>
              <input
                type="text"
                readOnly
                tabIndex={-1}
                value={formatValue(value)}
                className={`${classes.splitValue} outline-none cursor-text${label === "Listener" ? " uppercase" : ""}`}
              />
            </div>
          ))}
          <div className={classes.splitField}>
            <label className={classes.splitLabel}>Implant Config</label>
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
