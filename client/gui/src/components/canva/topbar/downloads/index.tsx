import DownloadsMain from "./components/main";
import { useDownloadsPanel } from "./components/logic";

export function DownloadsTopbarButton() {
  const panel = useDownloadsPanel();
  return <DownloadsMain {...panel} />;
}
