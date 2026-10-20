"""Unit tests for app/services/analysis_service.py (pinch wrapper, heat pump
view, status quo). The end-to-end numbers are pinned in test_golden.py; these
cover the branches that file does not reach."""

import pytest

from app.models.analysis import (
    EnergyDemand,
    HPIRequest,
    PinchRequest,
    PinchStream,
    StatusQuoRequest,
)
from app.services.analysis_service import (
    _exclusion_reason,
    run_hpi,
    run_pinch,
    run_status_quo,
)

TEXTBOOK = [(2, 20, 135), (3, 170, 60), (4, 80, 140), (1.5, 150, 30)]


def textbook_pinch():
    return run_pinch(PinchRequest(
        streams=[PinchStream(name=str(i), CP=c, T_supply=a, T_target=b)
                 for i, (c, a, b) in enumerate(TEXTBOOK)],
        T_min=10,
    ))


def test_run_pinch_labels_each_stream_with_type_and_shifted_temperatures():
    p = textbook_pinch()
    by_ts = {s["ts"]: s for s in p.streams_data}
    # Hot streams are shifted down by dTmin/2 = 5 K, cold ones up.
    assert by_ts[170]["type"] == "HOT" and by_ts[170]["ss"] == 165 and by_ts[170]["st"] == 55
    assert by_ts[20]["type"] == "COLD" and by_ts[20]["ss"] == 25 and by_ts[20]["st"] == 140
    assert p.T_min == 10


def test_status_quo_savings_against_the_pinch_targets():
    """Today 100 kW heating and 50 kW cooling; pinch targets 20 and 60 kW.
    Heating saves 80 kW (80 %); cooling needs 10 kW *more* (-20 %)."""
    r = run_status_quo(StatusQuoRequest(
        current_demands=[EnergyDemand(stream_name="a", heating_kW=60, cooling_kW=50),
                         EnergyDemand(stream_name="b", heating_kW=40)],
        pinch_hot_utility=20, pinch_cold_utility=60,
    ))
    assert (r.total_current_heating, r.total_current_cooling) == (100, 50)
    assert r.heating_savings_kW == 80 and r.heating_savings_pct == 80.0
    assert r.cooling_savings_kW == -10 and r.cooling_savings_pct == -20.0


def test_status_quo_with_no_current_demand_has_zero_percent_not_a_division_error():
    r = run_status_quo(StatusQuoRequest(current_demands=[], pinch_hot_utility=5, pinch_cold_utility=0))
    assert r.heating_savings_pct == 0.0 and r.cooling_savings_pct == 0.0
    assert r.heating_savings_kW == -5


def test_exclusion_reason_names_the_violated_limit():
    below = _exclusion_reason("Prototypical Stirling", 100.0, delta_t=50.0)
    assert "below the minimum of 144" in below and "ΔT" not in below

    above = _exclusion_reason("SHP and HTHPs (R717)", 90.0, delta_t=80.0)
    assert "exceeds the maximum of 85" in above and "exceeds the maximum of 75" in above

    # Both numbers inside their ranges: fall back to printing the whole window.
    assert "Operating window not met" in _exclusion_reason("VHTHP (HFC/HFO)", 100.0, delta_t=50.0)
    assert "Operating window not met" in _exclusion_reason("VHTHP (HFC/HFO)", None)


def test_exclusion_reason_for_carnot_and_unknown_types():
    assert "50% Carnot" in _exclusion_reason("Carnot", 100.0)
    assert _exclusion_reason("Fusion", 100.0) == "Heat pump type unknown."
    assert _exclusion_reason("Fusion", 100.0, exc=ValueError("boom")) == "boom"


def test_hpi_excludes_out_of_range_types_with_reasons_and_keeps_the_rest():
    """Textbook net-load: sink is about 98.3 degC, lift about 16-20 K. The Stirling
    needs a 144 degC sink, R717 at most 85 degC; HFC/HFO (sink 25..100, lift
    10..78) is rated, and the VHTHP's 25 K minimum lift is not met."""
    r = run_hpi(HPIRequest(
        pinch_result=textbook_pinch(),
        hp_types=["Prototypical Stirling", "SHP and HTHPs (R717)", "SHP and HTHPs (HFC/HFO)",
                  "VHTHP (HFC/HFO)"],
    ))

    assert [h.name for h in r.heat_pumps] == ["SHP and HTHPs (HFC/HFO)"]
    hp = r.heat_pumps[0]
    assert hp.t_sink == pytest.approx(85 + 20 / 1.5)
    assert hp.q_sink == 20
    assert hp.cop == pytest.approx(6.372, abs=1e-3)
    assert hp.calculation_details and "1.448e12" in hp.calculation_details

    excluded = {h.name: h.reason for h in r.excluded_heat_pumps}
    assert set(excluded) == {"Prototypical Stirling", "SHP and HTHPs (R717)", "VHTHP (HFC/HFO)"}
    assert "below the minimum of 144" in excluded["Prototypical Stirling"]
    assert "exceeds the maximum of 85" in excluded["SHP and HTHPs (R717)"]
    assert "below the minimum of 25" in excluded["VHTHP (HFC/HFO)"]
    assert [i.feasible for i in r.integrations] == [False, False, True, False]


def test_hpi_reports_an_unknown_type_as_excluded_instead_of_failing():
    r = run_hpi(HPIRequest(pinch_result=textbook_pinch(), hp_types=["Fusion"]))
    assert r.heat_pumps == []
    assert r.excluded_heat_pumps[0].reason == "Unknown heat pump type 'Fusion'."
    assert r.integrations[0].feasible is False


def test_hpi_composite_profile_works_from_the_unrecovered_curves():
    """Composite mode credits no internal recovery, so the sink is the full
    cold composite (145 degC at the top for this problem), not the 20 kW
    hot utility: only Carnot is rated at that sink and lift."""
    r = run_hpi(HPIRequest(pinch_result=textbook_pinch(), hp_types=["Carnot"],
                           profile_mode="composite"))
    assert r.profile_mode == "composite"
    hp = r.heat_pumps[0]
    assert hp.t_sink == pytest.approx(145.0)
    assert hp.q_sink > 20
    assert r.sink_profile["T"] and r.source_profile["T"]
