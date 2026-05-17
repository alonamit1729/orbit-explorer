import { Tex } from "../math/Tex";
import type { NamedPointJSON } from "../types";

export function LegendPanel({ named }: { named: NamedPointJSON[] }) {
  if (!named.length) return null;
  return (
    <div className="legend">
      <h2>Algebraic points</h2>
      {named.map((n) => {
        const { point } = n;
        const interval = point.isolating_interval;
        return (
          <div className="legend-entry" key={n.label}>
            <span className="legend-label">{n.label}</span>
            {point.min_poly_latex && (
              <>
                root of <Tex math={`${point.min_poly_latex} = 0`} />
                {interval && (
                  <>
                    {" "}
                    in <Tex math={`(${interval[0]},\\, ${interval[1]})`} />
                  </>
                )}
              </>
            )}
            <div className="legend-detail">≈ {point.decimal}</div>
          </div>
        );
      })}
    </div>
  );
}
