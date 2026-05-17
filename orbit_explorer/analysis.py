"""Top-level orchestration: parse + sweep + preperiodic + naming + sharkovsky.

Pure-Python pipeline returning plain dataclasses; the FastAPI layer converts
to JSON.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import sympy as sp

from .algebraic import Point
from .cycles import Cycle, sweep_periods
from .naming import NamedAlgebraic, assign_names
from .parse import ParsedPolynomial, parse_polynomial
from .preperiodic import PreperiodicTree, build_preperiodic
from .sharkovsky import SharkovskyReport, build_report


@dataclass
class AnalysisConfig:
    max_period: int = 6
    preperiodic_depth: int = 3


@dataclass
class CycleAnalysis:
    period: int
    cycles: list[Cycle]
    preperiodic_trees: list[list[PreperiodicTree]]  # per cycle in `cycles`


@dataclass
class AnalysisResult:
    parsed: ParsedPolynomial
    config: AnalysisConfig
    per_period: list[CycleAnalysis]
    sharkovsky: SharkovskyReport
    named_points: list[NamedAlgebraic]


def analyze(text: str, config: AnalysisConfig | None = None) -> AnalysisResult:
    config = config or AnalysisConfig()
    parsed = parse_polynomial(text)
    return analyze_parsed(parsed, config)


def analyze_parsed(
    parsed: ParsedPolynomial, config: AnalysisConfig
) -> AnalysisResult:
    f_expr = parsed.expr
    x = parsed.x

    # Sweep periods 1..max_period
    sweep = sweep_periods(f_expr, x, config.max_period)
    period_exists = {n: r.exists for n, r in sweep.items()}

    # Build preperiodic trees for each cycle.
    per_period: list[CycleAnalysis] = []
    cycles_by_period: dict[int, list[Cycle]] = {}
    trees_by_cycle_id: dict[int, list[PreperiodicTree]] = {}

    cycle_counter = 0
    for n in sorted(sweep.keys()):
        result = sweep[n]
        cycles_by_period[n] = result.cycles
        cycle_trees: list[list[PreperiodicTree]] = []
        for cyc in result.cycles:
            trees = build_preperiodic(f_expr, x, cyc, config.preperiodic_depth)
            cycle_trees.append(trees)
            trees_by_cycle_id[cycle_counter] = trees
            cycle_counter += 1
        per_period.append(
            CycleAnalysis(period=n, cycles=result.cycles, preperiodic_trees=cycle_trees)
        )

    # Assign names to algebraic points across all cycles and trees.
    named = assign_names(cycles_by_period, trees_by_cycle_id)

    # Sharkovsky report.
    report = build_report(period_exists, config.max_period)

    return AnalysisResult(
        parsed=parsed,
        config=config,
        per_period=per_period,
        sharkovsky=report,
        named_points=named,
    )
