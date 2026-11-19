/** File browser panel: toolbar, tree, menus, file operations. */
const explorer = {
  searchPlaceholder: "Search...",
  empty: "No content found",
  download: "Download",
  iconView: "Icon view",
  listView: "List view",
  fileType: "File",
  folderType: "Folder",
  itemOne: "{{count}} item",
  itemMany: "{{count}} items",
  itemsUnknown: "{{value}} items",
  oversized: "This file is over 25 MB.",
  oversizedHint: "Download it from the terminal instead.",
  columns: {
    name: "Name",
    type: "Type",
    size: "Size",
    modified: "Modified",
  },
  toast: {
    listFailed: "Could not list folder content.",
    openFailed: "Could not open file.",
    pathFailed: "Could not access the requested path.",
    contentFailed: "Could not retrieve file content.",
  },
} as const;

export default explorer;
