import { useImplantsPanel } from "./components/logic";
import ImplantBaseSelector from "./components/selector";
import LoaderBuildBar from "./components/loader/build-bar";
import LoaderLeftSide from "./components/loader/left-side";
import LoaderRightSide from "./components/loader/right-side";
import StagelessBuildBar from "./components/stageless/build-bar";
import StagelessLeftSide from "./components/stageless/left-side";
import StagelessRightSide from "./components/stageless/right-side";

const ImplantsPanel = () => {
  const panel = useImplantsPanel();
  const isStageless = panel.implantBase === "stageless";
  const isLoader = panel.implantBase === "loader";

  return (
    <div className="flex flex-col h-full bg-[#171717] text-[#d4d4d4] font-mono text-[12px] select-none overflow-hidden">
      <div className="flex flex-1 min-h-0">
        <div className="w-[180px] shrink-0 border-r border-[#252525] bg-[#171717] flex flex-col min-h-0">
          <ImplantBaseSelector implantBase={panel.implantBase} onImplantBaseChange={panel.setImplantBase} />
          {(isStageless || isLoader) && (
            <>
              {isStageless ? (
                <StagelessLeftSide
                  section={panel.stageless.section}
                  format={panel.stageless.formData.format}
                  os={panel.stageless.formData.os}
                  onSelect={panel.stageless.setSection}
                />
              ) : (
                <LoaderLeftSide
                  section={panel.loader.section}
                  format={panel.loader.formData.format}
                  os={panel.loader.formData.os}
                  onSelect={panel.loader.setSection}
                />
              )}
            </>
          )}
        </div>
        {isStageless ? (
          <StagelessRightSide
            section={panel.stageless.section}
            formData={panel.stageless.formData}
            handleFormChange={panel.stageless.handleFormChange}
          />
        ) : isLoader ? (
          <LoaderRightSide
            section={panel.loader.section}
            formData={panel.loader.formData}
            handleFormChange={panel.loader.handleFormChange}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-[13px] text-[#555]">
            Select an implant base to configure build options.
          </div>
        )}
      </div>
      {isStageless ? (
        <StagelessBuildBar
          submitting={panel.submitting}
          error={panel.buildError}
          onBuild={panel.handleBuild}
          onClear={() => panel.setBuildError(null)}
        />
      ) : isLoader ? (
        <LoaderBuildBar
          submitting={panel.submitting}
          error={panel.buildError}
          onBuild={panel.handleBuild}
          onClear={() => panel.setBuildError(null)}
        />
      ) : null}
    </div>
  );
};

export default ImplantsPanel;
