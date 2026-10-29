"""The grid search: every refrigerant and archetype against every source and
sink temperature, keeping the points where source heat and demand balance."""

from __future__ import annotations
import os
import numpy as np

from app.models.analysis import (
    PinchResult,
    HPIOptimizationRequest,
    HPIOptimizationResult,
    HPIOptimizationDiagnostics,
    OptimizedIntegrationPoint,
)
from app.config_optimization import OPTIMIZATION_CONFIG
from app.services import cop_training
from app.services.cop_training import model as trained
from app.modules.pinch.streams import write_streams_csv
from app.services.optimization.alternatives import (
    _calculation_details,
    _formula_alternative,
    _four_temperature_alternatives,
    _load_model_and_data,
    _pin_carnot,
    _theoretical_alternatives,
)
from app.services.optimization.diagnostics import MIN_COVERAGE, _diagnostic_messages
from app.services.optimization.profiles import (
    _make_temperature_grid,
    _prepare_xy_curve,
    _shift,
    _unrecovered_heat,
)


def run_hpi_optimization(request: HPIOptimizationRequest | PinchResult) -> HPIOptimizationResult:
    # Accept a bare PinchResult as well, so older callers keep working.
    cop_formula = None
    custom_model = None
    cop_model = "4t"
    recovery_pct = 100.0
    lang = "en"
    if isinstance(request, HPIOptimizationRequest):
        pinch = request.pinch_result
        profile_mode = request.profile_mode
        cop_formula = request.cop_formula
        custom_model = request.custom_cop_model
        cop_model = request.cop_model
        recovery_pct = request.recovery_pct
        lang = request.lang
    else:
        pinch = request
        profile_mode = "net_load"
    # Partial recovery only makes sense on the GCC; "composite" is 0 % already.
    d = _unrecovered_heat(pinch, recovery_pct) if profile_mode == "net_load" else 0.0
    original_gcc = _shift(
        {"H": pinch.grand_composite_curve.get("H", []), "T": pinch.grand_composite_curve.get("T", [])}, d
    )

    _, alternatives = _load_model_and_data()
    if cop_model == "4t":
        alternatives = _four_temperature_alternatives(alternatives, pinch)
        half = float(pinch.T_min) / 2.0
        extra_temps = {
            "T_vorlauf_quelle": float(pinch.pinch_temperature) - half,
            "T_ruecklauf_senke": float(pinch.pinch_temperature) + half,
        }
    else:
        extra_temps = {}

    # The technology archetypes ride through the same grid as the trained
    # refrigerants so both end up in one table and one chart.
    alternatives = list(alternatives) + _theoretical_alternatives()
    alternatives = _pin_carnot(alternatives, pinch)

    # A user formula is appended as one more alternative rather than replacing
    # the model, so it lands in the same table and chart and can be compared
    # against the trained refrigerants directly.
    if cop_formula is not None and cop_formula.enabled and cop_formula.expression.strip():
        # _load_model_and_data caches its list; copy before appending so the
        # custom entry does not leak into the next request.
        alternatives = list(alternatives) + [_formula_alternative(cop_formula)]

    # A model trained on the user's data, unless the module is switched off.
    if custom_model is not None and custom_model.enabled and cop_training.ENABLED:
        alternatives = list(alternatives) + trained.alternatives(
            custom_model, pinch, OPTIMIZATION_CONFIG["deltaT_evap"], OPTIMIZATION_CONFIG["deltaT_cond"],
            trained.describe,
        )

    # Reconstruct Pinch for HPI
    csv_path = write_streams_csv(pinch.T_min, ((sd["cp"], sd["ts"], sd["tt"]) for sd in pinch.streams_data))
    try:
        from app.modules.pinch_main import PinchMain
        from app.modules.heat_pump_integration.heat_pump_integration import HeatPumpIntegration
        from app.modules.utility.heat_profiles import resolve_profiles

        # Pinch draws its matplotlib charts whenever a "draw" key is present,
        # whatever its value, so pass none: nothing here shows them.
        pm = PinchMain(csv_path, options={})
        pm.solve_pinch_for_hpi("EN")

        hpi = HeatPumpIntegration(csv_path, None, pm)
        hpi.gcc_draw = pm.pinch_analyse.grand_composite_curve
        hpi.gcc_source, hpi.gcc_sink = resolve_profiles(
            pm.pinch_analyse, hpi, profile_mode
        )
        if d:
            hpi.gcc_source, hpi.gcc_sink = _shift(hpi.gcc_source, d), _shift(hpi.gcc_sink, d)

        # Extract the source/sink curves for the selected profile mode
        src_T_raw = np.array(hpi.gcc_source['T'])
        src_H_raw = np.array(hpi.gcc_source['H'])
        t_source_clean, q_avail_clean = _prepare_xy_curve(src_T_raw, src_H_raw, is_source=True)

        sink_T_raw = np.array(hpi.gcc_sink['T'])
        sink_H_raw = np.array(hpi.gcc_sink['H'])
        t_sink_clean, q_demand_clean = _prepare_xy_curve(sink_T_raw, sink_H_raw, is_source=False)

        if len(t_source_clean) == 0 or len(t_sink_clean) == 0:
            missing = "source" if len(t_source_clean) == 0 else "sink"
            return HPIOptimizationResult(
                feasible_points=[],
                max_q_point=None,
                original_gcc=original_gcc,
                profile_mode=profile_mode,
                diagnostics=HPIOptimizationDiagnostics(messages=[
                    f"The {missing} profile is empty — there is no "
                    f"{'waste heat' if missing == 'source' else 'heat demand'} to integrate a heat pump with."
                ]),
            )

        step = OPTIMIZATION_CONFIG["step_size"]
        source_grid = _make_temperature_grid(t_source_clean.min(), t_source_clean.max(), step)
        source_grid = np.unique(np.concatenate([source_grid, t_source_clean]))
        
        sink_grid = _make_temperature_grid(t_sink_clean.min(), t_sink_clean.max(), step)
        sink_grid = np.unique(np.concatenate([sink_grid, t_sink_clean]))

        T_quelle_mesh, T_senke_mesh = np.meshgrid(source_grid, sink_grid, indexing='ij')
        T_quelle_flat = T_quelle_mesh.ravel()
        T_senke_flat = T_senke_mesh.ravel()

        q_avail_flat = np.interp(T_quelle_flat, t_source_clean, q_avail_clean)
        q_demand_flat = np.interp(T_senke_flat, t_sink_clean, q_demand_clean)

        feasible_points = []

        diag = HPIOptimizationDiagnostics(
            source_T_min=float(t_source_clean.min()),
            source_T_max=float(t_source_clean.max()),
            source_Q_max=float(np.max(q_avail_clean)),
            sink_T_min=float(t_sink_clean.min()),
            sink_T_max=float(t_sink_clean.max()),
            sink_Q_max=float(np.max(q_demand_clean)),
            model_T_source_min=float(min(a["T_src_min"] for a in alternatives)),
            model_T_sink_min=float(min(a["T_sink_min"] for a in alternatives)),
        )

        for alt in alternatives:
            # COP over the entire grid, from the model or from a user formula —
            # both expose the same (t_source, t_sink) -> array signature.
            T_quelle_model = T_quelle_flat - alt["deltaT_evap"]
            T_senke_model = T_senke_flat + alt["deltaT_cond"]

            # Only where this machine can run: the loop below rejects every other
            # point before it looks at the COP, and the model is most of the
            # request's time. Every COP source is row-wise, so the values
            # predicted are the same as over the whole grid.
            usable = (
                (T_senke_model >= alt["T_sink_min"]) & (T_senke_model <= alt["T_sink_max"])
                & (T_quelle_model >= alt["T_src_min"]) & (T_quelle_model <= alt["T_src_max"])
                & (T_quelle_flat <= T_senke_flat - 10.0)
            )
            cop_preds = np.full(T_quelle_flat.shape, -1.0)
            if usable.any():
                cop_preds[usable] = np.asarray(
                    alt["cop_fn"](T_quelle_model[usable], T_senke_model[usable]), dtype=float)

            # A formula can return NaN/inf where it is undefined (zero lift, a
            # log of a negative number). Those must never look feasible.
            cop_preds = np.where(np.isfinite(cop_preds), cop_preds, -1.0)

            # We want to find points where q_src_req == q_avail.
            # For each unique T_sink, find the T_source that satisfies this.
            unique_t_sinks = np.unique(T_senke_flat)
            
            for t_snk in unique_t_sinks:
                diag.candidates_total += 1
                t_senke_model = t_snk + alt["deltaT_cond"]
                if t_senke_model < alt["T_sink_min"] or t_senke_model > alt["T_sink_max"]:
                    diag.rejected_sink_range += 1
                    continue

                # Extract the 1D slice for this T_sink
                mask = (T_senke_flat == t_snk)
                t_src_slice = T_quelle_flat[mask]
                q_avail_slice = q_avail_flat[mask]
                q_dem = q_demand_flat[mask][0]  # constant for this t_snk
                cop_slice = cop_preds[mask]

                if q_dem <= 0.0:
                    diag.rejected_no_demand += 1
                    continue

                # We need q_src_req = q_dem * (cop - 1) / cop
                # We find where q_avail_slice - q_src_req crosses 0
                t_src_model_slice = t_src_slice - alt["deltaT_evap"]
                valid_mask = (cop_slice > 1.0) & (cop_slice >= alt["cop_min"]) & (cop_slice <= alt["cop_max"]) & (t_src_slice <= t_snk - 10.0) & (t_src_model_slice >= alt["T_src_min"]) & (t_src_model_slice <= alt["T_src_max"])
                if not np.any(valid_mask):
                    diag.rejected_source_range += 1
                    continue

                t_src_valid = t_src_slice[valid_mask]
                q_avail_valid = q_avail_slice[valid_mask]
                cop_valid = cop_slice[valid_mask]
                q_src_req_valid = q_dem * (cop_valid - 1.0) / cop_valid

                diff = q_avail_valid - q_src_req_valid

                # Find zero crossings
                crossings = np.where(np.diff(np.sign(diff)))[0]

                found_full = False
                for idx in crossings:
                    # Linear interpolation to find the exact T_source
                    t1, t2 = t_src_valid[idx], t_src_valid[idx+1]
                    d1, d2 = diff[idx], diff[idx+1]

                    if d1 == d2:
                        continue

                    fraction = -d1 / (d2 - d1)
                    t_src_exact = t1 + fraction * (t2 - t1)
                    cop_exact = cop_valid[idx] + fraction * (cop_valid[idx+1] - cop_valid[idx])
                    q_avail_exact = q_avail_valid[idx] + fraction * (q_avail_valid[idx+1] - q_avail_valid[idx])

                    # Double check constraints
                    if cop_exact < alt["cop_min"] or cop_exact > alt["cop_max"] or t_src_exact > t_snk - 10.0:
                        continue

                    pt = OptimizedIntegrationPoint(
                        T_source=float(t_src_exact),
                        T_sink=float(t_snk),
                        Q_source=float(q_avail_exact),
                        Q_demand=float(q_dem),
                        Q_demand_total=float(q_dem),
                        source_limited=False,
                        COP=float(cop_exact),
                        refrigerant=alt["name"],
                        medium_sink=alt["medium_sink"],
                        refrigerant_type=alt["refrigerant_type"],
                        hp_level=alt["hp_level"],
                        theoretical=alt.get("theoretical", False),
                        calculation_details=_calculation_details(alt, t_src_exact, t_snk),
                        **(extra_temps if alt.get("four_t") else {}),
                    )
                    feasible_points.append(pt)
                    found_full = True
                    diag.accepted_full += 1

                if found_full:
                    continue

                # No exact match between available source heat and what the full
                # sink requirement would draw. That does not make the heat pump
                # impossible — it only means it cannot cover the whole demand
                # above T_sink (source-limited) or that source heat is abundant
                # (demand-limited). Report the best such operating point instead
                # of dropping the candidate silently.
                q_sink_possible = q_avail_valid * cop_valid / (cop_valid - 1.0)
                q_sink_achievable = np.minimum(q_sink_possible, q_dem)

                if not np.any(q_sink_achievable > 0.0):
                    diag.rejected_no_source_heat += 1
                    continue

                # Best = most heat delivered; ties (e.g. everything capped at the
                # full demand) go to the higher COP.
                best_duty = float(np.max(q_sink_achievable))
                tie = np.isclose(q_sink_achievable, best_duty, rtol=1e-9, atol=1e-9)
                idx = int(np.flatnonzero(tie)[np.argmax(cop_valid[tie])])

                q_sink_best = float(q_sink_achievable[idx])
                cop_best = float(cop_valid[idx])
                limited = q_sink_best < q_dem - 1e-6

                # A heat pump covering a fraction of a percent of the demand is
                # not a design option — keep it out of the result set, but count
                # it so the omission stays visible.
                if limited and q_sink_best < MIN_COVERAGE * q_dem:
                    diag.dropped_negligible += 1
                    continue

                pt = OptimizedIntegrationPoint(
                    T_source=float(t_src_valid[idx]),
                    T_sink=float(t_snk),
                    Q_source=float(q_sink_best * (cop_best - 1.0) / cop_best),
                    Q_demand=q_sink_best,
                    Q_demand_total=float(q_dem),
                    source_limited=limited,
                    # Reaching this branch without being source-limited means the
                    # duty was capped at the sink demand while source heat was
                    # still available, so the point sits off the source profile.
                    demand_limited=not limited,
                    COP=cop_best,
                    refrigerant=alt["name"],
                    medium_sink=alt["medium_sink"],
                    refrigerant_type=alt["refrigerant_type"],
                    hp_level=alt["hp_level"],
                    theoretical=alt.get("theoretical", False),
                    calculation_details=_calculation_details(
                        alt, float(t_src_valid[idx]), t_snk
                    ),
                    **(extra_temps if alt.get("four_t") else {}),
                )
                feasible_points.append(pt)
                if limited:
                    diag.accepted_source_limited += 1
                else:
                    diag.accepted_demand_limited += 1

        # The default pump, the one the chart boxes and economics prices when
        # nothing is clicked: a real machine on both profiles (archetypes are
        # yardsticks, limited points sit off a curve), most duty, then COP.
        on_profile = [p for p in feasible_points if not p.source_limited and not p.demand_limited] or feasible_points
        max_q_point = max([p for p in on_profile if not p.theoretical] or on_profile,
                          key=lambda p: (p.Q_demand, p.COP), default=None)

        diag.messages = _diagnostic_messages(diag, len(feasible_points), lang)

        return HPIOptimizationResult(
            feasible_points=feasible_points,
            max_q_point=max_q_point,
            original_gcc=original_gcc,
            pocketless_source={"H": q_avail_clean.tolist(), "T": t_source_clean.tolist()},
            pocketless_sink={"H": q_demand_clean.tolist(), "T": t_sink_clean.tolist()},
            profile_mode=profile_mode,
            diagnostics=diag,
        )
    finally:
        os.unlink(csv_path)
