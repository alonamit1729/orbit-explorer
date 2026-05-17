import katex from "katex";
import type { CycleJSON, PointJSON } from "../types";

interface Props {
  cycle: CycleJSON;
  color: string;
  size?: number;
}

export function CycleGraphView({ cycle, color, size = 180 }: Props) {
  const n = cycle.points.length;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 26;

  // For n=1: just a dot with a self-loop arrow.
  if (n === 1) {
    return (
      <svg
        className="cyclegraph"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <SelfLoop cx={cx} cy={cy} color={color} />
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

  const positions = cycle.points.map((_, i) => {
    const theta = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return {
      x: cx + r * Math.cos(theta),
      y: cy + r * Math.sin(theta),
      theta,
    };
  });

  // edges: i -> i+1 mod n
  return (
    <svg
      className="cyclegraph"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      <defs>
        <marker
          id={`cycle-arrow-${color.replace("#", "")}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      </defs>

      {positions.map((p, i) => {
        const q = positions[(i + 1) % n];
        // arrow stops short of the destination dot
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const len = Math.hypot(dx, dy);
        const ux = dx / len;
        const uy = dy / len;
        const stop = 7;          // radius to stop short
        const start = 7;
        return (
          <line
            key={i}
            x1={p.x + ux * start}
            y1={p.y + uy * start}
            x2={q.x - ux * stop}
            y2={q.y - uy * stop}
            stroke={color}
            strokeWidth={1.2}
            markerEnd={`url(#cycle-arrow-${color.replace("#", "")})`}
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
      <circle cx={cx} cy={cy} r={5} fill={color}>
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
}: {
  cx: number;
  cy: number;
  color: string;
}) {
  const r = 24;
  // a small circular arc to the right of the dot
  const startX = cx + 6;
  const startY = cy - 2;
  const endX = cx + 6;
  const endY = cy + 2;
  const d = `M ${startX} ${startY} A ${r} ${r} 0 1 1 ${endX} ${endY}`;
  return (
    <>
      <defs>
        <marker
          id={`self-${color.replace("#", "")}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      </defs>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        markerEnd={`url(#self-${color.replace("#", "")})`}
      />
    </>
  );
}
