export type PointKind = "rational" | "radical" | "algebraic";

export interface PointJSON {
  kind: PointKind;
  latex: string;
  decimal: string;
  short_decimal: string;
  label?: string | null;
  min_poly_latex?: string | null;
  isolating_interval?: [string, string] | null;
}

export interface PreimageNodeJSON {
  point: PointJSON;
  depth: number;
  children: PreimageNodeJSON[];
  leaf_status: "terminal" | "continues" | null;
}

export interface PreperiodicTreeJSON {
  cycle_point_index: number;
  roots: PreimageNodeJSON[];
}

export interface CycleJSON {
  period: number;
  points: PointJSON[];
  preperiodic_trees: PreperiodicTreeJSON[];
}

export interface PeriodSummaryJSON {
  period: number;
  cycles: CycleJSON[];
}

export interface SharkovskyJSON {
  found: number[];
  proven_absent: number[];
  implied_but_not_found: number[];
  dominant: number | null;
  note: string;
}

export interface NamedPointJSON {
  label: string;
  point: PointJSON;
}

export interface AnalyzeResponse {
  polynomial_latex: string;
  config: { max_period: number; preperiodic_depth: number };
  periods: PeriodSummaryJSON[];
  sharkovsky: SharkovskyJSON;
  named_points: NamedPointJSON[];
}

export interface AnalyzeRequest {
  polynomial: string;
  max_period: number;
  preperiodic_depth: number;
}
