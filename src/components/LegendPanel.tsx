import { useState } from "react";
import { Tex } from "../math/Tex";
import type { NamedPointJSON } from "../types";

export function LegendPanel({ named }: { named: NamedPointJSON[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!named.length) return null;

  const current = expanded
    ? named.find((n) => n.label === expanded) ?? null
    : null;

  return (
    <div className="legend">
      <h2>
        Algebraic points <span className="legend-count">({named.length})</span>
      </h2>
      <div className="legend-chips">
        {named.map((n) => {
          const isActive = expanded === n.label;
          return (
            <button
              key={n.label}
              type="button"
              className={`legend-chip${isActive ? " active" : ""}`}
              onClick={() =>
                setExpanded((prev) => (prev === n.label ? null : n.label))
              }
              title={n.point.short_decimal}
            >
              {n.label}
            </button>
          );
        })}
      </div>
      {current && (
        <div className="legend-detail-panel">
          <div className="legend-detail-head">
            <span className="legend-label-big">{current.label}</span>{" "}
            {current.point.min_poly_latex ? (
              <span>
                root of <Tex math={`${current.point.min_poly_latex} = 0`} />
                {current.point.isolating_interval && (
                  <>
                    {" "}
                    in{" "}
                    <Tex
                      math={`(${current.point.isolating_interval[0]},\\, ${current.point.isolating_interval[1]})`}
                    />
                  </>
                )}
              </span>
            ) : (
              <Tex math={current.point.latex} />
            )}
          </div>
          <div className="legend-detail">≈ {current.point.decimal}</div>
        </div>
      )}
    </div>
  );
}
