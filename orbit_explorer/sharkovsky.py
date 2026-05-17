"""Sharkovsky-theorem reasoning over the periods discovered by the sweep.

Sharkovsky's order on the positive integers:

    3 > 5 > 7 > 9 > ... (odd > 1)
    > 2*3 > 2*5 > 2*7 > ...
    > 4*3 > 4*5 > 4*7 > ...
    ...
    > 2^k * 3 > 2^k * 5 > ...
    ...
    > 2^infty > ... > 2^3 > 2^2 > 2 > 1

If a continuous map of an interval has a periodic point of period m, then it
has periodic points of every period n with m >> n in this order.

This module:

- Computes implied periods given a set of found periods.
- Given a sweep result (PeriodResults for n = 1..N), reports:
    * periods that exist (found cycles)
    * periods that are implied to exist but were not found in the sweep
    * periods that are proven NOT to exist (in the sweep, primitive poly had
      no real roots) — useful when the dominant found period does not imply
      them (e.g. a 5-cycle exists but the 3-cycle is provably absent)
"""

from __future__ import annotations

from dataclasses import dataclass


def sharkovsky_rank(n: int) -> tuple[int, int]:
    """Return a sort key such that smaller keys = greater in Sharkovsky order.

    Encoding: write n = 2^a * b with b odd. Sharkovsky's order is
      3 > 5 > 7 > … > 2·3 > 2·5 > … > 4·3 > 4·5 > … > 2^k·3 > … > 2^∞ > … > 4 > 2 > 1.

    We encode (group, subrank) with smaller key = greater in Sharkovsky:
      - if b > 1: group = a,            subrank = b            (smaller b = greater)
      - if b == 1: group = 10**9 - a,   subrank = 0            (puts powers of two after
                                                                 all b>1 groups, in
                                                                 *decreasing* a order so
                                                                 2^∞ > … > 4 > 2 > 1)
    """
    if n <= 0:
        raise ValueError("n must be a positive integer")
    a = 0
    b = n
    while b % 2 == 0:
        b //= 2
        a += 1
    if b > 1:
        return (a, b)
    return (10**9 - a, 0)


def sharkovsky_greater(m: int, n: int) -> bool:
    """True iff m >> n in Sharkovsky order (existence of m-cycle implies n-cycle)."""
    return sharkovsky_rank(m) < sharkovsky_rank(n)


def implied_periods(found: set[int], upper_bound: int) -> set[int]:
    """All periods in 1..upper_bound implied by `found` via Sharkovsky.

    Each found period implies itself (a period is trivially implied by its own
    existence) plus every n with m >> n in Sharkovsky's order.
    """
    result: set[int] = set(p for p in found if p <= upper_bound)
    for n in range(1, upper_bound + 1):
        for m in found:
            if sharkovsky_greater(m, n):
                result.add(n)
                break
    return result


@dataclass
class SharkovskyReport:
    found: list[int]                       # periods with at least one cycle
    proven_absent: list[int]               # periods provably absent within sweep
    implied_but_not_found: list[int]       # implied by Sharkovsky but outside sweep
    dominant: int | None                   # greatest found period in Sharkovsky order
    note: str                              # short human-readable summary


def build_report(period_exists: dict[int, bool], sweep_max: int) -> SharkovskyReport:
    """Build a Sharkovsky report from the sweep's per-period existence map."""
    found = sorted([n for n, ok in period_exists.items() if ok])
    proven_absent = sorted([n for n, ok in period_exists.items() if not ok])

    dominant: int | None = None
    if found:
        dominant = min(found, key=sharkovsky_rank)  # smallest key = greatest in Sharkovsky

    # Implied periods that exceed sweep cap (we couldn't verify them by factoring).
    implied_within = implied_periods(set(found), sweep_max)
    implied_outside: list[int] = []
    if dominant is not None:
        # Anything implied by dominant beyond sweep_max
        n = sweep_max + 1
        # Be modest: list the next several beyond the cap (avoid infinite list).
        cap_extend = sweep_max + 20
        while n <= cap_extend:
            if sharkovsky_greater(dominant, n):
                implied_outside.append(n)
            n += 1

    note = _summarize(found, proven_absent, dominant, implied_outside)
    return SharkovskyReport(
        found=found,
        proven_absent=proven_absent,
        implied_but_not_found=implied_outside,
        dominant=dominant,
        note=note,
    )


def _summarize(
    found: list[int],
    proven_absent: list[int],
    dominant: int | None,
    implied_outside: list[int],
) -> str:
    if not found:
        return "No periodic cycles found within the search range."

    parts: list[str] = []
    parts.append(f"Found cycles of period(s) {{{', '.join(map(str, found))}}}.")
    if dominant is not None and dominant >= 3:
        if dominant == 3:
            parts.append(
                "By Sharkovsky's theorem, the existence of a 3-cycle implies cycles "
                "of every positive integer period."
            )
        else:
            parts.append(
                f"By Sharkovsky's theorem, the existence of a {dominant}-cycle implies "
                f"cycles of every period that follows {dominant} in Sharkovsky's order."
            )
    if proven_absent:
        parts.append(
            f"Within the search range, no cycles exist for period(s) "
            f"{{{', '.join(map(str, proven_absent))}}} (proven by exact factoring)."
        )
    return " ".join(parts)
