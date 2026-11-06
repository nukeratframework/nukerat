import { memo, useEffect, useRef, useState } from 'react';
import { BaseEdge, getStraightPath, type EdgeProps } from 'reactflow';

const edgeLabelAngle = (sourceX: number, sourceY: number, targetX: number, targetY: number) => {
  let angle = (Math.atan2(targetY - sourceY, targetX - sourceX) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return angle;
};

const GraphStraightEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding = [6, 6],
  style,
  markerEnd,
  markerStart,
  interactionWidth,
}: EdgeProps) => {
  const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  const textRef = useRef<SVGTextElement>(null);
  const [bbox, setBbox] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!textRef.current) return;
    const b = textRef.current.getBBox();
    setBbox({ width: b.width, height: b.height });
  }, [label]);

  const angle = edgeLabelAngle(sourceX, sourceY, targetX, targetY);
  const padX = labelBgPadding[0];
  const padY = labelBgPadding[1];

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={style}
        markerEnd={markerEnd}
        markerStart={markerStart}
        interactionWidth={interactionWidth}
      />
      {label ? (
        <g
          className="react-flow__edge-textwrapper"
          transform={`translate(${labelX}, ${labelY}) rotate(${angle})`}
          visibility={bbox.width ? 'visible' : 'hidden'}
        >
          {labelShowBg ? (
            <rect
              className="react-flow__edge-textbg"
              x={-bbox.width / 2 - padX}
              y={-bbox.height / 2 - padY}
              width={bbox.width + padX * 2}
              height={bbox.height + padY * 2}
              style={labelBgStyle}
            />
          ) : null}
          <text
            ref={textRef}
            className="react-flow__edge-text"
            textAnchor="middle"
            dominantBaseline="middle"
            style={labelStyle}
          >
            {label}
          </text>
        </g>
      ) : null}
    </>
  );
};

export default memo(GraphStraightEdge);
