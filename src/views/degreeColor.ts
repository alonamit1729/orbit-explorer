/**
 * Map the degree of an algebraic number's minimal polynomial to a vertex
 * colour. The palette is shared across all cycle/preimage views so that
 * "blue dot" means "rational" everywhere, "green dot" means "quadratic
 * irrational" everywhere, etc.
 */

const DEGREE_PALETTE: Record<number, string> = {
  1: "#2a5d9f", // blue        — rational
  2: "#208a47", // green       — quadratic irrational
  3: "#c8742a", // orange      — cubic
  4: "#c2398a", // magenta     — quartic
  5: "#7a3aa8", // violet      — quintic
  6: "#1d8a8a", // teal        — sextic
  7: "#b53737", // red         — septic
  8: "#5d7029", // olive
};

const FALLBACK = "#444";

export function degreeColor(degree: number): string {
  return DEGREE_PALETTE[degree] ?? FALLBACK;
}

/** Stable, ordered list of (degree, color) pairs for the legend UI. */
export function degreeColorEntries(): Array<{ degree: number; color: string; label: string }> {
  return [
    { degree: 1, color: DEGREE_PALETTE[1], label: "rational" },
    { degree: 2, color: DEGREE_PALETTE[2], label: "quadratic irrational" },
    { degree: 3, color: DEGREE_PALETTE[3], label: "degree 3" },
    { degree: 4, color: DEGREE_PALETTE[4], label: "degree 4" },
    { degree: 5, color: DEGREE_PALETTE[5], label: "degree 5" },
    { degree: 6, color: DEGREE_PALETTE[6], label: "degree 6" },
    { degree: 7, color: DEGREE_PALETTE[7], label: "degree 7" },
    { degree: 8, color: DEGREE_PALETTE[8], label: "degree 8" },
  ];
}

/** Constant grey used for cycle arrows + preimage tree edges. */
export const EDGE_COLOR = "#888";
