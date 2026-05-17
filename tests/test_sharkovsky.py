from orbit_explorer.sharkovsky import (
    build_report,
    implied_periods,
    sharkovsky_greater,
    sharkovsky_rank,
)


def test_sharkovsky_order_basic():
    # 3 is the greatest in Sharkovsky's order (>> everything).
    assert sharkovsky_greater(3, 5)
    assert sharkovsky_greater(3, 1)
    assert sharkovsky_greater(3, 2)
    assert sharkovsky_greater(3, 4)
    assert sharkovsky_greater(5, 7)
    assert sharkovsky_greater(7, 9)
    # within odds * 2^k, larger b wins
    assert sharkovsky_greater(6, 10)  # 2*3 > 2*5
    assert sharkovsky_greater(12, 20)  # 4*3 > 4*5
    # odds beat any 2^k * odd' if rank is smaller
    assert sharkovsky_greater(5, 6)  # odd 5 > 2*3
    # powers of two: 2^infty > ... > 4 > 2 > 1
    assert sharkovsky_greater(4, 2)
    assert sharkovsky_greater(2, 1)
    # all non-powers-of-two beat powers of two
    assert sharkovsky_greater(3, 8)
    assert sharkovsky_greater(7, 1024)


def test_implied_periods_three_implies_all():
    impl = implied_periods({3}, upper_bound=12)
    assert impl == set(range(1, 13))


def test_implied_periods_five_does_not_imply_three():
    impl = implied_periods({5}, upper_bound=10)
    assert 3 not in impl
    # but it implies 7, 9, all even, and powers of 2
    assert 7 in impl
    assert 9 in impl
    assert 1 in impl
    assert 2 in impl
    assert 4 in impl


def test_report_distinguishes_proven_absent_from_unknown():
    # Suppose 5-cycle found, 3-cycle proven absent in the sweep
    existence = {1: True, 2: True, 3: False, 4: True, 5: True, 6: True}
    rep = build_report(existence, sweep_max=6)
    assert rep.found == [1, 2, 4, 5, 6]
    assert rep.proven_absent == [3]
    assert rep.dominant == 5
    assert "no cycles exist for period(s) {3}" in rep.note
