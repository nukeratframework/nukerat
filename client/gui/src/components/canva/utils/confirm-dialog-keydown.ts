export function tryConfirmDialogEnter(
  e: KeyboardEvent,
  confirm: () => void,
  busy?: () => boolean,
) {
  if (e.key !== "Enter" || e.repeat) return;
  if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
  if (busy?.()) return;
  e.preventDefault();
  e.stopPropagation();
  confirm();
}
