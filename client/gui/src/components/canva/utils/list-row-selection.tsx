import type { MouseEvent } from "react";

export function listRowMouseDown(
  event: MouseEvent,
  clearSelection: () => void
) {
  if (!(event.target as HTMLElement).closest("tbody tr")) {
    clearSelection();
  }
}
