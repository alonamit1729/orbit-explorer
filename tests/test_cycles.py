"""Golden tests for the cycle finder.

The headline case is f(x) = x^2 - 29/16, which has an exact rational 3-cycle
5/4 -> -1/4 -> -7/4 -> 5/4. By Sharkovsky, it also has cycles of every period.
"""

import sympy as sp

from orbit_explorer.analysis import AnalysisConfig, analyze
from orbit_explorer.cycles import (
    find_cycles_for_period,
    primitive_period_poly,
    sweep_periods,
)
from orbit_explorer.parse import parse_polynomial


def test_quadratic_29_16_has_known_3_cycle():
    parsed = parse_polynomial("x^2 - 29/16")
    result = find_cycles_for_period(parsed.expr, 3, parsed.x)
    assert result.exists
    assert len(result.cycles) >= 1

    # Collect the rational points across all 3-cycles
    rationals: set[sp.Rational] = set()
    for cyc in result.cycles:
        for pt in cyc.points:
            if pt.kind == "rational":
                rationals.add(pt.value)

    expected = {sp.Rational(5, 4), sp.Rational(-1, 4), sp.Rational(-7, 4)}
    assert expected <= rationals


def test_quadratic_29_16_3_cycle_orbit_order():
    parsed = parse_polynomial("x^2 - 29/16")
    result = find_cycles_for_period(parsed.expr, 3, parsed.x)
    # Find the cycle containing 5/4 and confirm orbit order.
    target = None
    for cyc in result.cycles:
        if any(getattr(p, "value", None) == sp.Rational(5, 4) for p in cyc.points):
            target = cyc
            break
    assert target is not None
    values = [getattr(p, "value", None) for p in target.points]
    # Rotate so 5/4 is first
    i0 = values.index(sp.Rational(5, 4))
    rotated = values[i0:] + values[:i0]
    assert rotated == [sp.Rational(5, 4), sp.Rational(-1, 4), sp.Rational(-7, 4)]


def test_fixed_points_x_squared_minus_29_16():
    # f(x) = x has solutions (1 ± sqrt(33)/2) / 2 = (2 ± sqrt(33))/4
    parsed = parse_polynomial("x^2 - 29/16")
    result = find_cycles_for_period(parsed.expr, 1, parsed.x)
    assert result.exists
    # Should be two 1-cycles (fixed points).
    assert len(result.cycles) == 2


def test_sharkovsky_3_cycle_implies_all_in_sweep():
    # With max_period = 6, the 3-cycle should imply cycles of all periods 1..6.
    result = analyze("x^2 - 29/16", AnalysisConfig(max_period=6, preperiodic_depth=1))
    assert 3 in result.sharkovsky.found
    assert not result.sharkovsky.proven_absent  # every period 1..6 should exist
    assert result.sharkovsky.dominant == 3
    assert "3-cycle" in result.sharkovsky.note or "every positive integer" in result.sharkovsky.note


def test_simple_quadratic_x_squared_no_3_cycle():
    # f(x) = x^2 has fixed points 0, 1 and no other real cycles.
    parsed = parse_polynomial("x^2")
    sweep = sweep_periods(parsed.expr, parsed.x, 4)
    # period 1: 0 and 1
    assert sweep[1].exists
    assert len(sweep[1].cycles) == 2
    # period 2, 3, 4: no real cycles
    assert not sweep[2].exists
    assert not sweep[3].exists
    assert not sweep[4].exists


def test_primitive_polys_strip_lower_periods():
    parsed = parse_polynomial("x^2 - 29/16")
    f = parsed.expr
    x = parsed.x
    phi1 = primitive_period_poly(f, 1, x)
    phi2 = primitive_period_poly(f, 2, x)
    # phi2 should NOT share roots with phi1
    g = sp.gcd(phi1, phi2)
    assert g.degree() == 0


def test_preperiodic_finds_known_chain():
    # 3/4 -> -5/4 -> -1/4 (on cycle). There are two period-3 cycles for this
    # polynomial (the rational one and an algebraic one); scan both.
    result = analyze("x^2 - 29/16", AnalysisConfig(max_period=3, preperiodic_depth=3))
    p3 = next(p for p in result.per_period if p.period == 3)
    assert p3.cycles

    found_minus_5_4 = False
    found_3_4_under_it = False
    for cycle, trees in zip(p3.cycles, p3.preperiodic_trees):
        for tree in trees:
            cp = cycle.points[tree.cycle_point_index]
            if getattr(cp, "value", None) != sp.Rational(-1, 4):
                continue
            for node in tree.roots:
                if getattr(node.point, "value", None) == sp.Rational(-5, 4):
                    found_minus_5_4 = True
                    for child in node.children:
                        if getattr(child.point, "value", None) == sp.Rational(3, 4):
                            found_3_4_under_it = True
    assert found_minus_5_4, "expected -5/4 as a real preimage of -1/4"
    assert found_3_4_under_it, "expected 3/4 as a depth-2 preimage of -1/4"
