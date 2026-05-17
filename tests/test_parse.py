import pytest
import sympy as sp

from orbit_explorer.parse import parse_polynomial


def test_simple_quadratic():
    p = parse_polynomial("x^2 - 29/16")
    assert p.poly.all_coeffs() == [sp.Rational(1), sp.Rational(0), sp.Rational(-29, 16)]


def test_implicit_multiplication():
    p = parse_polynomial("2x^3 + 3x - 1")
    assert p.poly.all_coeffs() == [sp.Rational(2), sp.Rational(0), sp.Rational(3), sp.Rational(-1)]


def test_factored_form():
    p = parse_polynomial("(x-1)(x+2)")
    assert sp.expand(p.expr) == sp.expand(sp.Symbol("x")**2 + sp.Symbol("x") - 2)


def test_non_rational_coefficient_rejected():
    with pytest.raises(ValueError):
        parse_polynomial("sqrt(2) * x")


def test_unknown_symbol_rejected():
    with pytest.raises(ValueError):
        parse_polynomial("a*x + 1")


def test_empty_rejected():
    with pytest.raises(ValueError):
        parse_polynomial("   ")
