"""FastAPI app exposing /api/analyze.

All routes are prefixed with /api/ so the same paths work locally (Vite
dev-server proxy) and on Vercel (where the platform routes /api/* to this
function). The frontend POSTs a polynomial string and optional config and
gets back a JSON document describing all cycles, pre-periodic trees, named
algebraic points, and the Sharkovsky report.
"""

from __future__ import annotations

from typing import Any, Literal

import sympy as sp
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .algebraic import AlgebraicPoint, Point, RadicalPoint, RationalPoint
from .analysis import AnalysisConfig, AnalysisResult, analyze
from .cycles import Cycle
from .preperiodic import PreimageNode, PreperiodicTree

app = FastAPI(title="Orbit Explorer", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / response models


class AnalyzeRequest(BaseModel):
    polynomial: str = Field(..., description="e.g. 'x^2 - 29/16'")
    max_period: int = Field(6, ge=1, le=12)
    preperiodic_depth: int = Field(3, ge=0, le=10)


class PointJSON(BaseModel):
    kind: Literal["rational", "radical", "algebraic"]
    latex: str
    decimal: str
    short_decimal: str
    label: str | None = None
    min_poly_latex: str | None = None
    isolating_interval: tuple[str, str] | None = None


class PreimageNodeJSON(BaseModel):
    point: PointJSON
    depth: int
    children: list["PreimageNodeJSON"] = Field(default_factory=list)
    leaf_status: str | None = None


PreimageNodeJSON.model_rebuild()


class PreperiodicTreeJSON(BaseModel):
    cycle_point_index: int
    roots: list[PreimageNodeJSON]


class CycleJSON(BaseModel):
    period: int
    points: list[PointJSON]
    preperiodic_trees: list[PreperiodicTreeJSON]


class PeriodSummaryJSON(BaseModel):
    period: int
    cycles: list[CycleJSON]


class SharkovskyJSON(BaseModel):
    found: list[int]
    proven_absent: list[int]
    implied_but_not_found: list[int]
    dominant: int | None
    note: str


class NamedPointJSON(BaseModel):
    label: str
    point: PointJSON


class AnalyzeResponse(BaseModel):
    polynomial_latex: str
    config: dict[str, int]
    periods: list[PeriodSummaryJSON]
    sharkovsky: SharkovskyJSON
    named_points: list[NamedPointJSON]


# ---------------------------------------------------------------------------
# Serialization


def point_to_json(p: Point) -> PointJSON:
    if isinstance(p, RationalPoint):
        return PointJSON(
            kind="rational",
            latex=p.latex,
            decimal=p.decimal,
            short_decimal=p.decimal,
        )
    if isinstance(p, RadicalPoint):
        return PointJSON(
            kind="radical",
            latex=p.latex,
            decimal=p.decimal,
            short_decimal=p.decimal,
        )
    # AlgebraicPoint
    a, b = p.isolating_interval
    return PointJSON(
        kind="algebraic",
        latex=p.label or "?",
        decimal=p.decimal,
        short_decimal=p.short_decimal,
        label=p.label,
        min_poly_latex=p.min_poly_latex,
        isolating_interval=(str(a), str(b)),
    )


def node_to_json(n: PreimageNode) -> PreimageNodeJSON:
    return PreimageNodeJSON(
        point=point_to_json(n.point),
        depth=n.depth,
        children=[node_to_json(c) for c in n.children],
        leaf_status=n.leaf_status,
    )


def tree_to_json(t: PreperiodicTree) -> PreperiodicTreeJSON:
    return PreperiodicTreeJSON(
        cycle_point_index=t.cycle_point_index,
        roots=[node_to_json(r) for r in t.roots],
    )


def cycle_to_json(c: Cycle, trees: list[PreperiodicTree]) -> CycleJSON:
    return CycleJSON(
        period=c.period,
        points=[point_to_json(p) for p in c.points],
        preperiodic_trees=[tree_to_json(t) for t in trees],
    )


def result_to_json(r: AnalysisResult) -> AnalyzeResponse:
    poly_latex = sp.latex(r.parsed.expr)
    periods_out: list[PeriodSummaryJSON] = []
    for analysis in r.per_period:
        cycles_out = [
            cycle_to_json(c, trees)
            for c, trees in zip(analysis.cycles, analysis.preperiodic_trees)
        ]
        periods_out.append(PeriodSummaryJSON(period=analysis.period, cycles=cycles_out))

    return AnalyzeResponse(
        polynomial_latex=poly_latex,
        config={
            "max_period": r.config.max_period,
            "preperiodic_depth": r.config.preperiodic_depth,
        },
        periods=periods_out,
        sharkovsky=SharkovskyJSON(
            found=r.sharkovsky.found,
            proven_absent=r.sharkovsky.proven_absent,
            implied_but_not_found=r.sharkovsky.implied_but_not_found,
            dominant=r.sharkovsky.dominant,
            note=r.sharkovsky.note,
        ),
        named_points=[
            NamedPointJSON(label=n.label, point=point_to_json(n.point))
            for n in r.named_points
        ],
    )


# ---------------------------------------------------------------------------
# Routes


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze_endpoint(req: AnalyzeRequest) -> AnalyzeResponse:
    try:
        config = AnalysisConfig(
            max_period=req.max_period,
            preperiodic_depth=req.preperiodic_depth,
        )
        result = analyze(req.polynomial, config)
        return result_to_json(result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
