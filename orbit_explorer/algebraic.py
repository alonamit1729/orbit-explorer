"""Point ADT for cycle elements.

A point comes in one of three flavors:

- ``RationalPoint``       — an exact element of Q (degree 1).
- ``RadicalPoint``        — a small symbolic expression (e.g. ``(1+sqrt(5))/2``)
                             whose rendered LaTeX fits the inline budget.
- ``AlgebraicPoint``      — an algebraic real specified by minimal polynomial
                             and isolating interval.

Every point carries a ``degree`` (the degree of its minimal polynomial over
Q) so the UI can colour the vertex by that degree:

    degree 1 → rational (blue)
    degree 2 → quadratic irrational (green)
    degree 3 → cubic (orange)
    ...

All three carry a high-precision decimal for downstream display. We use
mpmath via ``sympy.N`` for the numeric value.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional, Union

import sympy as sp

INLINE_LATEX_BUDGET = 40   # characters; longer expressions become AlgebraicPoint
NUMERIC_PRECISION = 50     # decimal digits for the high-precision display value
DISPLAY_DIGITS = 12        # short decimal shown alongside exact form
INTERVAL_MAX_HEIGHT = 100  # cap |num|, |den| of isolating-interval endpoints


@dataclass(frozen=True)
class RationalPoint:
    kind: Literal["rational"]
    value: sp.Rational
    latex: str
    decimal: str         # short, e.g. "1.25"
    degree: int = 1


@dataclass(frozen=True)
class RadicalPoint:
    kind: Literal["radical"]
    expr: sp.Expr
    latex: str
    decimal: str         # short
    degree: int = 2      # populated by classify; default for safety


@dataclass
class AlgebraicPoint:
    kind: Literal["algebraic"]
    # minimal polynomial coefficients, low → high degree, all rationals as (num, den)
    min_poly_coeffs: list[tuple[int, int]]
    min_poly_latex: str
    isolating_interval: tuple[sp.Rational, sp.Rational]
    decimal: str               # high precision
    short_decimal: str         # display
    degree: int = 2            # = len(min_poly_coeffs) - 1; set explicitly
    label: Optional[str] = None    # legacy (unused by UI but kept for naming pass)


Point = Union[RationalPoint, RadicalPoint, AlgebraicPoint]


# ---------------------------------------------------------------------------
# Construction


def classify(root: sp.Expr, x: sp.Symbol) -> Point:
    """Turn a SymPy real-root expression into one of the three Point kinds."""
    # Rational
    if isinstance(root, sp.Rational):
        return RationalPoint(
            kind="rational",
            value=root,
            latex=sp.latex(root),
            decimal=_short_decimal(root),
        )

    # CRootOf — algebraic real with isolating interval baked in.
    if isinstance(root, sp.RootOf) or isinstance(
        root, sp.polys.rootoftools.ComplexRootOf
    ):
        poly = root.poly
        coeffs = [_rational_to_pair(c) for c in reversed(poly.all_coeffs())]
        interval = root._get_interval()
        a, b = sp.Rational(interval.a), sp.Rational(interval.b)
        approx = sp.N(root, NUMERIC_PRECISION)
        small_a, small_b = _shrink_interval(poly, a, b, INTERVAL_MAX_HEIGHT)
        return AlgebraicPoint(
            kind="algebraic",
            min_poly_coeffs=coeffs,
            min_poly_latex=sp.latex(poly.as_expr()),
            isolating_interval=(small_a, small_b),
            decimal=str(approx),
            short_decimal=_short_decimal(approx),
            degree=poly.degree(),
        )

    # Closed-form symbolic expression. Try to keep it as a RadicalPoint when
    # the LaTeX is short; otherwise wrap as algebraic via minimal polynomial.
    simplified = sp.radsimp(sp.simplify(root))
    latex = sp.latex(simplified)
    try:
        min_poly = sp.minimal_polynomial(simplified, x, polys=True)
        degree = min_poly.degree()
    except Exception:
        min_poly = None
        degree = 2  # safe default
    if len(latex) <= INLINE_LATEX_BUDGET:
        return RadicalPoint(
            kind="radical",
            expr=simplified,
            latex=latex,
            decimal=_short_decimal(simplified),
            degree=degree,
        )

    # Too big to render inline — present as algebraic via the minimal polynomial.
    if min_poly is None:
        # Pathological — fall back to a very rough representation.
        approx = sp.N(simplified, NUMERIC_PRECISION)
        lo = sp.nsimplify(approx - sp.Rational(1, 100), rational=True)
        hi = sp.nsimplify(approx + sp.Rational(1, 100), rational=True)
        return AlgebraicPoint(
            kind="algebraic",
            min_poly_coeffs=[],
            min_poly_latex="",
            isolating_interval=(lo, hi),
            decimal=str(approx),
            short_decimal=_short_decimal(approx),
            degree=2,
        )
    coeffs = [_rational_to_pair(c) for c in reversed(min_poly.all_coeffs())]
    approx = sp.N(simplified, NUMERIC_PRECISION)
    approx_q = sp.nsimplify(approx, rational=True, tolerance=sp.Rational(1, 10**12))
    # Seed: a tight neighborhood around the numerical value, then shrink it.
    seed_lo = approx_q - sp.Rational(1, 10**6)
    seed_hi = approx_q + sp.Rational(1, 10**6)
    small_a, small_b = _shrink_interval(min_poly, seed_lo, seed_hi, INTERVAL_MAX_HEIGHT)
    return AlgebraicPoint(
        kind="algebraic",
        min_poly_coeffs=coeffs,
        min_poly_latex=sp.latex(min_poly.as_expr()),
        isolating_interval=(small_a, small_b),
        decimal=str(approx),
        short_decimal=_short_decimal(approx),
        degree=degree,
    )


# ---------------------------------------------------------------------------
# Helpers


def _short_decimal(value: sp.Expr) -> str:
    f = float(sp.N(value, DISPLAY_DIGITS + 2))
    return f"{f:.{DISPLAY_DIGITS}g}"


def _rational_to_pair(c: sp.Expr) -> tuple[int, int]:
    r = sp.Rational(c)
    return (int(r.p), int(r.q))


def numeric_value(point: Point) -> sp.Expr:
    """High-precision numeric value of a point (a SymPy Float)."""
    if isinstance(point, RationalPoint):
        return sp.N(point.value, NUMERIC_PRECISION)
    if isinstance(point, RadicalPoint):
        return sp.N(point.expr, NUMERIC_PRECISION)
    return sp.Float(point.decimal, NUMERIC_PRECISION)


def exact_value(point: Point) -> sp.Expr:
    """Return a SymPy expression that exactly equals the point (for substitution)."""
    if isinstance(point, RationalPoint):
        return point.value
    if isinstance(point, RadicalPoint):
        return point.expr
    raise NotImplementedError("exact_value on AlgebraicPoint requires a context object")


# ---------------------------------------------------------------------------
# Isolating-interval shrinking


def _shrink_interval(
    poly: sp.Poly,
    a0: sp.Rational,
    b0: sp.Rational,
    max_height: int,
) -> tuple[sp.Rational, sp.Rational]:
    """Find a low-height rational bracket [a, b] that still isolates the
    single root of ``poly`` originally inside ``[a0, b0]``.

    "Low height" means ``max(|p|, q) <= max_height`` for each endpoint.
    The returned bracket may be slightly wider than ``[a0, b0]`` but must
    still contain exactly one real root of ``poly``.
    """
    a0 = sp.Rational(a0)
    b0 = sp.Rational(b0)
    # Find the loosest "below" bracket: the largest rational ≤ a0 with low height.
    best_a = _best_below(a0, max_height)
    best_b = _best_above(b0, max_height)
    # Sanity / fallback: if the original is already lower-height than what we
    # found (unlikely but possible for tiny intervals), keep the original.
    if _height(best_a) > _height(a0):
        best_a = a0
    if _height(best_b) > _height(b0):
        best_b = b0
    # Verify that the new bracket still contains exactly one root.
    try:
        n_roots = poly.count_roots(best_a, best_b)
    except Exception:
        n_roots = -1
    if n_roots == 1:
        return (best_a, best_b)
    # Walked into another root — tighten by shrinking the bracket toward the
    # original. Try replacing one endpoint at a time.
    candidates = [
        (best_a, b0),
        (a0, best_b),
        (a0, b0),
    ]
    for a, b in candidates:
        try:
            if poly.count_roots(a, b) == 1:
                return (a, b)
        except Exception:
            continue
    return (a0, b0)


def _best_below(target: sp.Rational, max_height: int) -> sp.Rational:
    """Largest rational p/q ≤ target with |p| ≤ max_height and q ≤ max_height."""
    best: Optional[sp.Rational] = None
    for d in range(1, max_height + 1):
        # floor(target * d) -- the largest integer p with p/d <= target
        p = int(sp.floor(target * d))
        if abs(p) > max_height:
            # try the in-range candidate of largest absolute value
            p = max_height if p > 0 else -max_height
            cand = sp.Rational(p, d)
            if cand > target:
                continue
        cand = sp.Rational(p, d)
        if cand > target:
            continue
        if best is None or cand > best:
            best = cand
    if best is None:
        # Fallback: floor + 1 above max_height would still need a wider integer.
        return sp.Rational(int(sp.floor(target)) - 1)
    return best


def _best_above(target: sp.Rational, max_height: int) -> sp.Rational:
    """Smallest rational p/q ≥ target with |p| ≤ max_height and q ≤ max_height."""
    best: Optional[sp.Rational] = None
    for d in range(1, max_height + 1):
        p = int(sp.ceiling(target * d))
        if abs(p) > max_height:
            p = max_height if p > 0 else -max_height
            cand = sp.Rational(p, d)
            if cand < target:
                continue
        cand = sp.Rational(p, d)
        if cand < target:
            continue
        if best is None or cand < best:
            best = cand
    if best is None:
        return sp.Rational(int(sp.ceiling(target)) + 1)
    return best


def _height(r: sp.Rational) -> int:
    return max(abs(int(r.p)), int(r.q))
