import { Fragment, useEffect, useState } from "react";
import logoSvg from "@/assets/logo.svg";

type AboutInfo = {
  version: string;
  electron: string;
  chromium: string;
  node: string;
  platform: string;
  electronBuildId?: string;
};

const AboutPanel = () => {
  const [info, setInfo] = useState<AboutInfo | null>(null);

  useEffect(() => {
    void window.electronAPI?.invoke("app:getAboutInfo").then((res) => {
      if (res && typeof res === "object") setInfo(res as AboutInfo);
    });
  }, []);

  return (
    <div
      style={{ borderRadius: "15px" }}
      className="flex flex-col h-full bg-[#171717] text-[#cecece] font-mono text-[12px] select-none overflow-hidden"
    >
      <div className="flex flex-1 min-h-0 flex-col items-center justify-center px-6 py-5 gap-4">
        <div className="flex flex-col items-center gap-1.5">
          <div
            aria-hidden
            className="w-[3.1rem] h-[3.1rem] shrink-0 select-none pointer-events-none"
            style={{
              backgroundColor: "#999999",
              maskImage: `url("${logoSvg}")`,
              WebkitMaskImage: `url("${logoSvg}")`,
              maskSize: "contain",
              WebkitMaskSize: "contain",
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskPosition: "center",
            }}
          />
          <span className="font-medium text-[17.5px] text-[#999999]">
            NukeRat Framework
          </span>
        </div>

        {info && (
          <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px] text-[#cecece] leading-[1.65] w-full">
            {(
              [
                ["Version", info.version],
                ["Platform", info.platform],
                ["Electron", info.electron],
                ...(info.electronBuildId
                  ? [["ElectronBuildId", info.electronBuildId] as const]
                  : []),
                ["Chromium", info.chromium],
                ["Node", info.node],
                ["Author", "Gustavo Henrique T."],
              ] as const
            ).map(([label, value]) => (
              <Fragment key={label}>
                <dt className="text-left whitespace-nowrap">{label}:</dt>
                <dd className="m-0 select-text cursor-text min-w-0 break-all">{value}</dd>
              </Fragment>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
};

export default AboutPanel;
