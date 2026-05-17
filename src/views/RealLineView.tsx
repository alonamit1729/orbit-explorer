import { useMemo } from "react";
import katex from "katex";
import type { CycleJSON, PointJSON, PreimageNodeJSON } from "../types";

interface Props {
  cycle: CycleJSON;
  color: string;
}

interface PreMark {
  point: PointJSON;
  x: number;                  // numeric value on the line
  depth: number;              // 1, 2, …
  parentX: number;            // x of the f-image (cycle pt for depth 1, parent preimage otherwise)
}

const WIDTH = 720;
const PAD_X = 32;
const Y_AXIS = 70;
const TICK_HEIGHT = 6;
const DEPTH_ROW = 36;         // vertical spacing between preimage depth rows
const CYCLE_LABEL_DY = 18;    // cycle label sits this far below the axis
const PRE_FIRST_ROW_DY = 56;  // depth-1 preimages sit this far below the axis
const ARROW_TRIM = 6;         // pixels trimmed off each arrow end so it doesn't sit on a dot

export function RealLineView({ cycle, color }: Props) {
  const { cyclePoints, preMarks, xMin, xMax, scale, maxDepth } = useMemo(
    () => buildLayout(cycle),
    [cycle],
  );

  const project = (value: number) => PAD_X + (value - xMin) * scale;
  const depthY = (d: number) => Y_AXIS + PRE_FIRST_ROW_DY + (d - 1) * DEPTH_ROW;
  const height = maxDepth >= 1 ? depthY(maxDepth) + 24 : Y_AXIS + 50;

  const colorId = color.replace("#", "");
  const markerColor = `arrow-${colorId}`;
  const markerGrey = `arrow-grey-${colorId}`;
  const n = cyclePoints.length;

  // Cycle arrow specs (one per edge). For n=2 we use two bulge heights so
  // the two opposite-direction arrows don't sit on top of each other.
  const cycleArrows = cyclePoints.map((p, i) => {
    const next = cyclePoints[(i + 1) % n];
    let bulge: number;
    if (n === 1) bulge = 0; // self-loop drawn separately if ever needed
    else if (n === 2) bulge = i === 0 ? 0.55 : 0.28;
    else bulge = 0.55;
    return { from: p.x, to: next.x, bulge };
  });

  return (
    <svg
      className="realline"
      width="100%"
      height={height}
      viewBox={`0 0 ${WIDTH} ${height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <marker
          id={markerColor}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
        <marker
          id={markerGrey}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#7a7a7a" />
        </marker>
      </defs>

      {/* axis */}
      <line
        x1={PAD_X}
        y1={Y_AXIS}
        x2={WIDTH - PAD_X}
        y2={Y_AXIS}
        stroke="#999"
        strokeWidth={1}
      />
      {integerTicks(xMin, xMax).map((t) => (
        <g key={t}>
          <line
            x1={project(t)}
            y1={Y_AXIS - TICK_HEIGHT / 2}
            x2={project(t)}
            y2={Y_AXIS + TICK_HEIGHT / 2}
            stroke="#999"
          />
          <text
            x={project(t)}
            y={Y_AXIS - TICK_HEIGHT - 4}
            fontSize="10"
            fill="#888"
            textAnchor="middle"
          >
            {t}
          </text>
        </g>
      ))}

      {/* cycle arcs above the axis */}
      {cycleArrows.map((a, i) => (
        <CycleArc
          key={i}
          x1={project(a.from)}
          x2={project(a.to)}
          y={Y_AXIS}
          color={color}
          bulge={a.bulge}
          markerId={markerColor}
        />
      ))}

      {/* cycle points on the axis */}
      {cyclePoints.map((p, i) => (
        <g key={`cyc-${i}`}>
          <circle
            cx={project(p.x)}
            cy={Y_AXIS}
            r={5}
            fill={color}
            stroke={color}
          >
            <title>{p.point.decimal}</title>
          </circle>
          <foreignObject
            x={project(p.x) - 60}
            y={Y_AXIS + CYCLE_LABEL_DY}
            width={120}
            height={28}
          >
            <div
              style={{ fontSize: 12, textAlign: "center", lineHeight: 1.1 }}
              dangerouslySetInnerHTML={{
                __html: katex.renderToString(displayLatex(p.point), {
                  throwOnError: false,
                  output: "html",
                }),
              }}
            />
          </foreignObject>
        </g>
      ))}

      {/* preimage-tree connecting arrows (child -> parent, since f(child) = parent) */}
      {preMarks.map((m, i) => {
        const x1 = project(m.x);
        const y1 = depthY(m.depth) - ARROW_TRIM;
        const x2 = project(m.parentX);
        const y2 =
          m.depth === 1 ? Y_AXIS + ARROW_TRIM : depthY(m.depth - 1) + ARROW_TRIM;
        return (
          <line
            key={`pre-arrow-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#7a7a7a"
            strokeWidth={0.9}
            opacity={0.6}
            markerEnd={`url(#${markerGrey})`}
          />
        );
      })}

      {/* preimage dots and labels */}
      {preMarks.map((m, i) => {
        const px = project(m.x);
        const py = depthY(m.depth);
        return (
          <g key={`pre-${i}`}>
            <circle
              cx={px}
              cy={py}
              r={4.5}
              fill="white"
              stroke={color}
              strokeWidth={1.5}
            >
              <title>{`preimage @ depth ${m.depth}: ${m.point.decimal}`}</title>
            </circle>
            <foreignObject
              x={px - 55}
              y={py + 5}
              width={110}
              height={22}
            >
              <div
                style={{
                  fontSize: 11,
                  textAlign: "center",
                  lineHeight: 1.1,
                  color: "#555",
                }}
                dangerouslySetInnerHTML={{
                  __html: katex.renderToString(displayLatex(m.point), {
                    throwOnError: false,
                    output: "html",
                  }),
                }}
              />
            </foreignObject>
            {m.point.kind !== "rational" && m.point.kind !== "radical" && null}
          </g>
        );
      })}
    </svg>
  );
}

function CycleArc({
  x1,
  x2,
  y,
  color,
  bulge,
  markerId,
}: {
  x1: number;
  x2: number;
  y: number;
  color: string;
  bulge: number;
  markerId: string;
}) {
  const dx = x2 - x1;
  const span = Math.abs(dx);
  const arcRadius = Math.max(8, span / 2);
  const height = arcRadius * bulge;
  const mx = (x1 + x2) / 2;
  const my = y - height;
  const path = `M ${x1} ${y - 4} Q ${mx} ${my}, ${x2} ${y - 4}`;
  return (
    <path
      d={path}
      fill="none"
      stroke={color}
      strokeWidth={1.3}
      markerEnd={`url(#${markerId})`}
      opacity={0.9}
    />
  );
}

// ---------------------------------------------------------------------------
// Layout

interface CyclePos {
  point: PointJSON;
  x: number;
}

function buildLayout(cycle: CycleJSON): {
  cyclePoints: CyclePos[];
  preMarks: PreMark[];
  xMin: number;
  xMax: number;
  scale: number;
  maxDepth: number;
} {
  const cyclePoints: CyclePos[] = cycle.points.map((p) => ({
    point: p,
    x: parseFloat(p.short_decimal),
  }));

  const preMarks: PreMark[] = [];
  let maxDepth = 0;
  for (const tree of cycle.preperiodic_trees) {
    const targetIdx = tree.cycle_point_index;
    const targetX = cyclePoints[targetIdx].x;
    collect(tree.roots, targetX, preMarks);
  }
  for (const m of preMarks) maxDepth = Math.max(maxDepth, m.depth);

  const allX = [
    ...cyclePoints.map((p) => p.x),
    ...preMarks.map((m) => m.x),
  ];
  let xMin = Math.min(...allX);
  let xMax = Math.max(...allX);
  if (xMin === xMax) {
    xMin -= 1;
    xMax += 1;
  }
  const span = xMax - xMin;
  xMin -= span * 0.1;
  xMax += span * 0.1;
  const scale = (WIDTH - 2 * PAD_X) / (xMax - xMin);

  return { cyclePoints, preMarks, xMin, xMax, scale, maxDepth };
}

function collect(
  nodes: PreimageNodeJSON[],
  parentX: number,
  out: PreMark[],
): void {
  for (const node of nodes) {
    const x = parseFloat(node.point.short_decimal);
    out.push({
      point: node.point,
      x,
      depth: node.depth,
      parentX,
    });
    if (node.children.length) {
      collect(node.children, x, out);
    }
  }
}

function integerTicks(xMin: number, xMax: number): number[] {
  const lo = Math.ceil(xMin);
  const hi = Math.floor(xMax);
  const span = hi - lo;
  if (span < 0) return [];
  if (span <= 10) return Array.from({ length: span + 1 }, (_, i) => lo + i);
  const step = Math.ceil(span / 10);
  const out: number[] = [];
  for (let v = lo; v <= hi; v += step) out.push(v);
  return out;
}

function displayLatex(p: PointJSON): string {
  if (p.kind === "algebraic") return p.label || "?";
  return p.latex;
}
