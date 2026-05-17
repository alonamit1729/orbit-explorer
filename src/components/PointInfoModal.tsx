import { useEffect } from "react";
import { Tex } from "../math/Tex";
import { degreeColor } from "../views/degreeColor";
import type { PointJSON } from "../types";

interface Props {
  point: PointJSON;
  onClose: () => void;
}

/**
 * Modal that opens when the user clicks any vertex in a cycle/real-line view.
 * Shows the value: rational fraction, radical formula, or
 * "root of <minimal polynomial> in (a, b)" for an algebraic point with no
 * closed-form expression.
 */
export function PointInfoModal({ point, onClose }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const color = degreeColor(point.degree);
  const degreeLabel =
    point.degree === 1
      ? "rational"
      : point.degree === 2
        ? "quadratic irrational"
        : `algebraic, degree ${point.degree}`;

  return (
    <div className="zoom-modal-backdrop" onClick={onClose}>
      <div
        className="zoom-modal point-info-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="zoom-modal-header">
          <span className="zoom-modal-title">
            <span
              className="degree-dot"
              style={{ background: color }}
              aria-hidden="true"
            />
            {degreeLabel}
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            title="Close"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="point-info-body">
          {point.kind === "algebraic" ? (
            <>
              <div className="point-info-row">
                <span className="point-info-label">root of</span>{" "}
                <Tex math={`${point.min_poly_latex ?? ""} = 0`} />
              </div>
              {point.isolating_interval && (
                <div className="point-info-row">
                  <span className="point-info-label">in</span>{" "}
                  <Tex
                    math={`\\left(${point.isolating_interval[0]},\\, ${point.isolating_interval[1]}\\right)`}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="point-info-row">
              <span className="point-info-label">value</span>{" "}
              <Tex math={point.latex} block />
            </div>
          )}
          <div className="point-info-decimal">
            <span className="point-info-label">≈</span>{" "}
            <span className="point-info-decimal-text">{point.decimal}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
