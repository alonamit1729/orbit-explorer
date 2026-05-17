import katex from "katex";
import type { CycleJSON, PointJSON, PreimageNodeJSON } from "../types";
import { leafCount } from "./treeLayout";

interface Props {
  cycle: CycleJSON;
  color: string;
  size?: number;
  showPreperiodic: boolean;
}

const VERTEX_R = 5;
const PRE_R = 3.8;
const ARC_PAD_RAD = 0.10;
const RING_GAP = 24;             // radial spacing between preimage depth rings
const LABEL_PAD = 22;            // extra outside radius for labels

interface PlacedPre {
  point: PointJSON;
  depth: number;
  x: number;
  y: number;
  parentX: number;
  parentY: number;
  /** Outward radial direction (unit vector) — for label placement. */
  outX: number;
  outY: number;
}

export function CycleGraphView({
  cycle,
  color,
  size: baseSizeProp = 180,
  showPreperiodic,
}: Props) {
  const n = cycle.points.length;
  const baseSize = baseSizeProp;
  const baseR = baseSize / 2 - 26;

  // Compute max preimage depth (only if we're going to render preimages).
  const maxDepth = showPreperiodic
    ? cycle.preperiodic_trees.reduce(
        (d, t) => Math.max(d, maxTreeDepth(t.roots)),
        0,
      )
    : 0;

  const outerR = baseR + maxDepth * RING_GAP + LABEL_PAD;
  const size = Math.max(baseSize, 2 * outerR + 20);
  const cx = size / 2;
  const cy = size / 2;
  const r = baseR;

  const colorId = color.replace("#", "");
  const markerId = `cycle-arrow-${colorId}`;
  const markerPre = `pre-arrow-${colorId}`;

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
  const preMarker = (
    <marker
      id={markerPre}
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="4.5"
      markerHeight="4.5"
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#7a7a7a" />
    </marker>
  );

  // Vertex positions for n >= 1.
  const positions = cycle.points.map((_, i) => {
    if (n === 1) {
      return { x: cx, y: cy, theta: 0 };
    }
    const theta = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return {
      x: cx + r * Math.cos(theta),
      y: cy + r * Math.sin(theta),
      theta,
    };
  });

  // Build the radial preimage layout per cycle vertex.
  const placed: PlacedPre[] = [];
  if (showPreperiodic) {
    const wedgeWidth = n === 1 ? 2 * Math.PI : (2 * Math.PI) / n;
    for (let i = 0; i < n; i++) {
      const tree = cycle.preperiodic_trees.find(
        (t) => t.cycle_point_index === i,
      );
      if (!tree || tree.roots.length === 0) continue;
      const center = positions[i].theta;
      const wedgeStart = center - wedgeWidth / 2;
      const wedgeEnd = center + wedgeWidth / 2;
      placeWedge(
        tree.roots,
        wedgeStart,
        wedgeEnd,
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
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      <defs>
        {arrowMarker}
        {preMarker}
      </defs>

      {n === 1 && (
        <SelfLoop cx={cx} cy={cy} color={color} markerId={markerId} />
      )}

      {n === 2 && (
        <TwoCycleArcs
          ax={positions[0].x}
          ay={positions[0].y}
          bx={positions[1].x}
          by={positions[1].y}
          cx={cx}
          cy={cy}
          color={color}
          markerId={markerId}
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
              stroke={color}
              strokeWidth={1.3}
              markerEnd={`url(#${markerId})`}
            />
          );
        })}

      {/* preimage tree edges (child -> parent, the f-image direction) */}
      {placed.map((m, i) => (
        <line
          key={`pre-edge-${i}`}
          x1={trimToward(m.x, m.y, m.parentX, m.parentY, PRE_R)[0]}
          y1={trimToward(m.x, m.y, m.parentX, m.parentY, PRE_R)[1]}
          x2={trimToward(m.parentX, m.parentY, m.x, m.y, VERTEX_R + 1)[0]}
          y2={trimToward(m.parentX, m.parentY, m.x, m.y, VERTEX_R + 1)[1]}
          stroke="#7a7a7a"
          strokeWidth={0.9}
          opacity={0.7}
          markerEnd={`url(#${markerPre})`}
        />
      ))}

      {/* preimage dots + labels */}
      {placed.map((m, i) => (
        <PreDot
          key={`pre-${i}`}
          cx={m.x}
          cy={m.y}
          point={m.point}
          color={color}
          outX={m.outX}
          outY={m.outY}
        />
      ))}

      {/* cycle vertices on top.  When pre-images are shown for n >= 3 we
         tuck the vertex label inside the cycle (toward the empty center)
         so it doesn't sit on top of the depth-1 preimage in the same
         radial direction.  For n <= 2 there's no preimage in line with
         the vertex label, so the usual outward placement is fine. */}
      {positions.map((p, i) => {
        const out = n === 1 ? 0 : Math.cos(p.theta);
        const above = n === 1 ? 1 : Math.sin(p.theta);
        const labelInside = showPreperiodic && n >= 3;
        const rad = labelInside ? -16 : 18;
        const labelDx = out * rad;
        const labelDy = above * rad + (labelInside ? -2 : 4);
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
    placeNode(
      c,
      cursor,
      cursor + share,
      x,
      y,
      cx,
      cy,
      baseR,
      out,
    );
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

function PreDot({
  cx,
  cy,
  point,
  color,
  outX,
  outY,
}: {
  cx: number;
  cy: number;
  point: PointJSON;
  color: string;
  outX: number;
  outY: number;
}) {
  const labelText =
    point.kind === "algebraic" && point.label ? point.label : point.latex;
  const html = katex.renderToString(labelText, {
    throwOnError: false,
    output: "html",
  });
  const lx = cx + outX * 13;
  const ly = cy + outY * 13;
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={PRE_R}
        fill="white"
        stroke={color}
        strokeWidth={1.3}
      >
        <title>{`preimage @ depth ${(point as { depth?: number }).depth ?? ""}: ${point.decimal}`}</title>
      </circle>
      <foreignObject
        x={lx - 40}
        y={ly - 8}
        width={80}
        height={20}
      >
        <div
          style={{
            textAlign: "center",
            fontSize: 10,
            lineHeight: 1.1,
            color: "#555",
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
  // For n=1, the radial preimage layout places depth-1 preimages at theta=0
  // (directly to the right) and deeper ones above/below. The self-loop
  // therefore sits on the LEFT, where there's no preimage edge to cross.
  // Small radius so the loop stays compact and doesn't overlap the dot.
  const lr = 11;
  const sx = cx - VERTEX_R;
  const sy = cy - 1;
  const ex = cx - VERTEX_R;
  const ey = cy + 1;
  // sweep-flag = 0 with large-arc-flag = 1 sends the long arc the LEFT way
  // (counter-clockwise) around a center sitting to the left of the dot.
  const d = `M ${sx} ${sy} A ${lr} ${lr} 0 1 0 ${ex} ${ey}`;
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

function TwoCycleArcs({
  ax,
  ay,
  bx,
  by,
  cx,
  cy,
  color,
  markerId,
}: {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  cx: number;
  cy: number;
  color: string;
  markerId: string;
}) {
  const r = Math.hypot(bx - cx, by - cy); // == chord/2 since opposing vertices
  const bulge = r * 0.55;
  const trim = VERTEX_R + 2;
  return (
    <>
      <path
        d={`M ${ax} ${ay + trim} Q ${cx + bulge} ${cy} ${bx} ${by - trim}`}
        fill="none"
        stroke={color}
        strokeWidth={1.3}
        markerEnd={`url(#${markerId})`}
      />
      <path
        d={`M ${bx} ${by - trim} Q ${cx - bulge} ${cy} ${ax} ${ay + trim}`}
        fill="none"
        stroke={color}
        strokeWidth={1.3}
        markerEnd={`url(#${markerId})`}
      />
    </>
  );
}
