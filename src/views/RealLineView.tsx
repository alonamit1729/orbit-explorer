import { useMemo } from "react";
import katex from "katex";
import type { CycleJSON, PointJSON } from "../types";
import {
  LEAF_WIDTH,
  layoutCycleSubtree,
  walk,
  type LayoutNode,
} from "./treeLayout";

interface Props {
  cycle: CycleJSON;
  color: string;
  showPreperiodic: boolean;
}

interface PlacedPre {
  point: PointJSON;
  depth: number;
  leafStatus: LayoutNode["leafStatus"];
  x: number;            // absolute SVG x
  y: number;
  parent: { x: number; y: number };   // image (f(this)) — cycle pt or another preimage
}

const MIN_WIDTH = 720;
const PAD_X = 36;
const Y_AXIS = 70;
const TICK_HEIGHT = 6;
const CYCLE_LABEL_DY = 18;
const SUBTREE_TOP_DY = 60;       // depth-1 row sits this far below the axis
const DEPTH_ROW = 38;            // vertical spacing between depth rows
const ARROW_TRIM = 6;
const MIN_LANE = LEAF_WIDTH + 20;

export function RealLineView({ cycle, color, showPreperiodic }: Props) {
  const layout = useMemo(
    () => buildLayout(cycle, showPreperiodic),
    [cycle, showPreperiodic],
  );

  const { svgWidth, svgHeight, cycleAxisXs, cycleArcs, placedPreimages } =
    layout;

  const colorId = color.replace("#", "");
  const markerColor = `arrow-${colorId}`;
  const markerGrey = `arrow-grey-${colorId}`;
  const n = cycle.points.length;

  return (
    <svg
      className="realline"
      width="100%"
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
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
        x2={svgWidth - PAD_X}
        y2={Y_AXIS}
        stroke="#999"
        strokeWidth={1}
      />
      {layout.ticks.map((t) => (
        <g key={t.label}>
          <line
            x1={t.x}
            y1={Y_AXIS - TICK_HEIGHT / 2}
            x2={t.x}
            y2={Y_AXIS + TICK_HEIGHT / 2}
            stroke="#999"
          />
          <text
            x={t.x}
            y={Y_AXIS - TICK_HEIGHT - 4}
            fontSize="10"
            fill="#888"
            textAnchor="middle"
          >
            {t.label}
          </text>
        </g>
      ))}

      {/* cycle arcs above the axis */}
      {cycleArcs.map((a, i) => (
        <CycleArc
          key={i}
          x1={a.fromX}
          x2={a.toX}
          y={Y_AXIS}
          color={color}
          bulge={a.bulge}
          markerId={markerColor}
        />
      ))}

      {/* cycle points */}
      {cycleAxisXs.map((cx, i) => {
        const p = cycle.points[i];
        return (
          <g key={`cyc-${i}`}>
            <circle
              cx={cx}
              cy={Y_AXIS}
              r={5}
              fill={color}
              stroke={color}
            >
              <title>{p.decimal}</title>
            </circle>
            <foreignObject
              x={cx - 60}
              y={Y_AXIS + CYCLE_LABEL_DY}
              width={120}
              height={28}
            >
              <div
                style={{ fontSize: 12, textAlign: "center", lineHeight: 1.1 }}
                dangerouslySetInnerHTML={{
                  __html: katex.renderToString(displayLatex(p), {
                    throwOnError: false,
                    output: "html",
                  }),
                }}
              />
            </foreignObject>
          </g>
        );
      })}

      {/* pre-periodic tree edges (parent of each preimage on the LEFT — its
         f-image — is closer to the axis; the arrow points toward that
         image, since f(child) = parent) */}
      {showPreperiodic &&
        placedPreimages.map((m, i) => (
          <line
            key={`pre-arrow-${i}`}
            x1={m.x}
            y1={m.y - ARROW_TRIM}
            x2={m.parent.x}
            y2={m.parent.y + ARROW_TRIM}
            stroke="#7a7a7a"
            strokeWidth={0.9}
            opacity={0.7}
            markerEnd={`url(#${markerGrey})`}
          />
        ))}

      {/* pre-periodic dots + labels */}
      {showPreperiodic &&
        placedPreimages.map((m, i) => (
          <g key={`pre-${i}`}>
            <circle
              cx={m.x}
              cy={m.y}
              r={4.5}
              fill="white"
              stroke={color}
              strokeWidth={1.5}
            >
              <title>{`preimage @ depth ${m.depth}: ${m.point.decimal}`}</title>
            </circle>
            <foreignObject
              x={m.x - 55}
              y={m.y + 6}
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
          </g>
        ))}

      {/* n=1 fixed-point hint: tiny self-loop above the axis */}
      {n === 1 && (
        <SelfLoop
          cx={cycleAxisXs[0]}
          y={Y_AXIS}
          color={color}
          markerId={markerColor}
        />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Layout

interface CycleArcSpec {
  fromX: number;
  toX: number;
  bulge: number;
}

interface Tick {
  label: number;
  x: number;
}

interface Layout {
  svgWidth: number;
  svgHeight: number;
  cycleAxisXs: number[];               // by cycle.points index
  cycleArcs: CycleArcSpec[];
  placedPreimages: PlacedPre[];
  ticks: Tick[];
}

function buildLayout(cycle: CycleJSON, showPreperiodic: boolean): Layout {
  const n = cycle.points.length;
  const cycleX = cycle.points.map((p) => parseFloat(p.short_decimal));

  // -------- horizontal extent (axis) --------
  let xMin = Math.min(...cycleX);
  let xMax = Math.max(...cycleX);
  if (xMin === xMax) {
    xMin -= 1;
    xMax += 1;
  }
  const span = xMax - xMin;
  xMin -= span * 0.1;
  xMax += span * 0.1;

  // -------- subtree widths (only used when showing pre-periodic) --------
  const subtrees = cycle.preperiodic_trees.map((t) =>
    layoutCycleSubtree(t.roots),
  );
  const maxDepth = subtrees.reduce((d, s) => Math.max(d, s.maxDepth), 0);

  // Sort cycle-point indices by their true x so lanes are laid out
  // left-to-right in the same order as points appear on the line.
  const order = cycleX
    .map((v, idx) => ({ v, idx }))
    .sort((a, b) => a.v - b.v)
    .map((o) => o.idx);

  // Lane width per cycle point: max of (subtree width, MIN_LANE) when
  // pre-periodic is shown; otherwise 0 (no lanes).
  const laneWidths = order.map((idx) =>
    showPreperiodic ? Math.max(MIN_LANE, subtrees[idx].width) : 0,
  );
  const totalLaneWidth = laneWidths.reduce((s, w) => s + w, 0);

  // SVG width: enough for both the axis and the lanes underneath.
  const svgWidth = Math.max(MIN_WIDTH, totalLaneWidth + 2 * PAD_X);

  // Axis scale: project xMin/xMax across the full svg width.
  const projectAxis = (value: number) =>
    PAD_X + ((value - xMin) / (xMax - xMin)) * (svgWidth - 2 * PAD_X);

  const cycleAxisXs = cycleX.map(projectAxis);

  // -------- assign lane centers (only when showing pre-periodic) --------
  // Lanes packed left-to-right at PAD_X start. Lane center is its midpoint.
  const laneCenters: number[] = new Array(n).fill(0);
  let cursor = PAD_X;
  for (let i = 0; i < order.length; i++) {
    const idx = order[i];
    const w = laneWidths[i];
    laneCenters[idx] = cursor + w / 2;
    cursor += w;
  }

  // -------- place each preimage in absolute coords --------
  const placed: PlacedPre[] = [];
  if (showPreperiodic) {
    for (let i = 0; i < n; i++) {
      const subtree = subtrees[i];
      if (subtree.roots.length === 0) continue;
      const laneCenter = laneCenters[i];
      const laneLeft = laneCenter - subtree.width / 2;
      const cyclePointX = cycleAxisXs[i];

      for (const root of subtree.roots) {
        walk(root, (node) => {
          const ax = laneLeft + node.x;
          const ay = Y_AXIS + SUBTREE_TOP_DY + (node.depth - 1) * DEPTH_ROW;
          // parent (the f-image): for depth-1, that's the cycle point on
          // the axis; for deeper nodes, the parent in the tree.
          let parent: { x: number; y: number };
          if (node.depth === 1) {
            parent = { x: cyclePointX, y: Y_AXIS };
          } else {
            // Find parent in tree (one of root's descendants whose child
            // list contains this node).
            const p = findParent(subtree.roots, node);
            if (p) {
              parent = {
                x: laneLeft + p.x,
                y: Y_AXIS + SUBTREE_TOP_DY + (p.depth - 1) * DEPTH_ROW,
              };
            } else {
              parent = { x: cyclePointX, y: Y_AXIS };
            }
          }
          placed.push({
            point: node.point,
            depth: node.depth,
            leafStatus: node.leafStatus,
            x: ax,
            y: ay,
            parent,
          });
        });
      }
    }
  }

  // -------- cycle arcs --------
  const cycleArcs: CycleArcSpec[] = cycle.points.map((_, i) => {
    const fromX = cycleAxisXs[i];
    const toX = cycleAxisXs[(i + 1) % n];
    let bulge: number;
    if (n === 1) bulge = 0;
    else if (n === 2) bulge = i === 0 ? 0.55 : 0.28;
    else bulge = 0.55;
    return { fromX, toX, bulge };
  });

  // -------- ticks --------
  const ticks: Tick[] = integerTicks(xMin, xMax).map((t) => ({
    label: t,
    x: projectAxis(t),
  }));

  // -------- final height --------
  const preBottomY = showPreperiodic && maxDepth >= 1
    ? Y_AXIS + SUBTREE_TOP_DY + (maxDepth - 1) * DEPTH_ROW + 32
    : Y_AXIS + 50;
  const svgHeight = Math.max(140, preBottomY);

  return {
    svgWidth,
    svgHeight,
    cycleAxisXs,
    cycleArcs,
    placedPreimages: placed,
    ticks,
  };
}

function findParent(
  roots: LayoutNode[],
  target: LayoutNode,
): LayoutNode | null {
  for (const r of roots) {
    const found = findParentIn(r, target);
    if (found) return found;
  }
  return null;
}

function findParentIn(
  node: LayoutNode,
  target: LayoutNode,
): LayoutNode | null {
  for (const c of node.children) {
    if (c === target) return node;
    const found = findParentIn(c, target);
    if (found) return found;
  }
  return null;
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

// ---------------------------------------------------------------------------

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
  if (x1 === x2) return null;
  const span = Math.abs(x2 - x1);
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

function SelfLoop({
  cx,
  y,
  color,
  markerId,
}: {
  cx: number;
  y: number;
  color: string;
  markerId: string;
}) {
  // Loop above the axis; the preimage subtree (if any) lives below the axis
  // and the depth-1 connector drops straight down, so we keep the loop fully
  // above to avoid crossings.
  const r = 10;
  const sx = cx + 4;
  const sy = y - 5;
  const ex = cx - 4;
  const ey = y - 5;
  // sweep=0 sends the arc up-and-over (the short way, above the axis).
  const d = `M ${sx} ${sy} A ${r} ${r} 0 1 0 ${ex} ${ey}`;
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
