import type { ImplantFormChange, ImplantFormData, Section } from "./logic";
import C2 from "./fields/c2";
import General from "./fields/general";
import PeArtifacts from "./fields/pe_artifacts";
import Preface from "./fields/preface";
import Runtime from "./fields/runtime";

const sectionFields: Record<
  Section,
  React.ComponentType<{ formData: ImplantFormData; handleFormChange: ImplantFormChange }>
> = {
  general: General,
  preface: Preface,
  c2: C2,
  artifact: PeArtifacts,
  runtime: Runtime,
};

export default ({
  section,
  formData,
  handleFormChange,
}: {
  section: Section;
  formData: ImplantFormData;
  handleFormChange: ImplantFormChange;
}) => {
  const Fields = sectionFields[section];
  const fillEditorHeight =
    section === "preface" || (section === "c2" && formData.protocol === "custom");

  return (
    <div className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden">
      <div
        className={`flex min-h-0 flex-1 flex-col min-w-[320px] px-4 py-4 ${
          fillEditorHeight ? "overflow-hidden" : "overflow-auto"
        }`}
      >
        <Fields formData={formData} handleFormChange={handleFormChange} />
      </div>
    </div>
  );
};
