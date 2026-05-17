"""Point ADT for cycle elements.

A point comes in one of three flavors:

- ``RationalPoint``       — an exact element of Q.
- ``RadicalPoint``        — a small symbolic expression (e.g. ``(1+sqrt(5))/2``)
                             whose rendered LaTeX fits the inline budget.
- ``AlgebraicPoint``      — an algebraic real specified by minimal polynomial
                             and isolating interval. Carries a human label
                             (``A``, ``B``, …) assigned later by ``naming``.

All three carry a high-precision decimal for downstream display. We use
mpmath via ``sympy.N`` for the numeric value.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal, Optional, Union

import sympy as sp

INLINE_LATEX_BUDGET = 40   # characters; longer expressions get a letter name
NUMERIC_PRECISION = 50     # decimal digits for the high-precision display value
DISPLAY_DIGITS = 12        # short decimal shown alongside exact form


@dataclass(frozen=True)
class RationalPoint:
    kind: Literal["rational"]
    value: sp.Rational
    latex: str
    decimal: str         # short, e.g. "1.25"


@dataclass(frozen=True)
class RadicalPoint:
    kind: Literal["radical"]
    expr: sp.Expr
    latex: str
    decimal: str         # short


@dataclass
class AlgebraicPoint:
    kind: Literal["algebraic"]
    # minimal polynomial coefficients, low → high degree, all rationals as (num, den)
    min_poly_coeffs: list[tuple[int, int]]
    min_poly_latex: str
    isolating_interval: tuple[sp.Rational, sp.Rational]
    decimal: str               # high precision
    short_decimal: str         # display
    label: Optional[str] = None    # set by naming pass


Point = Union[RationalPoint, RadicalPoint, AlgebraicPoint]


# ---------------------------------------------------------------------------
# Construction


def classify(root: sp.Expr, x: sp.Symbol) -> Point:
    """Turn a SymPy real-root expression into one of the three Point kinds.

    SymPy's ``real_roots`` returns Rational, plain radical expressions, or
    ``CRootOf`` instances for higher-degree algebraics. We dispatch on kind.
    """
    # Rational
    if isinstance(root, sp.Rational):
        latex = sp.latex(root)
        return RationalPoint(
            kind="rational",
            value=root,
            latex=latex,
            decimal=_short_decimal(root),
        )

    # CRootOf — algebraic real with isolating interval
    if isinstance(root, sp.RootOf) or isinstance(root, sp.polys.rootoftools.ComplexRootOf):
        poly = root.poly
        coeffs = [_rational_to_pair(c) for c in reversed(poly.all_coeffs())]
        interval = root._get_interval()
        a, b = sp.Rational(interval.a), sp.Rational(interval.b)
        approx = sp.N(root, NUMERIC_PRECISION)
        return AlgebraicPoint(
            kind="algebraic",
            min_poly_coeffs=coeffs,
            min_poly_latex=sp.latex(poly.as_expr()),
            isolating_interval=(a, b),
            decimal=str(approx),
            short_decimal=_short_decimal(approx),
        )

    # Radical or other closed-form symbolic
    simplified = sp.radsimp(sp.simplify(root))
    latex = sp.latex(simplified)
    if len(latex) <= INLINE_LATEX_BUDGET:
        return RadicalPoint(
            kind="radical",
            expr=simplified,
            latex=latex,
            decimal=_short_decimal(simplified),
        )

    # Too big to render inline — wrap as algebraic via minimal polynomial.
    min_poly = sp.minimal_polynomial(simplified, x, polys=True)
    coeffs = [_rational_to_pair(c) for c in reversed(min_poly.all_coeffs())]
    approx = sp.N(simplified, NUMERIC_PRECISION)
    # Build a small isolating interval around the numerical value.
    eps = sp.Rational(1, 10**6)
    lo = sp.nsimplify(approx - sp.Rational(1, 1000), rational=True)
    hi = sp.nsimplify(approx + sp.Rational(1, 1000), rational=True)
    return AlgebraicPoint(
        kind="algebraic",
        min_poly_coeffs=coeffs,
        min_poly_latex=sp.latex(min_poly.as_expr()),
        isolating_interval=(lo, hi),
        decimal=str(approx),
        short_decimal=_short_decimal(approx),
    )


# ---------------------------------------------------------------------------
# Helpers


def _short_decimal(value: sp.Expr) -> str:
    f = float(sp.N(value, DISPLAY_DIGITS + 2))
    # Strip noisy trailing zeros while keeping a leading digit.
    s = f"{f:.{DISPLAY_DIGITS}g}"
    return s


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
    # AlgebraicPoint: reconstruct CRootOf from min poly + numerical seed.
    raise NotImplementedError("exact_value on AlgebraicPoint requires a context object")
