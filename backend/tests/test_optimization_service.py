"""Unit tests for the heat pump optimisation (app/services/optimization_service.py).

The optimiser normally runs through the trained COP model, whose numbers are
only pinned loosely (see test_golden.py). Here the model is replaced by a
constant-COP stub so every expected value can be worked out on paper.

Reference problem, used by most tests below (textbook problem, dTmin = 10 K,
the same streams as test_golden.TEXTBOOK):

    pocket-free source (below the pinch):  85 degC -> 0 kW, 61 degC -> 60 kW,
                                           i.e. Q_avail(T) = 2.5 * (85 - T)
    pocket-free sink   (above the pinch):  85 degC -> 0 kW, 98.33 degC -> 20 kW,
                                           i.e. Q_dem(T)   = 1.5 * (T - 85)

A heat pump with COP c that must deliver Q_dem needs Q_dem * (c - 1) / c from
the source, so a "full" point is where that equals Q_avail.
"""

import json

import numpy as np
import pytest

from app.models.analysis import (
    CopFormulaSpec,
    HPIOptimizationDiagnostics,
    HPIOptimizationRequest,
    PinchRequest,
    PinchStream,
)
from app.services import optimization_service as opt
from app.services.analysis_service import run_pinch
from app.utils.cop_formula import FormulaError

# (CP, T_supply, T_target)
TEXTBOOK = [(2, 20, 135), (3, 170, 60), (4, 80, 140), (1.5, 150, 30)]
# Hot 100->20 at 1 kW/K against a cold 50->60 at 10 kW/K: plenty of demand,
# very little waste heat (40 kW below the pinch at 55 degC, 60 kW above).
SMALL_SOURCE = [(1, 100, 20), (10, 50, 60)]
TINY_SOURCE = [(0.1, 100, 20), (10, 50, 60)]
# Hot stream 150->50 (200 kW) against cold 20->120 (150 kW): no hot utility.
THRESHOLD = [(2, 150, 50), (1.5, 20, 120)]


def make_alt(cop=3.0, **overrides):
    """An alternative shaped like the ones the loader builds, with a stub COP."""
    alt = {
        "name": "stub", "Kältemittel_stufen": "stub", "medium_sink": "water",
        "refrigerant_type": "Natural", "hp_level": "1",
        "T_src_min": -100.0, "T_src_max": 500.0,
        "T_sink_min": -100.0, "T_sink_max": 500.0,
        "cop_min": 1.0, "cop_max": 15.0,
        "deltaT_evap": 0.0, "deltaT_cond": 0.0,
        "cop_fn": lambda t_src, t_snk: np.full(len(t_src), float(cop)),
    }
    alt.update(overrides)
    return alt


def pinch_of(streams, t_min=10):
    return run_pinch(PinchRequest(
        streams=[PinchStream(name=str(i), CP=c, T_supply=a, T_target=b)
                 for i, (c, a, b) in enumerate(streams)],
        T_min=t_min,
    ))


def run(streams, alts, monkeypatch, **request_kw):
    """Run the optimiser on `streams` against exactly the stub `alts`."""
    monkeypatch.setattr(opt, "_load_model_and_data", lambda: (None, alts))
    monkeypatch.setattr(opt, "_theoretical_alternatives", lambda: [])
    request = HPIOptimizationRequest(pinch_result=pinch_of(streams), **request_kw)
    return opt.run_hpi_optimization(request)


# --- pure helpers -------------------------------------------------------------

def test_prepare_xy_curve_drops_non_finite_points():
    """NaN/inf from an upstream division must not reach np.interp."""
    x, y = opt._prepare_xy_curve([1, 2, np.nan, 4, 5], [10, np.inf, 30, 40, 50])
    assert x.tolist() == [1, 4, 5]
    assert y.tolist() == [10, 40, 50]


def test_prepare_xy_curve_empty_input_gives_empty_arrays():
    x, y = opt._prepare_xy_curve([np.nan], [1.0])
    assert len(x) == 0 and len(y) == 0


def test_prepare_xy_curve_makes_x_strictly_increasing():
    """np.interp needs strictly increasing x; vertical steps (equal T, two duties)
    get a 1e-6 K nudge. The source keeps the larger duty first, the sink the
    smaller, so the curve stays monotone in the direction each side expects."""
    xs, ys = opt._prepare_xy_curve([70, 70, 80], [5, 9, 12], is_source=True)
    assert ys.tolist() == [9, 5, 12]
    assert np.all(np.diff(xs) > 0) and xs[1] - xs[0] == pytest.approx(1e-6)

    xk, yk = opt._prepare_xy_curve([70, 70, 80], [9, 5, 12], is_source=False)
    assert yk.tolist() == [5, 9, 12]
    assert np.all(np.diff(xk) > 0)


def test_temperature_grid_includes_both_ends_and_reversed_range_is_empty():
    assert opt._make_temperature_grid(60.0, 61.0, 0.5).tolist() == [60.0, 60.5, 61.0]
    # A range that is not a multiple of the step still ends on the last full step.
    assert opt._make_temperature_grid(0.0, 1.2, 0.5).tolist() == [0.0, 0.5, 1.0]
    assert len(opt._make_temperature_grid(5.0, 4.0)) == 0


def test_calculation_details_formula_regression_and_failure():
    """Archetypes show their published formula, trained refrigerants a plain
    statement; a broken formula must never fail the analysis."""
    seen = {}

    def formula(t_sink, dt):
        seen["args"] = (t_sink, dt)
        return "COP = ..."

    assert opt._calculation_details({"formula_fn": formula}, 60.0, 90.0) == "COP = ..."
    assert seen["args"] == (90.0, 30.0)  # the formula takes (T_sink, lift)

    text = opt._calculation_details(
        {"name": "R600", "medium_sink": "water", "hp_level": "2"}, 60.0, 90.0)
    assert "R600" in text and "T_source = 60.0" in text and "T_sink = 90.0" in text

    def broken(t_sink, dt):
        raise ZeroDivisionError

    assert opt._calculation_details({"formula_fn": broken}, 60.0, 90.0) is None


def test_formula_alternative_wraps_a_user_expression():
    spec = CopFormulaSpec(expression="0.5 * (T_sink + 273.15) / T_lift",
                          T_source_min=10, T_source_max=90, T_sink_min=40,
                          T_sink_max=120, cop_min=1.5, cop_max=9)
    alt = opt._formula_alternative(spec)

    assert alt["name"] == "Custom formula"
    assert alt["refrigerant_type"] == "Custom formula"
    assert (alt["T_src_min"], alt["T_src_max"]) == (10.0, 90.0)
    assert (alt["T_sink_min"], alt["T_sink_max"]) == (40.0, 120.0)
    assert (alt["cop_min"], alt["cop_max"]) == (1.5, 9.0)
    # 0.5 * 373.15 / 50 = 3.7315 -- the optimiser calls cop_fn(source, sink)
    cop = alt["cop_fn"](np.array([50.0]), np.array([100.0]))
    assert cop[0] == pytest.approx(3.7315)


def test_formula_alternative_rejects_unsafe_expression():
    with pytest.raises(FormulaError):
        opt._formula_alternative(CopFormulaSpec(expression="__import__('os')"))


def test_theoretical_cop_is_minus_one_where_the_correlation_is_undefined():
    """Carnot has a zero-lift window edge (dt_min = 0): COP there is a division
    by zero, which must come back as -1 so the optimiser drops it."""
    carnot = next(a for a in opt._theoretical_alternatives() if a["name"] == "Carnot")
    cop = carnot["cop_fn"](np.array([80.0, 60.0]), np.array([80.0, 100.0]))
    assert cop[0] == -1.0
    assert cop[1] == pytest.approx(0.5 * 373.15 / 40.0)


@pytest.mark.xfail(strict=True, reason=(
    "optimization_service.py:479 finds zero crossings with np.diff(np.sign(diff)). "
    "When diff is exactly 0 at a grid node (COP 2 on the textbook problem: 10 kW "
    "needed, 10 kW available at 81.0 degC) the sign goes +1 -> 0 -> -1, which is two "
    "'crossings' of the same root, so the identical point is reported twice and "
    "accepted_full is inflated."))
def test_exact_zero_on_a_grid_node_is_reported_once(monkeypatch):
    r = run(TEXTBOOK, [make_alt(2.0)], monkeypatch)
    keys = [(round(p.T_sink, 6), round(p.T_source, 6)) for p in r.feasible_points
            if not p.demand_limited]
    assert len(keys) == len(set(keys))


@pytest.mark.xfail(strict=True, reason=(
    "optimization_service.py:249 builds the grid with np.arange(T_min, T_max + step/2, "
    "step), which overshoots T_max by up to half a step (1.3 -> ends at 1.5). The "
    "optimiser then evaluates, and reports, sink temperatures above the top of the "
    "sink profile (98.5 degC on a profile that ends at 98.33 degC)."))
def test_temperature_grid_never_exceeds_the_upper_limit():
    assert opt._make_temperature_grid(0.0, 1.3, 0.5).max() <= 1.3


# --- diagnostics messages -----------------------------------------------------

def diag(**kw):
    return HPIOptimizationDiagnostics(**kw)


def test_messages_name_the_binding_constraint_when_nothing_is_found():
    cold = opt._diagnostic_messages(diag(source_T_max=40, model_T_source_min=55), 0)
    assert len(cold) == 1 and cold[0].startswith("Source too cold")
    assert "40.0" in cold[0] and "55.0" in cold[0]

    sink = opt._diagnostic_messages(diag(sink_T_max=50, model_T_sink_min=70), 0)
    assert sink[0].startswith("Sink too cold")

    none_fit = opt._diagnostic_messages(diag(source_T_max=90, model_T_source_min=55), 0)
    assert none_fit == [
        "No refrigerant in the COP model can operate between this source and "
        "sink temperature range."
    ]

    no_heat = opt._diagnostic_messages(diag(rejected_no_source_heat=3), 0)
    assert no_heat[0].startswith("No usable source heat")

    no_demand = opt._diagnostic_messages(
        diag(candidates_total=4, rejected_no_demand=4), 0)
    assert any("No heat demand above the pinch" in m for m in no_demand)


def test_messages_report_negligible_drops_and_stay_quiet_on_success():
    dropped = opt._diagnostic_messages(diag(dropped_negligible=7), 0)
    assert "7 operating points were dropped" in dropped[0] and "1 %" in dropped[0]

    # Full-coverage points only: nothing to warn about.
    assert opt._diagnostic_messages(diag(accepted_full=5), 5) == []


def test_messages_distinguish_source_limited_and_demand_limited_points():
    msgs = opt._diagnostic_messages(
        diag(accepted_source_limited=2, accepted_demand_limited=1, dropped_negligible=4), 6)
    assert msgs[0].startswith("2 of 6 operating points are source-limited")
    assert "A further 4 were dropped" in msgs[0]
    assert msgs[1].startswith("1 of 6 operating points are demand-limited")


def test_messages_flag_a_sink_range_that_rejects_every_candidate():
    msgs = opt._diagnostic_messages(diag(
        candidates_total=10, rejected_sink_range=10,
        sink_T_min=60, sink_T_max=70, model_T_sink_min=200), 0)
    assert any(m.startswith("Every candidate was rejected on the sink temperature range")
               for m in msgs)


# --- the model/ranges loader --------------------------------------------------

class _DummyModel:
    """Stands in for the regressor: COP = sink - source, so the call is visible."""

    def predict(self, X):
        self.columns = list(X.columns)
        return (X["T_Vorlauf_Senke"] - X["T_Rücklauf_Quelle"]).to_numpy()


ENTRY = {
    "name": "R1234", "Kältemittel_stufen": "R1234", "medium_sink": "water",
    "refrigerant_type": "Synthetic", "hp_level": "1",
    "T_src_min": "10", "T_src_max": "80", "T_sink_min": "40", "T_sink_max": "120",
    "cop_min": "2", "cop_max": "9",
}


@pytest.fixture
def fresh_loader(monkeypatch, tmp_path):
    """Point the loader at tmp files and clear its module-level cache."""
    monkeypatch.setattr(opt, "_model_cache", None)
    monkeypatch.setattr(opt, "_alternatives_cache", None)
    config = dict(opt.OPTIMIZATION_CONFIG,
                  model_path=str(tmp_path / "model.joblib"),
                  ranges_path=str(tmp_path / "ranges.json"))
    monkeypatch.setattr(opt, "OPTIMIZATION_CONFIG", config)
    return tmp_path


def test_loader_builds_alternatives_from_the_ranges_file(fresh_loader, monkeypatch):
    monkeypatch.setattr(opt.joblib, "load", lambda path: _DummyModel())
    (fresh_loader / "model.joblib").write_bytes(b"")
    (fresh_loader / "ranges.json").write_text(json.dumps({"alternatives": [ENTRY]}))

    model, alts = opt._load_model_and_data()

    assert len(alts) == 1
    alt = alts[0]
    # Strings in the file become numbers; the approaches come from the config.
    assert alt["T_src_min"] == 10.0 and alt["cop_max"] == 9.0
    assert alt["deltaT_evap"] == opt.OPTIMIZATION_CONFIG["deltaT_evap"]
    cop = alt["cop_fn"](np.array([50.0, 60.0]), np.array([90.0, 100.0]))
    assert cop.tolist() == [40.0, 40.0]
    assert model.columns == ["T_Rücklauf_Quelle", "T_Vorlauf_Senke",
                             "Medium_Senke", "Kältemittel_stufen"]
    # Second call is served from the cache without touching the files again.
    assert opt._load_model_and_data()[1] is alts


def test_loader_errors_name_the_problem(fresh_loader, monkeypatch):
    monkeypatch.setattr(opt.joblib, "load", lambda path: _DummyModel())

    with pytest.raises(FileNotFoundError, match="Model file not found"):
        opt._load_model_and_data()

    (fresh_loader / "model.joblib").write_bytes(b"")
    with pytest.raises(FileNotFoundError, match="COP ranges file not found"):
        opt._load_model_and_data()

    (fresh_loader / "ranges.json").write_text(json.dumps({"alternatives": []}))
    with pytest.raises(ValueError, match="contains no alternatives"):
        opt._load_model_and_data()

    broken = {k: v for k, v in ENTRY.items() if k != "cop_max"}
    (fresh_loader / "ranges.json").write_text(json.dumps([broken]))  # bare list also accepted
    with pytest.raises(ValueError, match="cop_max"):
        opt._load_model_and_data()


# --- the optimisation loop (stub COP, hand-checked numbers) --------------------

@pytest.mark.parametrize("cop, t_source", [(3.0, 85 - 20 / 3 / 2.5 * 2), (2.5, 80.2)])
def test_full_coverage_point_sits_on_the_source_profile(cop, t_source, monkeypatch):
    """At the hottest sink (98.33 degC, 20 kW demand) the source must supply
    20 * (c-1)/c kW, found where 2.5 * (85 - T) equals that:
    c = 3 -> 13.33 kW at 79.67 degC;  c = 2.5 -> 12 kW at 80.2 degC."""
    r = run(TEXTBOOK, [make_alt(cop)], monkeypatch)

    top = r.max_q_point
    assert top.T_sink == pytest.approx(85 + 20 / 1.5)
    assert top.Q_demand == pytest.approx(20.0) and top.Q_demand_total == pytest.approx(20.0)
    assert top.COP == pytest.approx(cop)
    assert top.Q_source == pytest.approx(20 * (cop - 1) / cop)
    assert top.T_source == pytest.approx(t_source)
    assert not top.source_limited

    # Every exact point obeys the duty relation and lies on the source line.
    exact = [p for p in r.feasible_points if not p.demand_limited]
    assert exact
    for p in exact:
        assert p.Q_source == pytest.approx(p.Q_demand * (cop - 1) / cop)
        assert p.Q_source == pytest.approx(2.5 * (85 - p.T_source))

    d = r.diagnostics
    assert d.accepted_full == len(exact) and d.rejected_no_demand == 1  # T_sink = 85: no demand
    assert d.candidates_total == len(exact) + d.accepted_demand_limited + 1


def test_cop_of_one_or_less_is_never_feasible(monkeypatch):
    """COP <= 1 would need more source heat than sink heat. Discarded outright."""
    for cop in (1.0, 0.5, -1.0):
        r = run(TEXTBOOK, [make_alt(cop)], monkeypatch)
        assert r.feasible_points == [] and r.max_q_point is None
        assert r.diagnostics.rejected_source_range == r.diagnostics.candidates_total - 1
        assert r.diagnostics.messages  # an empty result always explains itself


def test_non_finite_cop_is_treated_as_infeasible(monkeypatch):
    """A user formula can return NaN/inf (zero lift, log of a negative)."""
    def cop_fn(t_src, t_snk):
        out = np.full(len(t_src), 3.0)
        out[::2] = np.nan
        out[1::4] = np.inf
        return out

    r = run(TEXTBOOK, [make_alt(cop_fn=cop_fn)], monkeypatch)
    assert all(np.isfinite(p.COP) and p.COP == pytest.approx(3.0) for p in r.feasible_points)


def test_cop_envelope_cop_min_and_cop_max_are_enforced(monkeypatch):
    assert run(TEXTBOOK, [make_alt(3.0, cop_min=3.5)], monkeypatch).feasible_points == []
    assert run(TEXTBOOK, [make_alt(3.0, cop_max=2.5)], monkeypatch).feasible_points == []


def test_source_window_gives_a_source_limited_point(monkeypatch):
    """Small waste heat, big demand. Hot 100->20 at 1 kW/K against a cold stream
    50->60 at 10 kW/K: the source line is Q = 55 - T (kW, 55 degC at the pinch).
    A pump that only accepts sources >= 50 degC (and sources must be 10 K below
    the sink) can draw at most 5 kW, so with COP 3 it delivers 5 * 3/2 = 7.5 kW,
    however large the demand is."""
    r = run(SMALL_SOURCE, [make_alt(3.0, T_src_min=50.0)], monkeypatch)

    assert r.feasible_points and all(p.source_limited for p in r.feasible_points)
    for p in r.feasible_points:
        assert p.T_source == pytest.approx(50.0)
        assert p.Q_source == pytest.approx(5.0)
        assert p.Q_demand == pytest.approx(7.5)
        assert p.Q_demand < p.Q_demand_total
    assert r.max_q_point.Q_demand == pytest.approx(7.5)
    assert r.diagnostics.accepted_source_limited == len(r.feasible_points)
    assert r.diagnostics.messages[0].startswith(f"{len(r.feasible_points)} of")

    # The same pump with a higher COP moves more heat: 5 * 15/14 kW.
    r15 = run(SMALL_SOURCE, [make_alt(15.0, T_src_min=50.0)], monkeypatch)
    assert r15.max_q_point.Q_demand == pytest.approx(5 * 15 / 14)


def test_points_covering_under_one_percent_are_dropped_but_counted(monkeypatch):
    """With only 0.1 kW/K of waste heat the pump can cover a sliver of the big
    demand at high sink temperatures. Those are not design options."""
    r = run(TINY_SOURCE, [make_alt(3.0, T_src_min=50.0)], monkeypatch)

    assert r.diagnostics.dropped_negligible > 0
    assert r.feasible_points
    for p in r.feasible_points:
        assert p.Q_demand >= opt.MIN_COVERAGE * p.Q_demand_total
    assert "were dropped" in r.diagnostics.messages[0]


def test_sink_outside_the_pump_range_is_rejected_per_candidate(monkeypatch):
    r = run(TEXTBOOK, [make_alt(3.0, T_sink_min=200.0)], monkeypatch)

    d = r.diagnostics
    assert r.feasible_points == []
    assert d.candidates_total > 0 and d.rejected_sink_range == d.candidates_total
    assert any(m.startswith("Sink too cold") for m in d.messages)
    assert any(m.startswith("Every candidate was rejected") for m in d.messages)


def test_source_heat_that_is_zero_everywhere_in_the_window(monkeypatch):
    """Restricting the pump to sources >= 85 degC leaves only the pinch itself,
    where no waste heat is available."""
    r = run(TEXTBOOK, [make_alt(3.0, T_src_min=85.0)], monkeypatch)

    assert r.feasible_points == []
    assert r.diagnostics.rejected_no_source_heat > 0
    assert r.diagnostics.messages[0].startswith("No usable source heat")


def test_equal_duty_is_decided_by_cop_whatever_the_order(monkeypatch):
    """Two pumps deliver the same maximum duty (the 20 kW hot utility); the one
    reported as 'max' must be the better COP, not the one iterated last."""
    low, high = make_alt(2.0, name="low"), make_alt(3.0, name="high")
    for alts in ([low, high], [high, low]):
        r = run(TEXTBOOK, alts, monkeypatch)
        assert r.max_q_point.refrigerant == "high"
        assert r.max_q_point.Q_demand == pytest.approx(20.0)


def test_threshold_problem_has_no_heat_pump_demand(monkeypatch):
    """No hot utility, so nothing above the pinch for a pump to supply."""
    p = pinch_of(THRESHOLD)
    assert p.hot_utility == pytest.approx(0.0) and p.cold_utility == pytest.approx(50.0)

    r = run(THRESHOLD, [make_alt(3.0)], monkeypatch)
    assert r.feasible_points == [] and r.max_q_point is None
    assert "no heat demand to integrate" in r.diagnostics.messages[0]
    assert r.diagnostics.candidates_total == 0


def test_user_formula_is_one_more_alternative_and_does_not_leak(monkeypatch):
    base = [make_alt(3.0)]
    spec = CopFormulaSpec(expression="3", T_source_min=0, T_source_max=200,
                          T_sink_min=0, T_sink_max=250)
    r = run(TEXTBOOK, base, monkeypatch, cop_formula=spec)

    kinds = {p.refrigerant_type for p in r.feasible_points}
    assert kinds == {"Natural", "Custom formula"}
    assert len(base) == 1  # the loader's cached list is not appended to

    off = CopFormulaSpec(expression="3", enabled=False)
    r = run(TEXTBOOK, base, monkeypatch, cop_formula=off)
    assert {p.refrigerant_type for p in r.feasible_points} == {"Natural"}


def test_bare_pinch_result_is_accepted_and_means_net_load(monkeypatch):
    monkeypatch.setattr(opt, "_load_model_and_data", lambda: (None, [make_alt(3.0)]))
    monkeypatch.setattr(opt, "_theoretical_alternatives", lambda: [])
    p = pinch_of(TEXTBOOK)
    bare = opt.run_hpi_optimization(p)
    wrapped = opt.run_hpi_optimization(HPIOptimizationRequest(pinch_result=p))
    assert bare.profile_mode == "net_load"
    assert bare.max_q_point == wrapped.max_q_point
    assert len(bare.feasible_points) == len(wrapped.feasible_points)
