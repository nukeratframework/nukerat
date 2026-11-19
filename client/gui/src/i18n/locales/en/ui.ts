/** Shared UI primitives: dialogs, pickers, command palette. */
const ui = {
  close: "Close",
  commandPalette: {
    title: "Command Palette",
    description: "Search for a command to run...",
  },
  keyValue: {
    addRow: "Add row",
    key: "Key",
    value: "Value",
    remove: "Remove",
    removeRow: "Remove row {{index}}",
    empty: "Empty",
  },
  calendar: {
    startTime: "Start Time",
    endTime: "End Time",
    date: "Date",
  },
} as const;

export default ui;
