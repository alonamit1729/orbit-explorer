import { useEffect, useMemo, useState } from "react";
import { analyze } from "./api";
import { Tex } from "./math/Tex";
import { PolynomialInput } from "./components/PolynomialInput";
import { SharkovskyNote } from "./components/SharkovskyNote";
import { LegendPanel } from "./components/LegendPanel";
import { GraphCard } from "./components/GraphCard";
import { PointInfoModal } from "./components/PointInfoModal";
import { CycleGraphView } from "./views/CycleGraphView";
import { RealLineView } from "./views/RealLineView";
import type { AnalyzeResponse, PointJSON } from "./types";

function App() {
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPreperiodic, setShowPreperiodic] = useState(true);
  const [selectedPoint, setSelectedPoint] = useState<PointJSON | null>(null);

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

  // Collect which degrees actually appear so the legend can dim the rest.
  const degreesPresent = useMemo(() => {
    const s = new Set<number>();
    if (!data) return s;
    for (const per of data.periods) {
      for (const c of per.cycles) {
        for (const p of c.points) s.add(p.degree);
        for (const tree of c.preperiodic_trees) {
          walkPoints(tree.roots, (p) => s.add(p.degree));
        }
      }
    }
    return s;
  }, [data]);

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

      {data && (
        <div className="display-bar">
          <label className="display-toggle">
            <input
              type="checkbox"
              checked={showPreperiodic}
              onChange={(e) => setShowPreperiodic(e.target.checked)}
            />
            show pre-periodic points
          </label>
        </div>
      )}

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
                  Period {period.period}: {period.cycles.length}{" "}
                  {period.cycles.length === 1 ? "cycle" : "cycles"}
                </div>
                {period.cycles.map((cycle, i) => (
                  <div
                    key={i}
                    className={`cycle-row${
                      showPreperiodic ? " stacked" : ""
                    }`}
                  >
                    <div className="cycle-graph-pane">
                      <GraphCard
                        title="cycle graph"
                        zoomed={
                          <CycleGraphView
                            cycle={cycle}
                            showPreperiodic={showPreperiodic}
                            onPointClick={setSelectedPoint}
                          />
                        }
                      >
                        <CycleGraphView
                          cycle={cycle}
                          showPreperiodic={showPreperiodic}
                          onPointClick={setSelectedPoint}
                        />
                      </GraphCard>
                    </div>
                    <div className="realline-pane">
                      <GraphCard title="on the real line">
                        <RealLineView
                          cycle={cycle}
                          showPreperiodic={showPreperiodic}
                          onPointClick={setSelectedPoint}
                        />
                      </GraphCard>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          <LegendPanel degreesPresent={degreesPresent} />
        </>
      )}

      {selectedPoint && (
        <PointInfoModal
          point={selectedPoint}
          onClose={() => setSelectedPoint(null)}
        />
      )}
    </div>
  );
}

function walkPoints(
  nodes: { point: PointJSON; children: { point: PointJSON; children: unknown[] }[] }[],
  fn: (p: PointJSON) => void,
): void {
  for (const n of nodes) {
    fn(n.point);
    if (n.children && n.children.length) {
      walkPoints(
        n.children as unknown as Parameters<typeof walkPoints>[0],
        fn,
      );
    }
  }
}

export default App;
