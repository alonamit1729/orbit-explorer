import { useMemo } from "react";
import katex from "katex";
import type { CycleJSON, PointJSON, PreimageNodeJSON } from "../types";

interface Props {
  cycle: CycleJSON;
  color: string;
}

interface Mark {
  x: number;             // numeric value
  point: PointJSON;
  role: "cycle" | "pre";
  depth: number;         // 0 for cycle, 1..N for preimage depth
  edgeFromValue?: number; // forward image (where f(this) lands), if known
}

const WIDTH = 720;
const HEIGHT = 130;
const PAD_X = 32;
const Y_AXIS = 70;        // y coord of the number-line axis
const TICK_HEIGHT = 6;

export function RealLineView({ cycle, color }: Props) {
  const { marks, xMin, xMax, scale } = useMemo(() => buildMarks(cycle), [cycle]);

  function project(value: number): number {
    return PAD_X + (value - xMin) * scale;
  }

  // forward arrows: cycle -> next cycle point; pre -> its image
  const cyclePoints: Mark[] = marks.filter((m) => m.role === "cycle");
  const prePoints: Mark[] = marks.filter((m) => m.role === "pre");

  // Cycle arrows: connect points[i] -> points[(i+1) % n]
  const cycleArrows = cyclePoints.map((m, i) => {
    const next = cyclePoints[(i + 1) % cyclePoints.length];
    return { from: m.x, to: next.x };
  });

  return (
    <svg
      className="realline"
      width="100%"
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <marker
          id={`arrow-${color.replace("#", "")}`}
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
          id="arrow-grey"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#888" />
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
      {/* axis ticks at integers within range */}
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
            y={Y_AXIS + TICK_HEIGHT + 11}
            fontSize="10"
            fill="#888"
            textAnchor="middle"
          >
            {t}
          </text>
        </g>
      ))}

      {/* cycle arcs (above the axis) */}
      {cycleArrows.map((a, i) => (
        <CycleArc
          key={i}
          x1={project(a.from)}
          x2={project(a.to)}
          y={Y_AXIS}
          color={color}
        />
      ))}

      {/* pre-periodic arrows: pre point -> its forward image */}
      {prePoints.map((m, i) =>
        m.edgeFromValue != null ? (
          <line
            key={`pre-arrow-${i}`}
            x1={project(m.x)}
            y1={Y_AXIS - 1}
            x2={project(m.edgeFromValue)}
            y2={Y_AXIS - 1}
            stroke="#888"
            strokeWidth={0.8}
            markerEnd="url(#arrow-grey)"
            opacity={0.55}
          />
        ) : null,
      )}

      {/* points */}
      {marks.map((m, i) => {
        const cx = project(m.x);
        const isCycle = m.role === "cycle";
        const r = isCycle ? 5 : 3.2;
        return (
          <g key={i}>
            <circle
              cx={cx}
              cy={Y_AXIS}
              r={r}
              fill={isCycle ? color : "white"}
              stroke={color}
              strokeWidth={isCycle ? 0 : 1.2}
            >
              <title>{tooltip(m)}</title>
            </circle>
            {isCycle && (
              <foreignObject
                x={cx - 60}
                y={Y_AXIS + 18}
                width={120}
                height={32}
              >
                <div
                  style={{
                    fontSize: 12,
                    textAlign: "center",
                    lineHeight: 1.1,
                  }}
                  dangerouslySetInnerHTML={{
                    __html: katex.renderToString(displayLatex(m.point), {
                      throwOnError: false,
                      output: "html",
                    }),
                  }}
                />
              </foreignObject>
            )}
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
}: {
  x1: number;
  x2: number;
  y: number;
  color: string;
}) {
  const dx = x2 - x1;
  const r = Math.max(8, Math.abs(dx) / 2);
  const mx = (x1 + x2) / 2;
  const my = y - r * 0.55;
  // quadratic curve above axis
  const path = `M ${x1} ${y - 4} Q ${mx} ${my}, ${x2} ${y - 4}`;
  return (
    <path
      d={path}
      fill="none"
      stroke={color}
      strokeWidth={1.3}
      markerEnd={`url(#arrow-${color.replace("#", "")})`}
      opacity={0.85}
    />
  );
}

// ---------------------------------------------------------------------------

function buildMarks(cycle: CycleJSON): {
  marks: Mark[];
  xMin: number;
  xMax: number;
  scale: number;
} {
  const marks: Mark[] = cycle.points.map((p) => ({
    x: parseFloat(p.short_decimal),
    point: p,
    role: "cycle",
    depth: 0,
  }));

  // pre-periodic
  for (const tree of cycle.preperiodic_trees) {
    const targetIdx = tree.cycle_point_index;
    const target = cycle.points[targetIdx];
    const targetX = parseFloat(target.short_decimal);
    walkTree(tree.roots, targetX, marks);
  }

  const values = marks.map((m) => m.x);
  let xMin = Math.min(...values);
  let xMax = Math.max(...values);
  if (xMin === xMax) {
    xMin -= 1;
    xMax += 1;
  }
  const span = xMax - xMin;
  xMin -= span * 0.1;
  xMax += span * 0.1;
  const scale = (WIDTH - 2 * PAD_X) / (xMax - xMin);
  return { marks, xMin, xMax, scale };
}

function walkTree(
  nodes: PreimageNodeJSON[],
  parentX: number,
  out: Mark[],
): void {
  for (const node of nodes) {
    const x = parseFloat(node.point.short_decimal);
    out.push({
      x,
      point: node.point,
      role: "pre",
      depth: node.depth,
      edgeFromValue: parentX,
    });
    if (node.children.length) {
      walkTree(node.children, x, out);
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

function tooltip(m: Mark): string {
  const label =
    m.point.kind === "algebraic" && m.point.label
      ? `${m.point.label}`
      : m.point.short_decimal;
  return `${m.role === "cycle" ? "cycle" : `preimage @ depth ${m.depth}`}: ${label} ≈ ${m.point.short_decimal}`;
}

function displayLatex(p: PointJSON): string {
  if (p.kind === "algebraic") return p.label || "?";
  return p.latex;
}
