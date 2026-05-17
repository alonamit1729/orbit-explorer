import { useEffect, useState } from "react";
import { analyze } from "./api";
import { Tex } from "./math/Tex";
import { PolynomialInput } from "./components/PolynomialInput";
import { SharkovskyNote } from "./components/SharkovskyNote";
import { LegendPanel } from "./components/LegendPanel";
import { CycleGraphView } from "./views/CycleGraphView";
import { RealLineView } from "./views/RealLineView";
import type { AnalyzeResponse } from "./types";

// Stable per-period color palette so cycles are visually distinguishable.
const CYCLE_COLORS = [
  "#2a5d9f", // blue
  "#b53737", // red
  "#208a47", // green
  "#9f6f2a", // amber
  "#7a3aa8", // purple
  "#1d8a8a", // teal
  "#c25c9a", // pink
  "#5d7029", // olive
];

function colorFor(globalIdx: number): string {
  return CYCLE_COLORS[globalIdx % CYCLE_COLORS.length];
}

function App() {
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Fire-and-forget warm-up on page load so the first analyze call doesn't
  // also pay the cold-start cost of the Python serverless function.
  useEffect(() => {
    fetch("/api/health").catch(() => {});
  }, []);

  async function run(polynomial: string, maxPeriod: number, depth: number) {
    setBusy(true);
    setError(null);
    try {
      const r = await analyze({
        polynomial,
        max_period: maxPeriod,
        preperiodic_depth: depth,
      });
      setData(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setBusy(false);
    }
  }

  let globalCycleIdx = 0;

  return (
    <div className="app">
      <h1>Orbit Explorer</h1>
      <div className="subtitle">
        Cycle structure of polynomials with rational coefficients on ℝ.
      </div>

      <PolynomialInput
        initial="x^2 - 29/16"
        maxPeriod={6}
        preperiodicDepth={3}
        busy={busy}
        onSubmit={run}
      />

      {error && <div className="error">{error}</div>}

      {!data && !busy && (
        <div className="empty">
          Enter a polynomial and click <em>analyze</em>. Try{" "}
          <code>x^2 - 29/16</code> for a 3-cycle, or <code>x^2</code> for two
          fixed points.
        </div>
      )}

      {busy && <div className="loading">Computing cycles…</div>}

      {data && (
        <>
          <div style={{ marginBottom: 12, fontSize: 16 }}>
            <strong>f(x) =</strong> <Tex math={data.polynomial_latex} />
          </div>
          <SharkovskyNote data={data.sharkovsky} />

          {data.periods.map((period) => {
            if (!period.cycles.length) return null;
            return (
              <div key={period.period} className="period-block">
                <div className="period-header">
                  Period {period.period} — {period.cycles.length}{" "}
                  {period.cycles.length === 1 ? "cycle" : "cycles"}
                </div>
                {period.cycles.map((cycle, i) => {
                  const color = colorFor(globalCycleIdx++);
                  return (
                    <div key={i} className="cycle-row">
                      <div>
                        <div className="cycle-meta">cycle graph</div>
                        <CycleGraphView cycle={cycle} color={color} />
                      </div>
                      <div>
                        <div className="cycle-meta">on the real line</div>
                        <RealLineView cycle={cycle} color={color} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          <LegendPanel named={data.named_points} />
        </>
      )}
    </div>
  );
}

export default App;
