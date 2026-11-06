import { useEffect } from "react";
import { toast } from "sonner";
import { PinOff, X } from "lucide-react";
import { MdCheckCircleOutline, MdErrorOutline, MdInfoOutline } from "react-icons/md";
import TopBar from "./topbar";
import Workspace from "./workspace";
import EmptyView from "./empty";
import { emptyMenuRuntimeRef } from "./empty/rigth-click-menu";
import { sessionsOpenRef } from "./workspace/sessions/components/rigth-click-menu";
import { hostOsIcon } from "@/api/notification";
import { useCanva, notifyDurationSecs } from "./logic";
import { CanvaShortcuts } from "./shortcuts";
import CtaToast from "./utils/cta";

const truncate = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max - 3)}...`;

export default function Canva() {
  const {
    tabs,
    activeId,
    floatType,
    notifyBatch,
    setNotifyBatch,
    FloatComp,
    refs,
    setActiveId,
    setFloatType,
    openWindow,
    openTerminalForNotify,
    openWindowForNotify,
    addTab,
    closeTab,
    updateTab,
  } = useCanva();

  useEffect(() => {
    emptyMenuRuntimeRef.current = {
      openWindow,
      floatWindow: (t) => setFloatType(t),
    };
    sessionsOpenRef.current = {
      closeFloat: () => setFloatType(null),
      openWindowForNotify,
    };
  });
  useEffect(() => {
    if (!notifyBatch.length) return;
    for (const n of notifyBatch) {
      if ("ip" in n) {
        const openFromToast = () => {
          setFloatType(null);
          openTerminalForNotify(n);
        };
        toast.info("New session", {
          className: "!h-auto !py-2 select-none cursor-pointer relative overflow-hidden",
          style: {
            background: "#1515154a",
            backdropFilter: "blur(10px)",
          },
          classNames: {
            icon: "!size-10 !min-w-10",
            title: "!text-[14.5px] !font-medium",
            description: "!text-[#9B9B9B] !text-[13px]",
          },
          description: (
            <>
              <b>{n.tag}</b>
              {n.ip ? ` - ${n.ip}` : null}
            </>
          ),
          icon: (
            <img
              src={hostOsIcon(n.os)}
              alt=""
              className="h-full w-full pr-[2px] object-contain pointer-events-none"
            />
          ),
          action: {
            label: "",
            onClick: openFromToast,
          },
          actionButtonStyle: {
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0,
            cursor: "pointer",
            margin: 0,
            padding: 0,
            border: "none",
            background: "transparent",
          },
          duration: notifyDurationSecs * 3000,
          position: "top-right",
        });
      } else {
        const kind = n.type || "info";
        (kind === "error" ? toast.error : kind === "success" ? toast.success : toast.info)(truncate(n.title || "Notification", 25), {
          className: "!h-auto !py-2 min-w-[100px]",
          style: {
            background: "#1515154a",
            backdropFilter: "blur(10px)",
          },
          classNames: {
            icon: "!size-5 !min-w-5",
            title: "!text-[14.5px] !font-medium",
            description: "!text-[#9B9B9B] !text-[13px]",
          },
          description: n.description ? truncate(n.description, 300) : undefined,
          icon: kind === "error"
            ? <MdErrorOutline size={18} className="text-[#b08080]" />
            : kind === "success"
              ? <MdCheckCircleOutline size={18} className="text-[#80b090]" />
              : <MdInfoOutline size={18} className="text-[#8090b0]" />,
          duration: notifyDurationSecs * 3000,
          position: "top-right",
        });
      }
    }
    setNotifyBatch([]);
  }, [notifyBatch, setNotifyBatch, openTerminalForNotify, setFloatType]);

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden">
      <CtaToast />
      <CanvaShortcuts
        tabs={tabs}
        activeId={activeId}
        floatType={floatType}
        setActiveId={setActiveId}
        setFloatType={setFloatType}
        addTab={addTab}
        closeTab={closeTab}
        openWindow={openWindow}
        floatWindow={(t) => setFloatType(t)}
        workspaceRefs={refs}
      />
      <TopBar
        openWindow={openWindow}
        floatWindow={(t) => setFloatType(t)}
        workspaceTabs={tabs}
        activeTabId={activeId}
        onTabSelect={setActiveId}
        onTabAdd={addTab}
        onTabClose={closeTab}
        onTabRename={(id, name) => updateTab(id, { name })}
      />
      <div className="flex-1 overflow-hidden relative bg-color-workspace">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="absolute inset-0"
            style={{ display: tab.id === activeId ? "flex" : "none", flexDirection: "column" }}
          >
            {tab.hasWindows ? (
              <Workspace
                ref={(r: any) => {
                  if (r) refs.current.set(tab.id, r);
                }}
                setWindows={(v: boolean) => updateTab(tab.id, { hasWindows: v })}
                pendingWindow={tab.pendingWindow}
                pendingPanelParams={tab.pendingPanelParams}
                onWindowOpen={() =>
                  updateTab(tab.id, { pendingWindow: null, pendingPanelParams: null })
                }
              />
            ) : (
              <EmptyView />
            )}
          </div>
        ))}
      </div>
      {FloatComp && (
        <div
          style={{ borderRadius: "10px" }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-0 bg-topbar-window"
        >
          {/* <div className="absolute inset-0" onClick={() => setFloatType(null)} /> */}
          <div
            className={`relative flex flex-col w-full h-full ${
              floatType === "about"
                ? "md:w-[18rem] md:h-[20rem] md:max-h-[85vh]"
                : "md:w-[55rem] md:h-[65vh]"
            }`}
            style={{
              background: "#171717",
              borderRadius: "10px",
              border: "1px solid #222222",
              overflow: "hidden",
            }}
          >
            <div
              className="flex items-center justify-between px-4 shrink-0 h-9 md:h-[36px]"
              style={{
                background: "#171717",
                borderBottom: "1px solid #222222",
              }}
            >
              <span className="text-xs font-medium text-[#cecece] text-[13.5px] capitalize select-none">
                {floatType}
              </span>
              <div className="flex items-center gap-0.5">
                {floatType !== "about" && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!floatType) return;
                      openWindow(floatType);
                      setFloatType(null);
                    }}
                    className="button-default cursor-pointer rounded hover:bg-[#292929] p-1"
                  >
                    <PinOff size={14} className="text-[#616161]" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFloatType(null)}
                  className="button-default cursor-pointer rounded hover:bg-[#292929] p-1"
                >
                  <X size={16} className="text-[#616161]" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <FloatComp />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
