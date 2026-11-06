import type { CSSProperties } from 'react';

export const colors = {
  bg: 'rgba(23, 23, 23, 1)',
  bgCtrl: 'rgba(26, 26, 26, 1)',
  bgField: 'rgba(33, 33, 33, 1)',
  border: 'rgba(42, 42, 42, 1)',
  borderField: 'rgba(54, 54, 54, 1)',
  text: 'rgba(212, 212, 212, 1)',
  textMuted: 'rgba(206, 206, 206, 1)',
  textDim: 'rgba(110, 110, 110, 1)',
  textBtn: 'rgba(107, 107, 107, 1)',
  textBtnHover: 'rgba(212, 212, 212, 1)',
  textEdge: 'rgba(102, 102, 102, 1)',
  textCtrl: 'rgba(170, 170, 170, 1)',
  elevated: 'rgba(255, 102, 102, 1)',
  edge: 'rgba(85, 85, 85, 0.78)',
  edgeLabel: 'rgba(170, 170, 170, 1)',
  edgeChannel: 'rgba(85, 85, 85, 0.78)',
  edgeChannelLabel: 'rgba(170, 170, 170, 1)',
  grid: 'rgba(34, 34, 34, 1)',
  borderCtrl: 'rgba(51, 51, 51, 1)',
};

export const layout = {
  columnGapX: 220,
  rowGapY: 130,
  blockPad: 140,
  blockGap: 60,
  panelWidth: 440,
  panelMin: 280,
  panelMax: 800,
  handleStep: 12,
};

export const edge = {
  color: colors.edge,
  colorLabel: colors.edgeLabel,
  channelColor: colors.edgeChannel,
  channelLabel: colors.edgeChannelLabel,
  strokeWidth: 1.5,
  markerW: 8,
  markerH: 8,
  labelSize: 8,
  labelWeight: 700,
  labelShowBg: true,
  labelBg: colors.bg,
  labelBgPadding: [6, 6] as [number, number],
};

export const node = {
  iconSize: 64,
  entrypointIconSize: 52,
  entrypointIconMarginTop: 5,
};

export const handleStyle = (side: 'left' | 'right', top: number): CSSProperties => ({
  background: 'transparent',
  border: 'none',
  pointerEvents: 'none',
  width: 1,
  height: 1,
  top,
  ...(side === 'left' ? { left: -10 } : { right: -10 }),
});

export const hostHandleLeft = handleStyle('left', node.iconSize / 2);
export const hostHandleRight = handleStyle('right', node.iconSize / 2);
export const entryHandleRight = handleStyle('right', node.entrypointIconMarginTop + node.entrypointIconSize / 2);

export const styles = {
  container: {
    width: '100%',
    height: '100%',
    background: colors.bg,
    position: 'relative',
  } as CSSProperties,
  ctrl: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    zIndex: 10,
    background: colors.bgCtrl,
    border: `1px solid ${colors.borderCtrl}`,
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    overflow: 'hidden',
  } as CSSProperties,
  btn: {
    background: 'transparent',
    border: 'none',
    color: colors.textCtrl,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    padding: 0,
  } as CSSProperties,
  nodeBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'default',
  } as CSSProperties,
  hostNodeBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'pointer',
  } as CSSProperties,
  nodeIcon: {
    position: 'relative',
    width: node.iconSize,
    height: node.iconSize,
  } as CSSProperties,
  nodeIconImg: {
    width: '100%',
    height: '100%',
  } as CSSProperties,
  entrypointNodeIcon: {
    position: 'relative',
    width: node.entrypointIconSize,
    height: node.entrypointIconSize,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: node.entrypointIconMarginTop,
    marginBottom: 4,
  } as CSSProperties,
  entrypointIconImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  } as CSSProperties,
  nodeLabel: {
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 1.3,
  } as CSSProperties,
  privilege: (elevated: boolean): CSSProperties => ({
    fontSize: 9,
    color: elevated ? colors.elevated : colors.textMuted,
  }),
  nodeTag: {
    fontSize: 9,
    color: '#9e9e9e',
  } as CSSProperties,
  nodeMeta: {
    fontSize: 9,
    color: colors.textMuted,
  } as CSSProperties,
  nodeMetaBold: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: 600,
  } as CSSProperties,
  entrypointRole: {
    fontSize: 9,
    color: colors.textMuted,
  } as CSSProperties,
  resizeHandle: {
    backgroundColor: colors.bg,
  } as CSSProperties,
};

export const classes = {
  root: 'flex flex-col h-full bg-[rgba(23,23,23,1)] text-[rgba(212,212,212,1)] font-mono text-[12px] overflow-hidden',
  main: 'flex flex-1 min-h-0 min-w-0 relative overflow-hidden',
  flowWrap: 'flex-1 min-w-0 relative',
  overlay: 'absolute inset-0 flex items-center justify-center pointer-events-none z-10',
  resize:
    'hidden md:flex w-2 shrink-0 cursor-col-resize items-center justify-center border-l border-l-[rgba(42,42,42,1)] bg-[rgba(23,23,23,1)]',
  panel: (open: boolean) =>
    `flex flex-col min-h-0 min-w-0 bg-[rgba(23,23,23,1)] overflow-hidden absolute inset-0 z-999 md:relative md:inset-auto md:z-auto transition-transform md:transition-[width] duration-300 ease-in-out ${
      open
        ? 'translate-x-0 shrink md:w-[var(--panel-width,440px)] border-l border-[rgba(42,42,42,1)]'
        : 'translate-x-full md:translate-x-0 w-0 shrink-0 pointer-events-none overflow-hidden'
    }`,
  splitHeader: 'flex items-center justify-between px-4 py-3 border-b border-[rgba(42,42,42,1)] shrink-0',
  splitTitle: 'text-[13.5px] font-semibold text-[rgba(206,206,206,1)] tracking-wide',
  splitClose:
    'p-1 rounded text-[rgba(107,107,107,1)] hover:text-[rgba(212,212,212,1)] hover:bg-[rgba(42,42,42,1)] transition-colors cursor-pointer',
  splitBody: 'flex-1 min-h-0 min-w-0 overflow-x-auto overflow-y-auto',
  splitContent: 'min-w-[280px] px-4 py-4',
  splitField: 'mb-3',
  splitLabel: 'block text-[12px] text-[rgba(110,110,110,1)] mb-1.5 uppercase tracking-widest',
  splitValue:
    'w-full bg-[rgba(33,33,33,1)] border border-[rgba(54,54,54,1)] text-[rgba(206,206,206,1)] text-[13.5px] rounded px-3 py-2 select-text',
  splitImplantBox: 'rounded border border-[rgba(54,54,54,1)] bg-[rgba(33,33,33,1)] overflow-hidden',
  splitImplantRow: (last: boolean) =>
    `flex items-center justify-between px-2 py-0.5 text-[13.5px] text-[rgba(206,206,206,1)] ${last ? '' : 'border-b border-[rgba(54,54,54,1)]'}`,
  splitImplantKey: 'text-[12px] text-[rgba(110,110,110,1)] uppercase tracking-widest shrink-0 mr-4',
  splitImplantVal: 'font-mono select-text',
};
