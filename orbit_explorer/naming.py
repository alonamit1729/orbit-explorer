"""Assign letter names (A, B, C, …) to algebraic points that don't fit inline.

Points classified as ``AlgebraicPoint`` carry no human-readable label until
this pass runs. We deduplicate by exact identity (decimal of high-precision
value) so the same algebraic real always gets the same name across cycles
and pre-periodic trees.
"""

from __future__ import annotations

from dataclasses import dataclass

from .algebraic import AlgebraicPoint, Point
from .cycles import Cycle
from .preperiodic import PreimageNode, PreperiodicTree


@dataclass
class NamedAlgebraic:
    label: str
    point: AlgebraicPoint                  # the canonical instance bearing this label


def assign_names(
    cycles_by_period: dict[int, list[Cycle]],
    trees_by_cycle_id: dict[int, list[PreperiodicTree]],
) -> list[NamedAlgebraic]:
    """Walk every point, assign labels A, B, … to AlgebraicPoint instances.

    Mutates the ``label`` field of each ``AlgebraicPoint`` in place.
    Returns the list of distinct named algebraics in assignment order.
    """
    registry: dict[str, NamedAlgebraic] = {}
    next_label_idx = [0]

    def visit(p: Point) -> None:
        if not isinstance(p, AlgebraicPoint):
            return
        key = p.decimal[:30]
        if key in registry:
            p.label = registry[key].label
            return
        label = _label_for(next_label_idx[0])
        next_label_idx[0] += 1
        p.label = label
        registry[key] = NamedAlgebraic(label=label, point=p)

    # Walk cycles
    for cycles in cycles_by_period.values():
        for c in cycles:
            for pt in c.points:
                visit(pt)

    # Walk preperiodic trees
    for trees in trees_by_cycle_id.values():
        for tree in trees:
            for root in tree.roots:
                _walk_tree(root, visit)

    # Order by label index for return.
    return sorted(registry.values(), key=lambda n: (len(n.label), n.label))


def _walk_tree(node: PreimageNode, fn) -> None:
    fn(node.point)
    for child in node.children:
        _walk_tree(child, fn)


def _label_for(idx: int) -> str:
    """0 -> A, 1 -> B, …, 25 -> Z, 26 -> AA, 27 -> AB, …"""
    letters = []
    n = idx
    while True:
        letters.append(chr(ord("A") + n % 26))
        n = n // 26 - 1
        if n < 0:
            break
    return "".join(reversed(letters))
