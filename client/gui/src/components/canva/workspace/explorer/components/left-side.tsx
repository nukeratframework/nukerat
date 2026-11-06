import { ChevronRight, ChevronDown, Folder, FolderOpen, File } from "lucide-react";
import {
  getChildren,
  isFile,
  useLeftSideTree,
  useTreeNodeClick,
} from "./logic";

export const EXPLORER_LEFT_SIDE_MAX_WIDTH = 400;

const TreeRow = ({
  name,
  depth,
  isSelected,
  isOpen,
  hasSubs,
  isFileNode,
  onClick,
  onDoubleClick,
  onChevronClick,
}: {
  name: string;
  depth: number;
  isSelected: boolean;
  isOpen: boolean;
  hasSubs: boolean;
  isFileNode: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onChevronClick?: () => void;
}) => (
  <div
    className={`flex items-center gap-[3px] pr-2 py-[3px] mx-[10px] my-[1px] rounded-[6px] cursor-pointer select-none ${isSelected ? "bg-[#252525]" : "bg-transparent"}`}
    style={{ paddingLeft: depth * 12 + 4 }}
    onClick={onClick}
    onDoubleClick={onDoubleClick}
  >
    <span
      className="w-3 h-3 shrink-0 text-[#999] flex items-center justify-center"
      onClick={onChevronClick ? (e) => { e.stopPropagation(); onChevronClick(); } : undefined}
    >
      {hasSubs ? (isOpen ? <ChevronDown size={9} /> : <ChevronRight size={9} />) : null}
    </span>
    <span className={`w-[16px] h-[16px] shrink-0 flex items-center justify-center ${isSelected ? "text-[#f6b544]" : "text-[#cecece]"}`}>
      {isFileNode ? <File size={16} /> : isOpen ? <FolderOpen size={16} /> : <Folder size={16} />}
    </span>
    <span className={`font-[400] text-[13.5px] overflow-hidden text-ellipsis whitespace-nowrap ${isSelected ? "text-[#d4d4d4]" : "text-[#cecece]"}`}>
      {name}
    </span>
  </div>
);

const TreeNode = ({
  name,
  node,
  depth,
  path,
  currentPath,
  expandedPaths,
  onExpand,
  onToggle,
  onFileClick,
}: {
  name: string;
  node: unknown;
  depth: number;
  path: string[];
  currentPath: string[];
  expandedPaths: Set<string>;
  onExpand: (path: string[]) => void;
  onToggle: (key: string) => void;
  onFileClick: (path: string[]) => void;
}) => {
  const pathKey = path.join("/");
  const isFileNode = isFile(node);
  const children = isFileNode ? [] : getChildren(node);
  const hasSubs = children.length > 0;
  const isOpen = expandedPaths.has(pathKey);
  const isSelected = JSON.stringify(currentPath) === JSON.stringify(path);
  const { handleClick, handleDoubleClick, handleChevronClick } = useTreeNodeClick(
    isFileNode,
    path,
    pathKey,
    isOpen,
    onExpand,
    onToggle,
    onFileClick
  );

  return (
    <>
      <TreeRow
        name={name}
        depth={depth}
        isSelected={isSelected}
        isOpen={isOpen}
        hasSubs={hasSubs}
        isFileNode={isFileNode}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onChevronClick={!isFileNode ? handleChevronClick : undefined}
      />
      {isOpen && !isFileNode && children.map(([childName, childNode]) => (
        <TreeNode
          key={childName}
          name={childName}
          node={childNode}
          depth={depth + 1}
          path={[...path, childName]}
          currentPath={currentPath}
          expandedPaths={expandedPaths}
          onExpand={onExpand}
          onToggle={onToggle}
          onFileClick={onFileClick}
        />
      ))}
    </>
  );
};

const LeftSide = ({
  explorerTree,
  currentPath,
  width,
  loading,
  disabled,
  onExpand,
  onFileClick,
}: {
  explorerTree: unknown[];
  currentPath: string[];
  width: number;
  loading: boolean;
  disabled: boolean;
  onExpand: (path: string[]) => void;
  onFileClick: (path: string[]) => void;
}) => {
  const { search, setSearch, displayExpanded, rootEntries, toggle } = useLeftSideTree(explorerTree, currentPath);

  const panelWidth = Math.min(width, EXPLORER_LEFT_SIDE_MAX_WIDTH);

  return (
    <div className="shrink-0 dv-bg-window flex flex-col overflow-hidden" style={{ width: panelWidth }}>
      <div
        style={{ borderColor: "#222323" }}
        className={`shrink-0 border-b dv-bg-window ${loading ? "pointer-events-none" : ""}`}
      >
        <div className="p-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            disabled={disabled}
            className="box-border h-[29px] w-full select-none rounded border border-[#363636] bg-[#212121] px-3 py-0 text-[13.5px] text-[#cecece] outline-none transition-colors placeholder:text-[#444] focus:border-[#555] disabled:opacity-50"
          />
        </div>
      </div>
      <div className={`flex-1 overflow-y-auto pt-2 pb-1 ${loading ? "pointer-events-none" : ""}`}>
        {rootEntries.map(([name, node]) => (
          <TreeNode
            key={name}
            name={name}
            node={node}
            depth={0}
            path={[name]}
            currentPath={currentPath}
            expandedPaths={displayExpanded}
            onExpand={onExpand}
            onToggle={toggle}
            onFileClick={onFileClick}
          />
        ))}
      </div>
    </div>
  );
};

export default LeftSide;
