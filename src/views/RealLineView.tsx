import { useMemo } from "react";
import katex from "katex";
import type { CycleJSON, PointJSON } from "../types";
import {
  LEAF_WIDTH,
  layoutCycleSubtree,
  walk,
  type LayoutNode,
} from "./treeLayout";
import { EDGE_COLOR, degreeColor } from "./degreeColor";

interface Props {
  cycle: CycleJSON;
  showPreperiodic: boolean;
  onPointClick?: (p: PointJSON) => void;
}

interface PlacedPre {
  point: PointJSON;
  depth: number;
  x: number;
  y: number;
  parent: { x: number; y: number };
}

const MIN_WIDTH = 720;
const PAD_X = 36;
const Y_AXIS = 70;
const TICK_HEIGHT = 6;
const CYCLE_LABEL_DY = 18;
const SUBTREE_TOP_DY = 60;
const DEPTH_ROW = 38;
const ARROW_TRIM = 6;
const MIN_LANE = LEAF_WIDTH + 20;
const CYCLE_LABEL_FONT = 12;
const PRE_LABEL_FONT = 11;

export function RealLineView({
  cycle,
  showPreperiodic,
  onPointClick,
}: Props) {
  const layout = useMemo(
    () => buildLayout(cycle, showPreperiodic),
    [cycle, showPreperiodic],
  );

  const { svgWidth, svgHeight, cycleAxisXs, cycleArcs, placedPreimages } =
    layout;

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
          id="rl-edge-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_COLOR} />
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
          bulge={a.bulge}
        />
      ))}

      {/* cycle points */}
      {cycleAxisXs.map((cxAxis, i) => {
        const p = cycle.points[i];
        const fill = degreeColor(p.degree);
        const showInline = p.kind !== "algebraic" && p.latex;
        return (
          <g
            key={`cyc-${i}`}
            className="vertex"
            onClick={onPointClick ? () => onPointClick(p) : undefined}
            style={onPointClick ? { cursor: "pointer" } : undefined}
          >
            <circle cx={cxAxis} cy={Y_AXIS} r={5} fill={fill} stroke={fill}>
              <title>{`${p.short_decimal} (click to see value)`}</title>
            </circle>
            {showInline && (
              <foreignObject
                x={cxAxis - 60}
                y={Y_AXIS + CYCLE_LABEL_DY}
                width={120}
                height={28}
              >
                <div
                  style={{
                    fontSize: CYCLE_LABEL_FONT,
                    textAlign: "center",
                    lineHeight: 1.1,
                    pointerEvents: "none",
                  }}
                  dangerouslySetInnerHTML={{
                    __html: katex.renderToString(p.latex, {
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

      {/* preimage-tree edges (child -> parent) */}
      {showPreperiodic &&
        placedPreimages.map((m, i) => (
          <line
            key={`pre-arrow-${i}`}
            x1={m.x}
            y1={m.y - ARROW_TRIM}
            x2={m.parent.x}
            y2={m.parent.y + ARROW_TRIM}
            stroke={EDGE_COLOR}
            strokeWidth={0.9}
            opacity={0.85}
            markerEnd="url(#rl-edge-arrow)"
          />
        ))}

      {/* preimage dots + labels */}
      {showPreperiodic &&
        placedPreimages.map((m, i) => {
          const stroke = degreeColor(m.point.degree);
          const showInline = m.point.kind !== "algebraic" && m.point.latex;
          return (
            <g
              key={`pre-${i}`}
              className="vertex"
              onClick={onPointClick ? () => onPointClick(m.point) : undefined}
              style={onPointClick ? { cursor: "pointer" } : undefined}
            >
              <circle
                cx={m.x}
                cy={m.y}
                r={4.5}
                fill="white"
                stroke={stroke}
                strokeWidth={1.5}
              >
                <title>{`preimage @ depth ${m.depth}: ${m.point.short_decimal}`}</title>
              </circle>
              {showInline && (
                <foreignObject
                  x={m.x - 55}
                  y={m.y + 6}
                  width={110}
                  height={22}
                >
                  <div
                    style={{
                      fontSize: PRE_LABEL_FONT,
                      textAlign: "center",
                      lineHeight: 1.1,
                      color: "#555",
                      pointerEvents: "none",
                    }}
                    dangerouslySetInnerHTML={{
                      __html: katex.renderToString(m.point.latex, {
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

      {n === 1 && (
        <SelfLoop cx={cycleAxisXs[0]} y={Y_AXIS} />
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
  cycleAxisXs: number[];
  cycleArcs: CycleArcSpec[];
  placedPreimages: PlacedPre[];
  ticks: Tick[];
}

function buildLayout(cycle: CycleJSON, showPreperiodic: boolean): Layout {
  const n = cycle.points.length;
  const cycleX = cycle.points.map((p) => parseFloat(p.short_decimal));

  let xMin = Math.min(...cycleX);
  let xMax = Math.max(...cycleX);
  if (xMin === xMax) {
    xMin -= 1;
    xMax += 1;
  }
  const span = xMax - xMin;
  xMin -= span * 0.1;
  xMax += span * 0.1;

  const subtrees = cycle.preperiodic_trees.map((t) =>
    layoutCycleSubtree(t.roots),
  );
  const maxDepth = subtrees.reduce((d, s) => Math.max(d, s.maxDepth), 0);

  const order = cycleX
    .map((v, idx) => ({ v, idx }))
    .sort((a, b) => a.v - b.v)
    .map((o) => o.idx);

  const laneWidths = order.map((idx) =>
    showPreperiodic ? Math.max(MIN_LANE, subtrees[idx].width) : 0,
  );
  const totalLaneWidth = laneWidths.reduce((s, w) => s + w, 0);

  const svgWidth = Math.max(MIN_WIDTH, totalLaneWidth + 2 * PAD_X);

  const projectAxis = (value: number) =>
    PAD_X + ((value - xMin) / (xMax - xMin)) * (svgWidth - 2 * PAD_X);

  const cycleAxisXs = cycleX.map(projectAxis);

  const laneCenters: number[] = new Array(n).fill(0);
  let cursor = PAD_X;
  for (let i = 0; i < order.length; i++) {
    const idx = order[i];
    const w = laneWidths[i];
    laneCenters[idx] = cursor + w / 2;
    cursor += w;
  }

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
          let parent: { x: number; y: number };
          if (node.depth === 1) {
            parent = { x: cyclePointX, y: Y_AXIS };
          } else {
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
            x: ax,
            y: ay,
            parent,
          });
        });
      }
    }
  }

  const cycleArcs: CycleArcSpec[] = cycle.points.map((_, i) => {
    const fromX = cycleAxisXs[i];
    const toX = cycleAxisXs[(i + 1) % n];
    let bulge: number;
    if (n === 1) bulge = 0;
    else if (n === 2) bulge = i === 0 ? 0.55 : 0.28;
    else bulge = 0.55;
    return { fromX, toX, bulge };
  });

  const ticks: Tick[] = integerTicks(xMin, xMax).map((t) => ({
    label: t,
    x: projectAxis(t),
  }));

  const preBottomY =
    showPreperiodic && maxDepth >= 1
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

// ---------------------------------------------------------------------------

function CycleArc({
  x1,
  x2,
  y,
  bulge,
}: {
  x1: number;
  x2: number;
  y: number;
  bulge: number;
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
      stroke={EDGE_COLOR}
      strokeWidth={1.3}
      markerEnd="url(#rl-edge-arrow)"
      opacity={0.9}
    />
  );
}

function SelfLoop({ cx, y }: { cx: number; y: number }) {
  const r = 10;
  const sx = cx + 4;
  const sy = y - 5;
  const ex = cx - 4;
  const ey = y - 5;
  const d = `M ${sx} ${sy} A ${r} ${r} 0 1 0 ${ex} ${ey}`;
  return (
    <path
      d={d}
      fill="none"
      stroke={EDGE_COLOR}
      strokeWidth={1.2}
      markerEnd="url(#rl-edge-arrow)"
    />
  );
}
