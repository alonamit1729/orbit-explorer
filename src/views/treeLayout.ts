/**
 * Tidy-tree layout for pre-periodic subtrees.
 *
 * Given a forest of pre-image trees rooted at a single cycle point, produce
 * per-node positions such that:
 *
 *   - no edge crosses another (the layout is planar by construction);
 *   - each parent is centered horizontally over its children;
 *   - each depth occupies its own row;
 *   - the total width of the forest is the sum of leaf widths (leaves get a
 *     fixed slot of ``LEAF_WIDTH``).
 *
 * This is a simplified Reingold-Tilford layout: it ignores subtree
 * re-balancing, which is fine for our small fanouts (≤ degree(f)) and shallow
 * depths (≤ 10).
 */

import type { PreimageNodeJSON } from "../types";

export const LEAF_WIDTH = 60;

export interface LayoutNode {
  point: PreimageNodeJSON["point"];
  depth: number;
  leafStatus: PreimageNodeJSON["leaf_status"];
  children: LayoutNode[];
  /** local x in subtree coordinates (origin at leftEdge=0); meaningful after assignX */
  x: number;
  /** subtree width — set by measureWidth */
  width: number;
}

function fromJSON(node: PreimageNodeJSON): LayoutNode {
  return {
    point: node.point,
    depth: node.depth,
    leafStatus: node.leaf_status,
    children: node.children.map(fromJSON),
    x: 0,
    width: 0,
  };
}

function measureWidth(node: LayoutNode): number {
  if (node.children.length === 0) {
    node.width = LEAF_WIDTH;
    return LEAF_WIDTH;
  }
  const childTotal = node.children.reduce((s, c) => s + measureWidth(c), 0);
  node.width = Math.max(LEAF_WIDTH, childTotal);
  return node.width;
}

function assignX(node: LayoutNode, leftEdge: number): void {
  if (node.children.length === 0) {
    node.x = leftEdge + node.width / 2;
    return;
  }
  let cursor = leftEdge;
  for (const c of node.children) {
    assignX(c, cursor);
    cursor += c.width;
  }
  const firstX = node.children[0].x;
  const lastX = node.children[node.children.length - 1].x;
  node.x = (firstX + lastX) / 2;
}

export interface CycleSubtreeLayout {
  /** Depth-1 preimages of a single cycle point, with positions assigned. */
  roots: LayoutNode[];
  /** Total horizontal width of the subtree in local coordinates. */
  width: number;
  /** Max depth reached (0 if there are no preimages). */
  maxDepth: number;
}

export function layoutCycleSubtree(
  rootsJson: PreimageNodeJSON[],
): CycleSubtreeLayout {
  const roots = rootsJson.map(fromJSON);
  if (roots.length === 0) return { roots: [], width: 0, maxDepth: 0 };

  let cursor = 0;
  let maxDepth = 0;
  for (const r of roots) {
    measureWidth(r);
    assignX(r, cursor);
    cursor += r.width;
    walk(r, (n) => {
      if (n.depth > maxDepth) maxDepth = n.depth;
    });
  }
  return { roots, width: cursor, maxDepth };
}

export function walk(node: LayoutNode, fn: (n: LayoutNode) => void): void {
  fn(node);
  for (const c of node.children) walk(c, fn);
}

/** Count leaves in a tree (excluding only the strictly-tree-leaf nodes). */
export function leafCount(node: PreimageNodeJSON): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce((s, c) => s + leafCount(c), 0);
}

/** Sum leaf counts across an array of trees. */
export function totalLeaves(roots: PreimageNodeJSON[]): number {
  if (roots.length === 0) return 0;
  return roots.reduce((s, r) => s + leafCount(r), 0);
}
