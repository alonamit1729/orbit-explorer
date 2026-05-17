"""Find genuine n-cycles of a polynomial f via primitive-period factoring.

Strategy
--------
Periodic points of exact period n are real roots of the *primitive-period*
polynomial

    Phi_n(x) = (f^n(x) - x) with all proper-divisor period roots removed.

We compute this iteratively: starting from ``g = f^n(x) - x``, for each proper
divisor ``d`` of ``n`` we strip its period-d roots via ``g <- g // gcd(g, f^d(x)-x)``.
The remaining polynomial has only period-exactly-n real roots; we then take
its real roots and partition them into cycles by applying f.

Cycle grouping uses **high-precision numerical matching** (default 50 digits).
SymPy's ``real_roots`` returns roots that are isolated in the real line, so
numerical comparison with a generous tolerance is both fast and reliable.
We never call ``sp.simplify`` on iterated CRootOf expressions — that path is
catastrophically slow.
"""

from __future__ import annotations

from dataclasses import dataclass

import sympy as sp

from .algebraic import Point, classify

NUMERIC_DIGITS = 30                  # enough to disambiguate roots; cheaper than 50
MATCH_TOLERANCE = sp.Float(10) ** -20  # very loose vs digits used


@dataclass
class Cycle:
    period: int
    points: list[Point]              # in orbit order: f(points[i]) == points[(i+1) % period]


@dataclass
class PeriodResult:
    n: int
    cycles: list[Cycle]
    exists: bool
    proven: bool                     # True if we factored Phi_n exactly


# ---------------------------------------------------------------------------
# Composition of f


def compose_iter(f_expr: sp.Expr, n: int, x: sp.Symbol) -> sp.Expr:
    """Return f^n(x) = f(f(...f(x)...)) as an expanded polynomial expression."""
    if n < 0:
        raise ValueError("n must be >= 0")
    if n == 0:
        return x
    result = f_expr
    for _ in range(n - 1):
        result = f_expr.subs(x, result)
    return sp.expand(result)


# ---------------------------------------------------------------------------
# Primitive-period polynomial


def proper_divisors(n: int) -> list[int]:
    return [d for d in range(1, n) if n % d == 0]


def primitive_period_poly(f_expr: sp.Expr, n: int, x: sp.Symbol) -> sp.Poly:
    """Return a SymPy Poly whose real roots are exactly the period-n points of f."""
    g = sp.Poly(compose_iter(f_expr, n, x) - x, x, domain=sp.QQ)
    for d in proper_divisors(n):
        gd = sp.Poly(compose_iter(f_expr, d, x) - x, x, domain=sp.QQ)
        common = sp.gcd(g, gd)
        if common.degree() > 0:
            g = sp.quo(g, common)
    return g


# ---------------------------------------------------------------------------
# Real roots → cycles


def find_cycles_for_period(
    f_expr: sp.Expr, n: int, x: sp.Symbol
) -> PeriodResult:
    """All period-exactly-n cycles of f over R."""
    phi = primitive_period_poly(f_expr, n, x)
    if phi.degree() <= 0:
        return PeriodResult(n=n, cycles=[], exists=False, proven=True)

    roots = phi.real_roots()
    # Dedupe by numerical value (in case of duplicates from messy polynomials).
    pool: list[tuple[sp.Expr, sp.Float, Point]] = []
    seen_numeric: list[sp.Float] = []
    for r in roots:
        val = sp.N(r, NUMERIC_DIGITS)
        if any(abs(val - v) < MATCH_TOLERANCE for v in seen_numeric):
            continue
        seen_numeric.append(val)
        pool.append((r, val, classify(r, x)))

    cycles = _group_into_cycles(pool, f_expr, x, n)
    return PeriodResult(n=n, cycles=cycles, exists=len(cycles) > 0, proven=True)


def _group_into_cycles(
    pool: list[tuple[sp.Expr, sp.Float, Point]],
    f_expr: sp.Expr,
    x: sp.Symbol,
    n: int,
) -> list[Cycle]:
    """Partition `pool` into orbits under f using high-precision numerical matching."""
    remaining = list(pool)
    cycles: list[Cycle] = []

    while remaining:
        start_expr, start_val, start_pt = remaining.pop(0)
        orbit_pts: list[Point] = [start_pt]
        current_expr = start_expr
        ok = True

        current_val = start_val
        for _ in range(n - 1):
            # Apply f to the cached numerical value; this avoids ever
            # re-evaluating a CRootOf at high precision inside the loop.
            image_val = sp.N(f_expr.subs(x, current_val), NUMERIC_DIGITS)
            idx = _find_index_by_value(image_val, remaining)
            if idx is None:
                ok = False
                break
            _, matched_val, matched_pt = remaining.pop(idx)
            orbit_pts.append(matched_pt)
            current_val = matched_val

        if ok and len(orbit_pts) == n:
            cycles.append(Cycle(period=n, points=orbit_pts))

    return cycles


def _find_index_by_value(
    target_val: sp.Float,
    items: list[tuple[sp.Expr, sp.Float, Point]],
) -> int | None:
    for i, (_, val, _) in enumerate(items):
        if abs(val - target_val) < MATCH_TOLERANCE:
            return i
    return None


# ---------------------------------------------------------------------------
# Sweep across periods


def sweep_periods(
    f_expr: sp.Expr, x: sp.Symbol, max_period: int
) -> dict[int, PeriodResult]:
    """Compute cycles of all periods 1..max_period."""
    return {
        n: find_cycles_for_period(f_expr, n, x)
        for n in range(1, max_period + 1)
    }
