import { Tex } from "../math/Tex";
import type { PointJSON } from "../types";

interface PointLabelProps {
  point: PointJSON;
  showDecimal?: boolean;
}

export function PointLabel({ point, showDecimal = false }: PointLabelProps) {
  // For algebraic points, latex == label. For others, latex is the inline expression.
  return (
    <span className="point-label" title={point.decimal}>
      <Tex math={point.latex} />
      {showDecimal && point.kind !== "rational" && (
        <span className="decimal">≈ {point.short_decimal}</span>
      )}
    </span>
  );
}
