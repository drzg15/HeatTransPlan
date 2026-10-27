from app.models.analysis import PinchStream, PinchRequest
from pydantic import ValidationError
import pytest

def test_pinch_stream_valid():
    stream = PinchStream(name="Hot Stream 1", CP=10.0, T_supply=100.0, T_target=50.0)
    assert stream.name == "Hot Stream 1"
    assert stream.CP == 10.0
    assert stream.T_supply == 100.0
    assert stream.T_target == 50.0

def test_pinch_stream_invalid_types():
    with pytest.raises(ValidationError):
        # CP must be float (or castable to float)
        PinchStream(name="Invalid", CP="not_a_number", T_supply=100.0, T_target=50.0)

def test_pinch_request_valid():
    req = PinchRequest(
        streams=[
            PinchStream(name="Hot", CP=5.0, T_supply=120.0, T_target=40.0),
            PinchStream(name="Cold", CP=3.0, T_supply=20.0, T_target=100.0)
        ],
        T_min=10.0
    )
    assert len(req.streams) == 2
    assert req.T_min == 10.0


def test_composite_profile_shifting(tmp_path):
    import csv
    from app.modules.pinch_main import PinchMain
    from app.modules.utility.heat_profiles import build_heat_profiles

    csv_file = tmp_path / "test_streams.csv"
    with open(csv_file, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Tmin", 10.0])
        writer.writerow(["CP", "TSUPPLY", "TTARGET"])
        writer.writerow([10.0, 100.0, 40.0]) # Hot stream: ts=100, tt=40 -> shifted: 95, 35
        writer.writerow([5.0, 20.0, 80.0])   # Cold stream: ts=20, tt=80 -> shifted: 25, 85

    pm = PinchMain(str(csv_file))
    pm.solve_pinch_for_hpi()

    source_profile, sink_profile = build_heat_profiles(pm.pinch_analyse, "composite")

    # Hot stream shifted bounds should be 95.0 and 35.0 (100 - 5, 40 - 5)
    assert max(source_profile["T"]) == 95.0
    assert min(source_profile["T"]) == 35.0

    # Cold stream shifted bounds should be 85.0 and 25.0 (80 + 5, 20 + 5)
    assert max(sink_profile["T"]) == 85.0
    assert min(sink_profile["T"]) == 25.0


def test_cop_formula_conditional():
    from app.utils.cop_formula import cop_from_formula

    # Test ternary if/else expression: (0.5 * (T_sink + 273.15) / T_lift) if T_sink <= 100 else (0.4 * (T_sink + 273.15) / T_lift)
    expr = "(0.5 * (T_sink + 273.15) / T_lift) if T_sink <= 100 else (0.4 * (T_sink + 273.15) / T_lift)"
    
    # At T_sink = 90 (<= 100), T_source = 40 (T_lift = 50): 0.5 * 363.15 / 50 = 3.6315
    res1 = cop_from_formula(expr, [40.0], [90.0])
    assert abs(res1[0] - 3.6315) < 1e-4

    # At T_sink = 120 (> 100), T_source = 40 (T_lift = 80): 0.4 * 393.15 / 80 = 1.96575
    res2 = cop_from_formula(expr, [40.0], [120.0])
    assert abs(res2[0] - 1.96575) < 1e-4




# ---------------------------------------------------------------------------
# Theoretical archetypes merged into the optimisation results
# ---------------------------------------------------------------------------

def test_theoretical_alternatives_respect_operating_windows():
    """Archetypes must report COP <= 0 outside their rated sink/lift window.

    The optimiser discards any COP <= 1, so this is what keeps an archetype from
    being extrapolated into a regime its published regression never covered.
    """
    import numpy as np
    from app.services.optimization_service import _theoretical_alternatives
    from app.modules.heat_pump_integration.heat_pump_integration import (
        HP_OPERATING_WINDOWS,
    )

    alts = _theoretical_alternatives()
    assert {a["name"] for a in alts} == set(HP_OPERATING_WINDOWS)

    for alt in alts:
        window = HP_OPERATING_WINDOWS[alt["name"]]
        assert alt["refrigerant_type"] == "Theoretical"
        assert alt["theoretical"] is True

        # Sink below the rated minimum, and a lift under the rated minimum:
        # both are outside the window and must not look feasible.
        t_sink = np.array([window["t_sink_min"] - 10.0, 100.0])
        t_source = np.array([t_sink[0] - 30.0, 100.0 - window["dt_min"] / 2.0])
        cop = np.asarray(alt["cop_fn"](t_source, t_sink), dtype=float)
        assert np.all(cop <= 1.0), f"{alt['name']} reported {cop} outside its window"


def test_theoretical_archetypes_match_the_hpi_correlation():
    """Inside the window an archetype must equal the correlation the HPI panel uses.

    The two panels are only comparable because they evaluate the same function;
    if this drifts, the merged table would rank them against each other wrongly.
    """
    import numpy as np
    from app.services.optimization_service import _theoretical_alternatives
    from app.modules.heat_pump_integration.heat_pump_integration import (
        HP_COP_CORRELATIONS,
        in_operating_window,
    )

    t_sink, t_source = 98.0, 78.0
    lift = t_sink - t_source

    for alt in _theoretical_alternatives():
        if not in_operating_window(alt["name"], t_sink, lift):
            continue
        expected = HP_COP_CORRELATIONS[alt["name"]](t_sink, lift)
        got = float(
            np.asarray(alt["cop_fn"](np.array([t_source]), np.array([t_sink])))[0]
        )
        assert got == pytest.approx(expected, rel=1e-9), alt["name"]


def test_four_temperature_model_holds_the_other_two_at_the_pinch():
    """The 4t model gets Vorlauf Quelle / Rücklauf Senke from the pinch, not the grid."""
    import numpy as np
    from types import SimpleNamespace
    from app.services import optimization_service as svc

    pinch = SimpleNamespace(pinch_temperature=73.0, T_min=10.0)
    seen = {}

    class Spy:
        def predict(self, X):
            seen["X"] = X
            return np.full(len(X), 3.0)

    svc._model_4t_cache = Spy()
    try:
        alt = {"medium_sink": "steam", "Kältemittel_stufen": "R1233zd_2"}
        fn = svc._four_temperature_alternatives([alt], pinch)[0]["cop_fn"]
        cop = fn(np.array([50.0, 55.0]), np.array([100.0, 110.0]))
    finally:
        svc._model_4t_cache = None

    X = seen["X"]
    assert list(cop) == [3.0, 3.0]
    assert set(X["T_Vorlauf_Quelle"]) == {68.0}   # pinch - dTmin/2
    assert set(X["T_Rücklauf_Senke"]) == {78.0}   # pinch + dTmin/2
    assert list(X["T_Rücklauf_Quelle"]) == [50.0, 55.0]
    assert list(X["T_Vorlauf_Senke"]) == [100.0, 110.0]


def test_pinned_carnot_uses_the_non_shifted_sink_and_the_pinch_source():
    """Pinch 73, dTmin 10, sink 113 on the curve: Carnot sees 108 and 68."""
    import numpy as np
    from types import SimpleNamespace
    from app.services.optimization_service import _pin_carnot

    pinch = SimpleNamespace(pinch_temperature=73.0, T_min=10.0)
    alt = {"name": "Carnot", "cop_max": 15.0}
    fn = _pin_carnot([alt], pinch)[0]["cop_fn"]
    cop = fn(np.array([58.2]), np.array([113.0]))[0]
    assert cop == pytest.approx(0.5 * (108.0 + 273.15) / (108.0 - 68.0))


def test_unrecovered_heat_scales_with_recovery_share():
    """d = (1 − p) · (hot duty − minimum cooling): 0 at 100 %, all of it at 0 %."""
    from types import SimpleNamespace
    from app.services.optimization_service import _unrecovered_heat

    pinch = SimpleNamespace(
        streams_data=[
            {"cp": 10, "ts": 150, "tt": 50},  # hot: 1000 kW
            {"cp": 5, "ts": 20, "tt": 120},  # cold
        ],
        cold_utility=300,
    )
    assert _unrecovered_heat(pinch, 100) == 0
    assert _unrecovered_heat(pinch, 0) == 700
    assert _unrecovered_heat(pinch, 40) == 420
