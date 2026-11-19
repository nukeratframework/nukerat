import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChannelEditor from "./editor/channel";
import { usesCustomHttpRelay, type ImplantFormChange, type ImplantFormData } from "../logic";

const editorChrome =
  "flex min-h-0 flex-1 flex-col border border-[#363636] rounded bg-[#0e0e0e] focus-within:border-[#555] overflow-hidden";

export default function CustomChannelFields({
  formData,
  handleFormChange,
}: {
  formData: ImplantFormData;
  handleFormChange: ImplantFormChange;
}) {
  const { t } = useTranslation();
  const showRelay = usesCustomHttpRelay(formData.os);

  if (!showRelay) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={editorChrome}>
          <ChannelEditor
            key={`${formData.os}-channel`}
            fill
            value={formData.customChannel}
            onChange={(value) => handleFormChange("customChannel", value)}
          />
        </div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="implant" className="implant-custom-channel-tabs">
      <TabsList variant="line" className="gap-4">
        <TabsTrigger value="implant">{t("implants.tabs.implantRoutine")}</TabsTrigger>
        <TabsTrigger value="relay">{t("implants.tabs.relayForwarder")}</TabsTrigger>
      </TabsList>
      <TabsContent value="implant">
        <div className={editorChrome}>
          <ChannelEditor
            key={`${formData.os}-channel`}
            fill
            value={formData.customChannel}
            onChange={(value) => handleFormChange("customChannel", value)}
          />
        </div>
      </TabsContent>
      <TabsContent value="relay">
        <div className={editorChrome}>
          <ChannelEditor
            key={`${formData.os}-relay`}
            fill
            value={formData.customHttpRelay}
            onChange={(value) => handleFormChange("customHttpRelay", value)}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
