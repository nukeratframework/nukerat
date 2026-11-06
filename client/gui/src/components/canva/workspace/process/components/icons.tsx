import { getProcessIcon } from "./logic";

export function ProcessIcon({
  name,
  size = 12,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const Icon = getProcessIcon(name);
  return <Icon size={size} className={className} />;
}
