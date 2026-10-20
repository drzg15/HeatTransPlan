"""Unit tests for the single-point heat pump integration module.

The COP numbers are the published correlations evaluated by hand; the walk
over the grand composite curve is checked against the physics it must obey
(duty relation Q_sink = Q_source * COP / (COP - 1), source on the profile).
"""

import pytest

from app.modules.heat_pump_integration.heat_pump_integration import (
    HP_COP_CORRELATIONS,
    HeatPumpIntegration,
    HeatPumpOutOfRange,
    carnot_cop,
    in_operating_window,
)


class _Pinch:
    tmin = 10.0


def hpi(t_sink):
    return HeatPumpIntegration("x.csv", t_sink, _Pinch())


def test_carnot_cop_is_half_the_ideal():
    """Ideal COP = T_sink[K] / lift = 373.15 / 50 = 7.463; the fallback takes half."""
    assert carnot_cop(100.0, 50.0) == pytest.approx(3.7315)


def test_operating_windows_are_inclusive_and_unknown_types_never_fit():
    # SHP and HTHPs (R717): sink 70..85 degC, lift 30..75 K.
    assert in_operating_window("SHP and HTHPs (R717)", 70, 30)
    assert in_operating_window("SHP and HTHPs (R717)", 85, 75)
    assert not in_operating_window("SHP and HTHPs (R717)", 85.1, 50)
    assert not in_operating_window("SHP and HTHPs (R717)", 80, 29.9)
    assert not in_operating_window("Perpetuum mobile", 80, 50)


def test_cop_picks_the_best_technology_rated_for_the_point_and_caps_at_15():
    """Sink 90 degC, source 60 degC (lift 30 K): Stirling (sink >= 144) and R717
    (sink <= 85) are out. Carnot gives 0.5 * 363.15 / 30 = 6.0525, which beats the
    two regressions (about 5.04 and 5.00)."""
    cop, name = hpi(90.0).COP(60.0)
    assert name == "Carnot"
    assert cop == pytest.approx(0.5 * 363.15 / 30)

    # Lift 10 K would give 18.16 -- above the ceiling the app allows.
    assert hpi(90.0).COP(80.0)[0] == 15.0


def test_cop_specific_refuses_to_fall_back_to_carnot():
    """A named technology outside its rating must raise, not quietly return Carnot."""
    with pytest.raises(HeatPumpOutOfRange) as exc:
        hpi(90.0).COP_specific(60.0, "Prototypical Stirling")
    assert exc.value.delta_t == pytest.approx(30.0)
    assert "not rated" in str(exc.value)

    with pytest.raises(ValueError, match="Unknown heat pump type"):
        hpi(90.0).COP_specific(60.0, "Fusion")


def test_cop_specific_inside_the_window_matches_the_correlation():
    expected = HP_COP_CORRELATIONS["VHTHP (HFC/HFO)"](90.0, 30.0)
    assert hpi(90.0).COP_specific(60.0, "VHTHP (HFC/HFO)") == pytest.approx(expected)
    # 1.9118 * (30 + 0.08838)^-0.89094 * (363.04419)^0.67895 -- computed by hand
    assert expected == pytest.approx(5.0392, abs=1e-3)


def test_a_source_not_below_the_sink_has_no_lift():
    """Equal temperatures would divide by zero in the Carnot fallback."""
    with pytest.raises(ValueError, match="No temperature lift"):
        hpi(60.0).COP(60.0)
    with pytest.raises(ValueError, match="No temperature lift"):
        hpi(60.0).COP_specific(70.0, "Carnot")


def test_available_heat_pumps_lists_each_type_with_a_reason_when_excluded():
    entries = {e["name"]: e for e in hpi(90.0).get_available_heat_pumps(60.0)}

    assert set(entries) == set(HP_COP_CORRELATIONS)
    assert entries["Carnot"]["available"] and entries["Carnot"]["cop"] == pytest.approx(6.0525)
    stirling = entries["Prototypical Stirling"]
    assert not stirling["available"] and stirling["cop"] is None
    assert "144" in stirling["reason"] and "T_sink=90.0" in stirling["reason"]


def test_find_integration_takes_first_point_if_it_covers_the_hot_utility():
    h = hpi(None)
    h.step_size_temp = 0.5
    h.table_issp = {"Temp": [80.0, 79.0, 78.0], "COP": [5, 4, 3],
                    "QQuelle": [10, 20, 30], "QSenke": [25, 22, 21]}

    h.gcc_draw = {"H": [20.0]}  # first point already delivers 25 >= 20
    h.find_integration()
    assert h.integration_point["QSenke"] == [25] and h.integration_point["COP"] == [5]

    # Otherwise the converged answer is the last point of the walk.
    h.gcc_draw = {"H": [40.0]}
    h.find_integration()
    assert h.integration_point["QSenke"] == [21] and h.integration_point["Temp"][-1] == 78.0


def test_find_integration_with_an_empty_walk_reports_nothing():
    h = hpi(None)
    h.table_issp = {"Temp": [], "COP": [], "QQuelle": [], "QSenke": []}
    h.find_integration()
    assert h.integration_point["Temp"] == []


def _textbook_hpi():
    """HeatPumpIntegration wired to the textbook problem's net-load profiles."""
    from app.modules.pinch_main import PinchMain
    from app.modules.utility.heat_profiles import resolve_profiles
    import csv
    import os
    import tempfile

    streams = [(2, 20, 135), (3, 170, 60), (4, 80, 140), (1.5, 150, 30)]
    with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False, newline="") as f:
        w = csv.writer(f)
        w.writerow(["Tmin", 10])
        w.writerow(["CP", "TSUPPLY", "TTARGET"])
        w.writerows(streams)
    try:
        pm = PinchMain(f.name, options={})
        pm.solve_pinch_for_hpi("EN")
        h = HeatPumpIntegration(f.name, None, pm)
        h.gcc_draw = pm.pinch_analyse.grand_composite_curve
        h.gcc_source, h.gcc_sink = resolve_profiles(pm.pinch_analyse, h, "net_load")
        return h
    finally:
        os.unlink(f.name)


def test_integration_walk_covers_the_hot_utility_with_carnot_cop():
    """Net-load profile of the textbook problem: the sink is the 20 kW hot
    utility and the source is 2.5 kW/K below the 85 degC pinch. The iteration
    must converge on a pump that delivers exactly that 20 kW (the table rounds
    to whole kW), whose source heat lies on the profile and whose COP is the
    50 % Carnot value for the temperatures it reports."""
    h = _textbook_hpi()
    h.integrate_heat_pump_specific("Carnot")
    h.find_integration()

    t_source = h.integration_point["Temp"][-1]
    cop = h.integration_point["COP"][-1]
    q_source = h.integration_point["QQuelle"][-1]
    q_sink = h.integration_point["QSenke"][-1]

    assert q_sink == 20
    assert q_source == pytest.approx(2.5 * (85 - t_source), abs=0.5)
    assert cop == pytest.approx(carnot_cop(h.t_sink_out, h.t_sink_out - t_source), abs=1e-3)
    assert q_sink == pytest.approx(q_source * cop / (cop - 1), abs=1.0)


def test_specific_integration_restores_cop_even_when_the_technology_is_out_of_range():
    """The wrapper that pins the technology must not stay on the instance, or the
    next caller would silently keep evaluating the same one."""
    h = _textbook_hpi()
    with pytest.raises(HeatPumpOutOfRange):
        h.integrate_heat_pump_specific("Prototypical Stirling")  # sink is ~98 degC, needs 144
    assert "COP" not in vars(h)
    assert h.selected_hp_type == "Prototypical Stirling"
