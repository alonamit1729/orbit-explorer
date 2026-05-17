import { degreeColorEntries } from "../views/degreeColor";

/**
 * Colour legend mapping vertex degree to colour. Replaces the old per-point
 * letter index — individual algebraic points are now revealed by clicking
 * a vertex (see ``PointInfoModal``).
 *
 * Only the degrees actually present in the response need to be highlighted;
 * we show them all in order for context.
 */
export function LegendPanel({
  degreesPresent,
}: {
  degreesPresent: Set<number>;
}) {
  const entries = degreeColorEntries().filter(
    (e) => degreesPresent.has(e.degree) || e.degree <= 3,
  );
  return (
    <div className="legend">
      <h2>Vertex colours</h2>
      <p className="legend-sub">
        Each dot is coloured by the degree of its minimal polynomial over ℚ.
        Click any vertex to see its value.
      </p>
      <div className="legend-color-grid">
        {entries.map((e) => {
          const dim = !degreesPresent.has(e.degree);
          return (
            <div
              key={e.degree}
              className={`legend-color-row${dim ? " dim" : ""}`}
            >
              <span
                className="degree-dot"
                style={{ background: e.color }}
                aria-hidden="true"
              />
              <span className="legend-color-label">{e.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
