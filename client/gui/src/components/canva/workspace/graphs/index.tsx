import { useEffect } from 'react';
import type { IDockviewPanelProps } from 'dockview';
import ReactFlow, {
  Background,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
} from 'reactflow';
import { RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import 'reactflow/dist/style.css';
import { graphsMenuRuntimeRef } from '@/components/ui/rigth-click-menu.tsx';

import SplitPanel from './components/split';
import { GraphsDockviewShell } from './components/rigth-click-menu';
import GraphStraightEdge from './components/straight-edge';
import { panelEmptyTextClass } from '@/components/canva/utils/panel-empty-state';
import { useGraph, symmetricOffsets, type EntrypointNodeData, type SessionNodeData } from './components/logic';
import {
  classes,
  colors,
  handleStyle,
  layout,
  node,
  styles,
} from './style';

const HostNode = ({ data }: { data: SessionNodeData }) => {
  const iconCenter = node.iconSize / 2;
  const srcOffsets = symmetricOffsets(data.srcCount ?? 0, layout.handleStep);
  const tgtOffsets = symmetricOffsets(data.tgtCount ?? 0, layout.handleStep);

  return (
  <div style={styles.hostNodeBox}>
    {srcOffsets.map((offset, i) => (
      <Handle
        key={`src-${i}`}
        id={`src-${i}`}
        type="source"
        position={Position.Left}
        isConnectable={false}
        style={handleStyle('left', iconCenter + offset)}
      />
    ))}
    {tgtOffsets.map((offset, i) => (
      <Handle
        key={`tgt-${i}`}
        id={`tgt-${i}`}
        type="target"
        position={Position.Right}
        isConnectable={false}
        style={handleStyle('right', iconCenter + offset)}
      />
    ))}
    <div style={styles.nodeIcon}>
      <img src={data.icon} style={styles.nodeIconImg} />
    </div>
    <div style={styles.nodeLabel}>
      <div style={styles.nodeMetaBold}>{data.ip}</div>
      <div style={styles.nodeTag}>[ {data.tag} ]</div>
    </div>
  </div>
  );
};

const EntrypointNode = ({ data }: { data: EntrypointNodeData }) => {
  const iconCenter = node.entrypointIconMarginTop + node.entrypointIconSize / 2;
  const tgtOffsets = symmetricOffsets(data.tgtCount ?? 0, layout.handleStep);

  return (
  <div style={styles.nodeBox}>
    {tgtOffsets.map((offset, i) => (
      <Handle
        key={`tgt-${i}`}
        id={`tgt-${i}`}
        type="target"
        position={Position.Right}
        isConnectable={false}
        style={handleStyle('right', iconCenter + offset)}
      />
    ))}
    <div style={styles.entrypointNodeIcon}>
      <img src={data.icon} style={styles.entrypointIconImg} />
    </div>
    <div style={styles.nodeLabel}>
      <div style={styles.entrypointRole}>SERVER</div>
      <div style={styles.nodeMetaBold}>{data.label}</div>
    </div>
  </div>
  );
};

const nodeTypes: NodeTypes = { host: HostNode, entrypoint: EntrypointNode };
const edgeTypes = { graphStraight: GraphStraightEdge };

const CustomControls = ({ onRefresh }: { onRefresh: () => void }) => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const zoomInAction = () => zoomIn({ duration: 200 });
  const zoomOutAction = () => zoomOut({ duration: 200 });
  const fitViewAction = () => fitView({ duration: 200 });

  useEffect(() => {
    graphsMenuRuntimeRef.current = {
      refresh: onRefresh,
      zoomIn: zoomInAction,
      zoomOut: zoomOutAction,
      fitView: fitViewAction,
    };
    return () => {
      graphsMenuRuntimeRef.current = null;
    };
  }, [onRefresh, zoomIn, zoomOut, fitView]);

  return (
    <div style={styles.ctrl}>
      <button className="button-default" style={styles.btn} onClick={onRefresh}><RefreshCw size={14} /></button>
      <button className="button-default" style={styles.btn} onClick={zoomInAction}><ZoomIn size={14} /></button>
      <button className="button-default" style={styles.btn} onClick={zoomOutAction}><ZoomOut size={14} /></button>
    </div>
  );
};

const GraphInner = () => {
  const {
    nodes,
    edges,
    overlayMessage,
    panelOpen,
    selected,
    panelStyle,
    closePanel,
    handleNodeClick,
    handleResizeStart,
    refresh,
  } = useGraph();

  return (
    <div className={classes.root}>
      <div className={classes.main}>
        <div className={classes.flowWrap} style={styles.container}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            nodesConnectable={false}
            edgesUpdatable={false}
            connectOnClick={false}
            onNodeClick={handleNodeClick}
          >
            <Background color={colors.grid} gap={24} />
            <CustomControls onRefresh={refresh} />
          </ReactFlow>
          {overlayMessage && (
            <div className={classes.overlay}>
              <span className={panelEmptyTextClass}>{overlayMessage}</span>
            </div>
          )}
        </div>

        {panelOpen && (
          <div style={styles.resizeHandle} className={classes.resize} onMouseDown={handleResizeStart} />
        )}

        <div className={classes.panel(panelOpen)} style={panelStyle}>
          {panelOpen && selected && <SplitPanel host={selected} onClose={closePanel} />}
        </div>
      </div>
    </div>
  );
};

const GraphWindow = (props: IDockviewPanelProps) => (
  <GraphsDockviewShell api={props.api}>
    <ReactFlowProvider>
      <GraphInner />
    </ReactFlowProvider>
  </GraphsDockviewShell>
);

export default GraphWindow;
