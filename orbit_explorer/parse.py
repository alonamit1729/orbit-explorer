"""Parse a user-supplied polynomial string into a SymPy Poly over Q."""

from __future__ import annotations

import re
from dataclasses import dataclass

import sympy as sp


@dataclass(frozen=True)
class ParsedPolynomial:
    poly: sp.Poly        # SymPy Poly in x over Q
    expr: sp.Expr        # original expression (after sympify)
    x: sp.Symbol


_ALLOWED_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def parse_polynomial(text: str, var_name: str = "x") -> ParsedPolynomial:
    """Parse `text` as a polynomial in `var_name` with rational coefficients.

    Accepts familiar math syntax: ``x^2``, ``x**2``, ``-29/16``, ``(x-1)(x+2)``,
    implicit multiplication between a number/closing paren and the variable.

    Raises ``ValueError`` with a user-readable message on bad input.
    """
    if not _ALLOWED_NAME_RE.match(var_name):
        raise ValueError(f"invalid variable name: {var_name!r}")

    raw = text.strip()
    if not raw:
        raise ValueError("empty polynomial")

    # Normalize: ^ → **, then insert * for implicit multiplication
    normalized = raw.replace("^", "**")
    normalized = _insert_implicit_multiplication(normalized, var_name)

    x = sp.Symbol(var_name)
    local_dict = {var_name: x}

    try:
        expr = sp.sympify(normalized, locals=local_dict, rational=True)
    except (sp.SympifyError, SyntaxError, TypeError) as e:
        raise ValueError(f"could not parse expression: {e}") from e

    # Reject expressions that introduce other free symbols
    free = expr.free_symbols - {x}
    if free:
        names = ", ".join(sorted(str(s) for s in free))
        raise ValueError(f"unexpected symbol(s) in expression: {names}")

    try:
        poly = sp.Poly(expr, x, domain=sp.QQ)
    except (sp.PolynomialError, sp.CoercionFailed) as e:
        raise ValueError(
            "expression is not a polynomial with rational coefficients"
        ) from e

    return ParsedPolynomial(poly=poly, expr=sp.expand(expr), x=x)


def _insert_implicit_multiplication(text: str, var: str) -> str:
    """Insert ``*`` between adjacent tokens where users expect implicit
    multiplication: ``2x`` → ``2*x``, ``)(`` → ``)*(``, ``x(`` → ``x*(``,
    ``)x`` → ``)*x``."""
    patterns = [
        (rf"(\d)({re.escape(var)})", r"\1*\2"),     # 2x   -> 2*x
        (rf"(\d)\(", r"\1*("),                       # 2(   -> 2*(
        (rf"\)(\d)", r")*\1"),                       # )2   -> )*2
        (rf"\)({re.escape(var)})", r")*\1"),         # )x   -> )*x
        (rf"({re.escape(var)})\(", r"\1*("),         # x(   -> x*(
        (r"\)\(", r")*("),                            # )(   -> )*(
    ]
    out = text
    for pat, repl in patterns:
        out = re.sub(pat, repl, out)
    return out
