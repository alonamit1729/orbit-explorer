"""Build the backwards pre-image tree from each cycle point to a configurable depth.

For a polynomial f and a target value y, the real preimages of y are the real
roots of f(x) - y. We recurse outward from each cycle point, marking leaves
as either *terminal* (no real preimages) or *continues* (preimages exist
beyond our depth budget).

Important: we exclude preimages that are themselves on the cycle (otherwise
we'd loop). We also de-duplicate preimages that arise on multiple paths via
exact / numerical equality.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import sympy as sp

from .algebraic import Point, classify, numeric_value
from .cycles import Cycle


@dataclass
class PreimageNode:
    point: Point
    depth: int                          # depth from cycle point (1 = direct preimage)
    children: list["PreimageNode"] = field(default_factory=list)
    leaf_status: Optional[str] = None   # None | "terminal" | "continues"


@dataclass
class PreperiodicTree:
    cycle_point_index: int              # which point in the cycle is this rooted at
    roots: list[PreimageNode]           # direct preimages (depth=1) not on the cycle


def build_preperiodic(
    f_expr: sp.Expr,
    x: sp.Symbol,
    cycle: Cycle,
    max_depth: int,
) -> list[PreperiodicTree]:
    """Build a PreperiodicTree for each point in `cycle`."""
    cycle_keys = {_numeric_key(p) for p in cycle.points}
    trees: list[PreperiodicTree] = []
    for idx, cp in enumerate(cycle.points):
        roots = _preimages_of(f_expr, x, cp, depth=1, max_depth=max_depth,
                              exclude=cycle_keys)
        trees.append(PreperiodicTree(cycle_point_index=idx, roots=roots))
    return trees


# ---------------------------------------------------------------------------


def _preimages_of(
    f_expr: sp.Expr,
    x: sp.Symbol,
    target: Point,
    depth: int,
    max_depth: int,
    exclude: set[str],
) -> list[PreimageNode]:
    """Real solutions of f(x) = target.value, recursing to ``max_depth``."""
    y_expr = _point_value_expr(target)
    roots = _real_preimages(f_expr, x, y_expr)

    nodes: list[PreimageNode] = []
    seen_here: set[str] = set()
    for r in roots:
        key = _numeric_key_expr(r)
        if key in exclude or key in seen_here:
            continue
        seen_here.add(key)
        pt = classify(r, x)
        node = PreimageNode(point=pt, depth=depth)
        if depth >= max_depth:
            # Check whether more preimages exist beyond our depth.
            r_y_expr = _point_value_expr(pt)
            next_roots = _real_preimages(f_expr, x, r_y_expr)
            has_more = any(
                _numeric_key_expr(rr) not in exclude
                and _numeric_key_expr(rr) != key
                for rr in next_roots
            )
            node.leaf_status = "continues" if has_more else "terminal"
        else:
            child_exclude = exclude | {key}
            node.children = _preimages_of(
                f_expr, x, pt, depth + 1, max_depth, child_exclude
            )
            if not node.children:
                node.leaf_status = "terminal"
        nodes.append(node)
    return nodes


def _real_preimages(
    f_expr: sp.Expr, x: sp.Symbol, y_expr: sp.Expr
) -> list[sp.Expr]:
    """Real solutions of f(x) = y_expr.

    Tries Poly.real_roots() first (fast, exact, works when both f and y are
    over Q). Falls back to sp.solve() for radical / algebraic targets where
    the polynomial sits in SymPy's EX domain and real_roots() refuses.
    """
    eq = f_expr - y_expr
    try:
        poly = sp.Poly(eq, x, domain=sp.QQ)
        return poly.real_roots()
    except (sp.PolynomialError, sp.CoercionFailed):
        pass
    # Generic Poly (any domain) — might still work
    try:
        poly = sp.Poly(eq, x)
        return poly.real_roots()
    except (sp.PolynomialError, NotImplementedError):
        pass
    # Fallback: symbolic solve, filter to real values.
    try:
        sols = sp.solve(eq, x)
    except (NotImplementedError, sp.PolynomialError):
        return []
    real: list[sp.Expr] = []
    for s in sols:
        if not _is_real(s):
            continue
        real.append(sp.expand(s))
    # Sort by numerical value for deterministic ordering.
    real.sort(key=lambda v: float(sp.N(v, 30)))
    return real


def _is_real(value: sp.Expr, digits: int = 30) -> bool:
    """Heuristic: a SymPy expression is treated as real if its symbolic
    imaginary part simplifies to 0, or its numerical imaginary part is
    negligibly small."""
    try:
        if sp.im(value) == 0:
            return True
    except Exception:
        pass
    try:
        n = sp.N(value, digits)
        if n.is_real:
            return True
        if abs(sp.im(n)) < sp.Float(10) ** -(digits - 5):
            return True
    except Exception:
        return False
    return False


def _point_value_expr(p: Point) -> sp.Expr:
    """Get a SymPy expression representing the point's value."""
    if p.kind == "rational":
        return p.value
    if p.kind == "radical":
        return p.expr
    # algebraic: reconstruct a numerical sympy Float at high precision
    return sp.Float(p.decimal)


def _numeric_key(p: Point, digits: int = 40) -> str:
    val = numeric_value(p)
    return _round_key(val, digits)


def _numeric_key_expr(e: sp.Expr, digits: int = 40) -> str:
    return _round_key(sp.N(e, digits), digits)


def _round_key(val: sp.Expr, digits: int) -> str:
    # Stable string suitable for set membership.
    s = sp.Float(val, digits)
    return f"{float(s):.{min(digits, 30)}g}"
