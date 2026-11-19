/** Native (Electron main process) dialogs. */
const dialog = {
  quitConfirmTitle: "Confirm exit",
  quitConfirmMessage: "There are active sessions. Are you sure you want to quit?",
  quit: "Quit",
  cancel: "Cancel",
} as const;

export default dialog;
