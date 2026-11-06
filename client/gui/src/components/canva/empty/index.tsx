import logoSvg from "@/assets/logo.svg";
import { EmptyViewShell } from "./rigth-click-menu";

const EmptyView = () => {
  return (
    <EmptyViewShell>
      <div
        data-empty-workspace
        className="bg-color-workspace flex-1 h-full"
        style={{
          paddingLeft: ".9rem",
          paddingRight: ".9rem",
          paddingTop: ".2rem",
          paddingBottom: ".9rem",
        }}
      >
        <div
          className="bg-color-workspace overflow-hidden relative h-full"
          style={{
            border: "2px dashed #4c4c4c",
            padding: "12px",
            width: "100%",
            height: "100%",
            borderRadius: ".5em",
          }}
        >
          <img
            className="select-none"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "15%",
              height: "15%",
              opacity: 0.04,
              pointerEvents: "none",
            }}
            src={logoSvg}
            alt=""
          />
        </div>
      </div>
    </EmptyViewShell>
  );
};

export default EmptyView;
