"""Hand-checkable cases for the pinch core (modules/pinch/pinch.py, streams.py)
and temperature pocket deletion (modules/utility/temperature_pocket_deletion.py).
"""

import pytest

from app.modules.pinch.pinch import Pinch
from app.modules.pinch.streams import Streams
from app.modules.utility.temperature_pocket_deletion import TemperaturePocketDeletion


def solve(tmp_path, streams, t_min, options=()):
    """Run the whole Pinch chain on (CP, T_supply, T_target) rows."""
    f = tmp_path / "streams.csv"
    f.write_text(f"Tmin,{t_min}\nCP,TSUPPLY,TTARGET\n"
                 + "".join(f"{c},{a},{b}\n" for c, a, b in streams))
    p = Pinch(str(f), options=set(options))
    p.shift_temperatures()
    p.construct_temperature_interval()
    p.construct_problem_table()
    p.construct_heat_cascade()
    p.construct_shifted_composite_diagram("EN")
    p.construct_composite_diagram("EN")
    p.construct_grand_composite_curve("EN")
    return p


# --- Pinch --------------------------------------------------------------------

def test_two_stream_problem_with_a_pinch_at_the_hot_end(tmp_path):
    """Hot CP 3, 150 -> 50 (300 kW); cold CP 2, 40 -> 140 (200 kW); dTmin = 20.

    Shifted by +-10 K the hot stream is 140 -> 40 and the cold 50 -> 150:

        interval    sum CP (hot - cold)    dH      cascade from 0
        150-140     -2                     -20     -20   <- most negative
        140-50      3 - 2 = +1             +90      70
        50-40       +3                     +30     100

    Hot utility 20 kW; refeeding it gives 0, 90, 120, so cold utility 120 kW.
    Overall balance: 120 - 20 = 100 = 300 - 200. The pinch is the bottom of the
    first interval, 140 degC shifted (150 hot-side / 130 cold-side).
    """
    p = solve(tmp_path, [(3, 150, 50), (2, 40, 140)], 20)

    assert p.hot_utility == pytest.approx(20)
    assert p.cold_utility == pytest.approx(120)
    assert p.pinch_temperature == pytest.approx(140)
    assert p._temperatures == [150, 140, 50, 40]
    assert [r["deltaH"] for r in p.problem_table] == pytest.approx([-20, 90, 30])
    assert [r["exitH"] for r in p.unfeasible_heat_cascade] == pytest.approx([-20, 70, 100])
    assert [r["exitH"] for r in p.heat_cascade] == pytest.approx([0, 90, 120])
    # Grand composite curve: hot utility at the top, cold utility at the bottom.
    assert p.grand_composite_curve["H"] == pytest.approx([20, 0, 90, 120])
    assert p.grand_composite_curve["T"] == pytest.approx([150, 140, 50, 40])


def test_threshold_problem_needs_no_hot_utility(tmp_path):
    """Hot CP 2, 150 -> 50 (200 kW) against cold CP 1.5, 20 -> 120 (150 kW), dTmin 10.

    Shifted: hot 145 -> 45, cold 25 -> 125. Cascade 145-125: +40, 125-45: +40
    (0.5 kW/K * 80 K), 45-25: -30  ->  40, 80, 50. It never goes negative, so
    hot utility is 0 and the cold utility is the 50 kW surplus (200 - 150).
    """
    p = solve(tmp_path, [(2, 150, 50), (1.5, 20, 120)], 10)

    assert p.hot_utility == pytest.approx(0)
    assert p.cold_utility == pytest.approx(50)
    assert [r["exitH"] for r in p.heat_cascade] == pytest.approx([40, 80, 50])


def test_composite_curves_are_the_shifted_ones_moved_back_by_half_dtmin(tmp_path):
    p = solve(tmp_path, [(3, 150, 50), (2, 40, 140)], 20)

    shifted, real = p.shifted_composite_diagram, p.composite_diagram
    assert real["hot"]["T"] == pytest.approx([t + 10 for t in shifted["hot"]["T"]])
    assert real["cold"]["T"] == pytest.approx([t - 10 for t in shifted["cold"]["T"]])
    assert real["hot"]["H"] == shifted["hot"]["H"]
    # The hot curve's real endpoints are the streams' own temperatures.
    assert min(real["hot"]["T"]) == pytest.approx(50) and max(real["hot"]["T"]) == pytest.approx(150)
    assert min(real["cold"]["T"]) == pytest.approx(40) and max(real["cold"]["T"]) == pytest.approx(140)
    # Heat carried by the curves: hot gives 300 kW, cold takes 200 kW + hot utility 20.
    assert max(real["hot"]["H"]) - min(real["hot"]["H"]) == pytest.approx(300)
    assert max(real["cold"]["H"]) - min(real["cold"]["H"]) == pytest.approx(200)


def test_composite_diagrams_do_not_share_lists(tmp_path):
    """Editing one diagram (a plot trimming points, say) must not rewrite the other."""
    p = solve(tmp_path, [(3, 150, 50), (2, 40, 140)], 20)
    assert p.composite_diagram["hot"]["H"] is not p.shifted_composite_diagram["hot"]["H"]
    assert p.composite_diagram["cold"]["H"] is not p.shifted_composite_diagram["cold"]["H"]


def test_interval_without_streams_carries_no_heat(tmp_path):
    """Two streams that do not overlap in temperature leave a gap interval with
    no stream in it; the problem table must give it deltaCP = 0, not fail.

    Hot 100 -> 80 (CP 1) and cold 40 -> 60 (CP 1), dTmin 0: the 80-60 interval is empty.
    """
    p = solve(tmp_path, [(1, 100, 80), (1, 40, 60)], 0)

    assert [r["deltaCP"] for r in p.problem_table] == [1, 0, -1]
    assert [r["deltaH"] for r in p.problem_table] == pytest.approx([20, 0, -20])
    # The hot stream's 20 kW flows straight to the colder stream: 20, 20, 0.
    assert p.hot_utility == pytest.approx(0) and p.cold_utility == pytest.approx(0)


def test_debug_option_prints_the_tables(tmp_path, capsys):
    solve(tmp_path, [(3, 150, 50), (2, 40, 140)], 20, options=("debug",))
    out = capsys.readouterr().out
    assert "Problem Table" in out and "Minimum Hot Utility (kW): 20" in out


# --- Streams ------------------------------------------------------------------

def test_streams_classifies_hot_and_cold_by_direction(tmp_path):
    f = tmp_path / "s.csv"
    f.write_text("Tmin,10\nCP,TSUPPLY,TTARGET\n2,100,40\n3,20,80\n")
    s = Streams(str(f))
    assert s.tmin == 10
    assert [x["type"] for x in s.streamsData] == ["HOT", "COLD"]
    assert s.numberOf == 2


def test_streams_rejects_bad_headers_and_single_streams(tmp_path):
    bad = tmp_path / "bad.csv"
    bad.write_text("Tmin,10\nCP,TS,TT\n2,100,40\n3,20,80\n")
    with pytest.raises(Exception, match="Bad formatting"):
        Streams(str(bad))

    one = tmp_path / "one.csv"
    one.write_text("Tmin,10\nCP,TSUPPLY,TTARGET\n2,100,40\n")
    with pytest.raises(Exception, match="at least 2 streams"):
        Streams(str(one))

    letters = tmp_path / "letters.csv"
    letters.write_text("Tmin,abc\nCP,TSUPPLY,TTARGET\n2,100,40\n3,20,80\n")
    with pytest.raises(ValueError):
        Streams(str(letters))


# --- Temperature pocket deletion --------------------------------------------

def delete_pockets(hot_utility, delta_h, temperatures):
    """Run pocket deletion on a cascade given as interval heats (T descending)."""
    rows, exit_h = [], hot_utility
    for d in delta_h:
        exit_h += d
        rows.append({"deltaH": d, "exitH": exit_h})
    out = TemperaturePocketDeletion(hot_utility, rows, list(temperatures)).delete_temperature_pockets()
    return out["H"][0], out["deltaH"][0], out["T"][0]


def test_cascade_without_pockets_comes_back_unchanged():
    """Hot utility 40, intervals -20, -20 (heat is needed above the pinch), then
    +30, +10 below it. H falls monotonically to the pinch and rises after it:
    nothing is a pocket."""
    h, dh, t = delete_pockets(40, [-20, -20, 30, 10], [100, 80, 60, 40, 20])
    assert h == [40, 20, 0, 30, 40]
    assert dh == [-20, -20, 30, 10]
    assert t == [100, 80, 60, 40, 20]


def test_textbook_cascade_reduces_to_one_sink_and_one_source_segment():
    """Textbook problem (golden test): cascade 20, 80, 82.5, 0, 75, 60 kW at
    165, 145, 140, 85, 55, 25 degC. Above the pinch the heat demand left after
    internal recovery is the 20 kW hot utility, reached at 85 + 20/1.5 = 98.33
    degC on the 1.5 kW/K line into the pinch. Below it, the pocket-free source
    rises at 2.5 kW/K from the pinch until it reaches the 60 kW cold utility,
    at 85 - 60/2.5 = 61 degC."""
    h, dh, t = delete_pockets(20, [60, 2.5, -82.5, 75, -15], [165, 145, 140, 85, 55, 25])

    assert t == pytest.approx([85 + 20 / 1.5, 85, 61])
    assert h == pytest.approx([20, 0, 60])
    assert dh == pytest.approx([-20, 60])


def test_pocket_below_the_pinch_is_replaced_by_a_flat_stretch():
    """Below the pinch the source profile can only rise as T falls. Cascade
    0, 40, 30, 25, 55 kW at 100, 80, 60, 50, 30 degC dips from 40 to 25 kW: the
    dip is a pocket (heat the process re-uses itself). The profile climbs on the
    original 2 kW/K line to 25 kW (at 87.5 degC), stays at 25 kW until the
    original curve comes back up to it (at 50 degC), then follows it to 55 kW."""
    h, dh, t = delete_pockets(0, [40, -10, -5, 30], [100, 80, 60, 50, 30])

    assert t == pytest.approx([100, 87.5, 50, 30])
    assert h == pytest.approx([0, 25, 25, 55])
    assert dh == pytest.approx([25, 0, 30])


def test_pocket_above_the_pinch_is_replaced_by_a_flat_stretch():
    """Mirror image: hot utility 50, cascade 30, 40, 0 kW at 80, 60, 40 degC. The
    rise from 30 to 40 kW is a pocket; the sink profile stays at 30 kW until the
    original line (2 kW/K into the pinch at 40 degC) falls to it, at 55 degC."""
    h, dh, t = delete_pockets(50, [-20, 10, -40], [100, 80, 60, 40])

    assert t == pytest.approx([100, 80, 55, 40])
    assert h == pytest.approx([50, 30, 30, 0])
    assert dh == pytest.approx([-20, 0, -30])
