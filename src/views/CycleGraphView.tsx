import katex from "katex";
import type { CycleJSON, PointJSON } from "../types";

interface Props {
  cycle: CycleJSON;
  color: string;
  size?: number;
}

const VERTEX_R = 5;
const ARC_PAD_RAD = 0.10;     // radians inset so arcs clear the vertex dots

export function CycleGraphView({ cycle, color, size = 180 }: Props) {
  const n = cycle.points.length;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 26;

  const markerId = `cycle-arrow-${color.replace("#", "")}`;
  const arrowMarker = (
    <marker
      id={markerId}
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="5"
      markerHeight="5"
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
    </marker>
  );

  // n = 1: self-loop on a single point.
  if (n === 1) {
    return (
      <svg
        className="cyclegraph"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <defs>{arrowMarker}</defs>
        <SelfLoop cx={cx} cy={cy} color={color} markerId={markerId} />
        <PointDot
          cx={cx}
          cy={cy}
          point={cycle.points[0]}
          color={color}
          labelDx={0}
          labelDy={22}
        />
      </svg>
    );
  }

  // n = 2: two separate arrows curving in opposite directions.
  if (n === 2) {
    const ax = cx;
    const ay = cy - r;
    const bx = cx;
    const by = cy + r;
    const bulge = r * 0.55;
    const trim = VERTEX_R + 2;
    const ay1 = ay + trim;
    const by1 = by - trim;
    const ay2 = ay + trim;
    const by2 = by - trim;
    return (
      <svg
        className="cyclegraph"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <defs>{arrowMarker}</defs>
        {/* 0 -> 1, bulges right */}
        <path
          d={`M ${ax} ${ay1} Q ${cx + bulge} ${cy} ${bx} ${by2}`}
          fill="none"
          stroke={color}
          strokeWidth={1.3}
          markerEnd={`url(#${markerId})`}
        />
        {/* 1 -> 0, bulges left */}
        <path
          d={`M ${bx} ${by1} Q ${cx - bulge} ${cy} ${ax} ${ay2}`}
          fill="none"
          stroke={color}
          strokeWidth={1.3}
          markerEnd={`url(#${markerId})`}
        />
        <PointDot
          cx={ax}
          cy={ay}
          point={cycle.points[0]}
          color={color}
          labelDx={0}
          labelDy={-12}
        />
        <PointDot
          cx={bx}
          cy={by}
          point={cycle.points[1]}
          color={color}
          labelDx={0}
          labelDy={22}
        />
      </svg>
    );
  }

  // n >= 3: vertices on a circle; edges are arcs along the same circle.
  const positions = cycle.points.map((_, i) => {
    const theta = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return {
      x: cx + r * Math.cos(theta),
      y: cy + r * Math.sin(theta),
      theta,
    };
  });

  return (
    <svg
      className="cyclegraph"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      <defs>{arrowMarker}</defs>

      {positions.map((p, i) => {
        const q = positions[(i + 1) % n];
        const startTheta = p.theta + ARC_PAD_RAD;
        const endTheta = q.theta - ARC_PAD_RAD;
        const sx = cx + r * Math.cos(startTheta);
        const sy = cy + r * Math.sin(startTheta);
        const ex = cx + r * Math.cos(endTheta);
        const ey = cy + r * Math.sin(endTheta);
        // arc length per edge is 2*pi/n < pi for n>=3, so large-arc-flag = 0;
        // sweep-flag = 1 (clockwise) matches our vertex traversal order.
        return (
          <path
            key={i}
            d={`M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`}
            fill="none"
            stroke={color}
            strokeWidth={1.3}
            markerEnd={`url(#${markerId})`}
          />
        );
      })}

      {positions.map((p, i) => {
        const out = Math.cos(p.theta);
        const above = Math.sin(p.theta);
        const labelDx = out * 18;
        const labelDy = above * 18 + 4;
        return (
          <PointDot
            key={i}
            cx={p.x}
            cy={p.y}
            point={cycle.points[i]}
            color={color}
            labelDx={labelDx}
            labelDy={labelDy}
          />
        );
      })}
    </svg>
  );
}

function PointDot({
  cx,
  cy,
  point,
  color,
  labelDx,
  labelDy,
}: {
  cx: number;
  cy: number;
  point: PointJSON;
  color: string;
  labelDx: number;
  labelDy: number;
}) {
  const labelText =
    point.kind === "algebraic" && point.label ? point.label : point.latex;
  const html = katex.renderToString(labelText, {
    throwOnError: false,
    output: "html",
  });
  return (
    <g>
      <circle cx={cx} cy={cy} r={VERTEX_R} fill={color}>
        <title>{point.decimal}</title>
      </circle>
      <foreignObject
        x={cx + labelDx - 50}
        y={cy + labelDy - 8}
        width={100}
        height={24}
      >
        <div
          style={{
            textAlign: "center",
            fontSize: 11,
            lineHeight: 1.1,
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </foreignObject>
    </g>
  );
}

function SelfLoop({
  cx,
  cy,
  color,
  markerId,
}: {
  cx: number;
  cy: number;
  color: string;
  markerId: string;
}) {
  // small loop to the right of the dot, with arrow coming back to the dot
  const lr = 18;
  const sx = cx + VERTEX_R;
  const sy = cy - 1;
  const ex = cx + VERTEX_R;
  const ey = cy + 1;
  const d = `M ${sx} ${sy} A ${lr} ${lr} 0 1 1 ${ex} ${ey}`;
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={1.2}
      markerEnd={`url(#${markerId})`}
    />
  );
}
