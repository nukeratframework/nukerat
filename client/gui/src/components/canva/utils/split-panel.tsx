const splitGutterPx = 8;
const splitMainMinWidth = 0;
const splitPanelAbsoluteMax = Math.round(2200 * 0.4);

export const splitPanelDefaultWidth = 530;
export const splitPanelMinWidth = 270;

export function splitPanelMaxWidth(
  containerWidth: number,
  panelMinWidth: number
): number {
  if (containerWidth <= 0) return splitPanelAbsoluteMax;
  const maxByContainer =
    containerWidth - splitMainMinWidth - splitGutterPx;
  return Math.max(
    panelMinWidth,
    Math.min(splitPanelAbsoluteMax, maxByContainer)
  );
}
