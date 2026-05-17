import katex from "katex";
import type { CycleJSON, PointJSON, PreimageNodeJSON } from "../types";
import { leafCount } from "./treeLayout";
import { EDGE_COLOR, degreeColor } from "./degreeColor";

interface Props {
  cycle: CycleJSON;
  showPreperiodic: boolean;
  onPointClick?: (p: PointJSON) => void;
}

/* Layout constants are in viewBox units. The SVG element uses
 * width="100%" so the browser scales the whole viewBox up when the
 * container is large (e.g. inside the zoom modal). Font sizes are also
 * in viewBox units, so they scale with everything else — which is what
 * keeps proportions sensible across both inline and zoomed renderings. */
const VERTEX_R = 5;
const PRE_R = 3.8;
const BASE_R = 64;               // cycle's radius — fixed in viewBox units
const RING_GAP = 24;             // radial spacing between preimage depth rings
const LABEL_PAD = 26;            // extra outside radius for labels
const ARC_PAD_RAD = 0.10;
const VERTEX_LABEL_FONT = 11;
const PRE_LABEL_FONT = 10;

interface PlacedPre {
  point: PointJSON;
  depth: number;
  x: number;
  y: number;
  parentX: number;
  parentY: number;
  outX: number;
  outY: number;
}

export function CycleGraphView({ cycle, showPreperiodic, onPointClick }: Props) {
  const n = cycle.points.length;

  const maxDepth = showPreperiodic
    ? cycle.preperiodic_trees.reduce(
        (d, t) => Math.max(d, maxTreeDepth(t.roots)),
        0,
      )
    : 0;

  const outerR = BASE_R + maxDepth * RING_GAP + LABEL_PAD;
  const size = 2 * outerR + 20;
  const cx = size / 2;
  const cy = size / 2;
  const r = BASE_R;

  const arrowMarker = (
    <marker
      id="cg-edge-arrow"
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="5"
      markerHeight="5"
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_COLOR} />
    </marker>
  );

  // Vertex positions.
  const positions = cycle.points.map((_, i) => {
    if (n === 1) return { x: cx, y: cy, theta: 0 };
    const theta = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return {
      x: cx + r * Math.cos(theta),
      y: cy + r * Math.sin(theta),
      theta,
    };
  });

  // Radial preimage layout.
  const placed: PlacedPre[] = [];
  if (showPreperiodic) {
    const wedgeWidth = n === 1 ? 2 * Math.PI : (2 * Math.PI) / n;
    for (let i = 0; i < n; i++) {
      const tree = cycle.preperiodic_trees.find(
        (t) => t.cycle_point_index === i,
      );
      if (!tree || tree.roots.length === 0) continue;
      const center = positions[i].theta;
      placeWedge(
        tree.roots,
        center - wedgeWidth / 2,
        center + wedgeWidth / 2,
        positions[i].x,
        positions[i].y,
        cx,
        cy,
        r,
        placed,
      );
    }
  }

  return (
    <svg
      className="cyclegraph"
      width="100%"
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>{arrowMarker}</defs>

      {n === 1 && <SelfLoop cx={cx} cy={cy} />}

      {n === 2 && (
        <TwoCycleArcs
          ax={positions[0].x}
          ay={positions[0].y}
          bx={positions[1].x}
          by={positions[1].y}
          cx={cx}
          cy={cy}
        />
      )}

      {n >= 3 &&
        positions.map((p, i) => {
          const q = positions[(i + 1) % n];
          const startTheta = p.theta + ARC_PAD_RAD;
          const endTheta = q.theta - ARC_PAD_RAD;
          const sx = cx + r * Math.cos(startTheta);
          const sy = cy + r * Math.sin(startTheta);
          const ex = cx + r * Math.cos(endTheta);
          const ey = cy + r * Math.sin(endTheta);
          return (
            <path
              key={i}
              d={`M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`}
              fill="none"
              stroke={EDGE_COLOR}
              strokeWidth={1.3}
              markerEnd="url(#cg-edge-arrow)"
            />
          );
        })}

      {/* preimage tree edges */}
      {placed.map((m, i) => {
        const [x1, y1] = trimToward(m.x, m.y, m.parentX, m.parentY, PRE_R);
        const [x2, y2] = trimToward(
          m.parentX,
          m.parentY,
          m.x,
          m.y,
          VERTEX_R + 1,
        );
        return (
          <line
            key={`pre-edge-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={EDGE_COLOR}
            strokeWidth={0.9}
            opacity={0.85}
            markerEnd="url(#cg-edge-arrow)"
          />
        );
      })}

      {/* preimage dots + labels */}
      {placed.map((m, i) => (
        <PreDot
          key={`pre-${i}`}
          cx={m.x}
          cy={m.y}
          point={m.point}
          outX={m.outX}
          outY={m.outY}
          onClick={onPointClick}
        />
      ))}

      {/* cycle vertices last so they sit on top of edges */}
      {positions.map((p, i) => {
        const out = n === 1 ? 0 : Math.cos(p.theta);
        const above = n === 1 ? 1 : Math.sin(p.theta);
        const labelInside = showPreperiodic && n >= 3;
        const rad = labelInside ? -18 : 18;
        const labelDx = out * rad;
        const labelDy = above * rad + (labelInside ? -2 : 4);
        return (
          <VertexDot
            key={i}
            cx={p.x}
            cy={p.y}
            point={cycle.points[i]}
            labelDx={labelDx}
            labelDy={labelDy}
            onClick={onPointClick}
          />
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Layout helpers

function maxTreeDepth(roots: PreimageNodeJSON[]): number {
  let d = 0;
  for (const r of roots) d = Math.max(d, subtreeDepth(r));
  return d;
}

function subtreeDepth(node: PreimageNodeJSON): number {
  if (node.children.length === 0) return node.depth;
  let d = node.depth;
  for (const c of node.children) d = Math.max(d, subtreeDepth(c));
  return d;
}

function placeWedge(
  roots: PreimageNodeJSON[],
  wedgeStart: number,
  wedgeEnd: number,
  parentX: number,
  parentY: number,
  cx: number,
  cy: number,
  baseR: number,
  out: PlacedPre[],
): void {
  const totalLeaves = roots.reduce((s, r) => s + leafCount(r), 0);
  if (totalLeaves === 0) return;
  const wedgeWidth = wedgeEnd - wedgeStart;
  let cursor = wedgeStart;
  for (const root of roots) {
    const share = (leafCount(root) / totalLeaves) * wedgeWidth;
    placeNode(
      root,
      cursor,
      cursor + share,
      parentX,
      parentY,
      cx,
      cy,
      baseR,
      out,
    );
    cursor += share;
  }
}

function placeNode(
  node: PreimageNodeJSON,
  angleStart: number,
  angleEnd: number,
  parentX: number,
  parentY: number,
  cx: number,
  cy: number,
  baseR: number,
  out: PlacedPre[],
): void {
  const myAngle = (angleStart + angleEnd) / 2;
  const myRadius = baseR + node.depth * RING_GAP;
  const x = cx + myRadius * Math.cos(myAngle);
  const y = cy + myRadius * Math.sin(myAngle);
  out.push({
    point: node.point,
    depth: node.depth,
    x,
    y,
    parentX,
    parentY,
    outX: Math.cos(myAngle),
    outY: Math.sin(myAngle),
  });
  if (node.children.length === 0) return;
  const totalChildLeaves = node.children.reduce(
    (s, c) => s + leafCount(c),
    0,
  );
  let cursor = angleStart;
  for (const c of node.children) {
    const share = (leafCount(c) / totalChildLeaves) * (angleEnd - angleStart);
    placeNode(c, cursor, cursor + share, x, y, cx, cy, baseR, out);
    cursor += share;
  }
}

function trimToward(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  trim: number,
): [number, number] {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy);
  if (len === 0) return [fromX, fromY];
  return [fromX + (dx / len) * trim, fromY + (dy / len) * trim];
}

// ---------------------------------------------------------------------------
// Subcomponents

function VertexDot({
  cx,
  cy,
  point,
  labelDx,
  labelDy,
  onClick,
}: {
  cx: number;
  cy: number;
  point: PointJSON;
  labelDx: number;
  labelDy: number;
  onClick?: (p: PointJSON) => void;
}) {
  const fill = degreeColor(point.degree);
  // Show an inline LaTeX label only for kinds whose value is shown inline
  // (rationals and small radicals). Algebraic points have no compact label
  // — the user reveals them by clicking.
  const showLabel = point.kind !== "algebraic" && point.latex;
  const html = showLabel
    ? katex.renderToString(point.latex, { throwOnError: false, output: "html" })
    : "";
  return (
    <g
      className="vertex"
      onClick={onClick ? () => onClick(point) : undefined}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <circle cx={cx} cy={cy} r={VERTEX_R} fill={fill}>
        <title>{tooltipFor(point)}</title>
      </circle>
      {showLabel && (
        <foreignObject
          x={cx + labelDx - 50}
          y={cy + labelDy - 8}
          width={100}
          height={24}
        >
          <div
            style={{
              textAlign: "center",
              fontSize: VERTEX_LABEL_FONT,
              lineHeight: 1.1,
              pointerEvents: "none",
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </foreignObject>
      )}
    </g>
  );
}

function PreDot({
  cx,
  cy,
  point,
  outX,
  outY,
  onClick,
}: {
  cx: number;
  cy: number;
  point: PointJSON;
  outX: number;
  outY: number;
  onClick?: (p: PointJSON) => void;
}) {
  const stroke = degreeColor(point.degree);
  const showLabel = point.kind !== "algebraic" && point.latex;
  const html = showLabel
    ? katex.renderToString(point.latex, { throwOnError: false, output: "html" })
    : "";
  const lx = cx + outX * 13;
  const ly = cy + outY * 13;
  return (
    <g
      className="vertex"
      onClick={onClick ? () => onClick(point) : undefined}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <circle
        cx={cx}
        cy={cy}
        r={PRE_R}
        fill="white"
        stroke={stroke}
        strokeWidth={1.5}
      >
        <title>{tooltipFor(point)}</title>
      </circle>
      {showLabel && (
        <foreignObject x={lx - 40} y={ly - 8} width={80} height={20}>
          <div
            style={{
              textAlign: "center",
              fontSize: PRE_LABEL_FONT,
              lineHeight: 1.1,
              color: "#555",
              pointerEvents: "none",
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </foreignObject>
      )}
    </g>
  );
}

function tooltipFor(point: PointJSON): string {
  const kind =
    point.degree === 1
      ? "rational"
      : point.degree === 2
        ? "quadratic"
        : `degree ${point.degree}`;
  return `${kind}: ${point.short_decimal} (click to see value)`;
}

function SelfLoop({ cx, cy }: { cx: number; cy: number }) {
  // small loop on the LEFT of the dot (preimages spread to the right)
  const lr = 11;
  const sx = cx - VERTEX_R;
  const sy = cy - 1;
  const ex = cx - VERTEX_R;
  const ey = cy + 1;
  const d = `M ${sx} ${sy} A ${lr} ${lr} 0 1 0 ${ex} ${ey}`;
  return (
    <path
      d={d}
      fill="none"
      stroke={EDGE_COLOR}
      strokeWidth={1.2}
      markerEnd="url(#cg-edge-arrow)"
    />
  );
}

function TwoCycleArcs({
  ax,
  ay,
  bx,
  by,
  cx,
  cy,
}: {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  cx: number;
  cy: number;
}) {
  const r = Math.hypot(bx - cx, by - cy);
  const bulge = r * 0.55;
  const trim = VERTEX_R + 2;
  return (
    <>
      <path
        d={`M ${ax} ${ay + trim} Q ${cx + bulge} ${cy} ${bx} ${by - trim}`}
        fill="none"
        stroke={EDGE_COLOR}
        strokeWidth={1.3}
        markerEnd="url(#cg-edge-arrow)"
      />
      <path
        d={`M ${bx} ${by - trim} Q ${cx - bulge} ${cy} ${ax} ${ay + trim}`}
        fill="none"
        stroke={EDGE_COLOR}
        strokeWidth={1.3}
        markerEnd="url(#cg-edge-arrow)"
      />
    </>
  );
}
