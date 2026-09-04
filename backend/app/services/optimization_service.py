"""
Optimization service for Heat Pump Integration.
"""
from __future__ import annotations
import os
import csv
import json
import tempfile
import numpy as np
import pandas as pd
import joblib

from app.models.analysis import (
    PinchResult,
    HPIOptimizationRequest,
    HPIOptimizationResult,
    HPIOptimizationDiagnostics,
    OptimizedIntegrationPoint,
)
from app.config_optimization import OPTIMIZATION_CONFIG
from app.utils.cop_formula import (
    FormulaError,
    build_variables,
    compile_formula,
    evaluate_formula,
)

# Smallest share of the demand above T_sink a source-limited heat pump has to
# cover to be worth reporting.
MIN_COVERAGE = 0.01

# Cache the model and alternatives so we don't load them on every request
_model_cache = None
_alternatives_cache = None

def _load_model_and_data():
    global _model_cache, _alternatives_cache
    if _model_cache is not None and _alternatives_cache is not None:
        return _model_cache, _alternatives_cache

    model_path = OPTIMIZATION_CONFIG["model_path"]
    ranges_path = OPTIMIZATION_CONFIG["ranges_path"]

    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found at {model_path}. Make sure it is mounted or copied.")

    _model_cache = joblib.load(model_path)

    if not os.path.exists(ranges_path):
        raise FileNotFoundError(
            f"COP ranges file not found at {ranges_path}. "
            "Regenerate it with cop_analysis/export_cop_ranges.py and commit it."
        )

    with open(ranges_path, encoding="utf-8") as fh:
        payload = json.load(fh)

    entries = payload.get("alternatives") if isinstance(payload, dict) else payload
    if not entries:
        raise ValueError(f"COP ranges file at {ranges_path} contains no alternatives.")

    required = (
        "name", "Kältemittel_stufen", "medium_sink", "refrigerant_type",
        "hp_level", "T_src_min", "T_src_max", "T_sink_min", "T_sink_max",
        "cop_min", "cop_max",
    )

    alts = []
    for entry in entries:
        if missing := [key for key in required if key not in entry]:
            raise ValueError(
                f"Entry {entry.get('name', '?')} in {ranges_path} is missing: {missing}. "
                "Regenerate the file with cop_analysis/export_cop_ranges.py."
            )
        alt = {key: entry[key] for key in required}
        for key in ("T_src_min", "T_src_max", "T_sink_min", "T_sink_max", "cop_min", "cop_max"):
            alt[key] = float(alt[key])
        # The temperature approaches are an operating assumption, not a property
        # of the training data, so they stay in the config.
        alt["deltaT_evap"] = OPTIMIZATION_CONFIG["deltaT_evap"]
        alt["deltaT_cond"] = OPTIMIZATION_CONFIG["deltaT_cond"]
        # Every alternative carries its own COP source. Model-backed ones call
        # the regressor; a user formula supplies its own callable with the same
        # signature, so the optimisation loop below never has to branch.
        alt["cop_fn"] = _model_cop_fn(alt)
        alts.append(alt)

    _alternatives_cache = alts
    return _model_cache, _alternatives_cache


def _model_cop_fn(alt):
    """COP callable backed by the trained regressor, for one alternative."""
    def predict(t_source_model, t_sink_model):
        model, _ = _load_model_and_data()
        X = pd.DataFrame({
            "T_Rücklauf_Quelle": t_source_model,
            "T_Vorlauf_Senke": t_sink_model,
            "Medium_Senke": [alt["medium_sink"]] * len(t_source_model),
            "Kältemittel_stufen": [alt["Kältemittel_stufen"]] * len(t_source_model),
        })
        return model.predict(X)
    return predict


def _formula_alternative(spec):
    """Turn a user's CopFormulaSpec into an entry the optimiser understands.

    Raises FormulaError if the expression is not acceptable; the caller turns
    that into a 400 rather than a 500.
    """
    code = compile_formula(spec.expression)

    def predict(t_source_model, t_sink_model):
        return evaluate_formula(code, build_variables(t_source_model, t_sink_model))

    return {
        "name": spec.name or "Custom formula",
        "Kältemittel_stufen": spec.name or "Custom formula",
        "medium_sink": spec.medium_sink,
        # Tags the point in the results table and colours it apart from the
        # Natural/Synthetic families that come from the model.
        "refrigerant_type": "Custom formula",
        "hp_level": spec.hp_level,
        "T_src_min": float(spec.T_source_min),
        "T_src_max": float(spec.T_source_max),
        "T_sink_min": float(spec.T_sink_min),
        "T_sink_max": float(spec.T_sink_max),
        "cop_min": float(spec.cop_min),
        "cop_max": float(spec.cop_max),
        "deltaT_evap": OPTIMIZATION_CONFIG["deltaT_evap"],
        "deltaT_cond": OPTIMIZATION_CONFIG["deltaT_cond"],
        "cop_fn": predict,
    }


def _prepare_xy_curve(x, y, is_source=False):
    x = np.asarray(x, dtype=float).ravel()
    y = np.asarray(y, dtype=float).ravel()
    mask = np.isfinite(x) & np.isfinite(y)
    x, y = x[mask], y[mask]
    
    if len(x) == 0:
        return np.array([]), np.array([])
        
    df_curve = pd.DataFrame({"x": x, "y": y})
    if is_source:
        df_curve = df_curve.sort_values(by=["x", "y"], ascending=[True, False]).reset_index(drop=True)
    else:
        df_curve = df_curve.sort_values(by=["x", "y"], ascending=[True, True]).reset_index(drop=True)
        
    x_vals = df_curve["x"].to_numpy(copy=True)
    for i in range(1, len(x_vals)):
        if x_vals[i] <= x_vals[i-1]:
            x_vals[i] = x_vals[i-1] + 1e-6
            
    df_curve["x"] = x_vals
    return df_curve["x"].to_numpy(dtype=float), df_curve["y"].to_numpy(dtype=float)


def _make_temperature_grid(T_min, T_max, step=1.0):
    if T_max < T_min:
        return np.array([])
    return np.arange(T_min, T_max + step * 0.5, step, dtype=float)


def _diagnostic_messages(diag: HPIOptimizationDiagnostics, n_points: int) -> list[str]:
    """
    Turn the rejection tally into sentences an engineer can act on.

    Only the binding constraints are reported, so a run that found plenty of
    solutions stays quiet.
    """
    msgs: list[str] = []

    if n_points == 0:
        if diag.source_T_max is not None and diag.model_T_source_min is not None \
                and diag.source_T_max < diag.model_T_source_min:
            msgs.append(
                f"Source too cold: the waste heat profile only reaches "
                f"{diag.source_T_max:.1f} °C, while the coldest source any refrigerant "
                f"in the COP model supports is {diag.model_T_source_min:.1f} °C. "
                f"Check whether hot streams are deselected, or lower the heat "
                f"recovery credit (profile mode) so warmer heat stays available."
            )
        if diag.sink_T_max is not None and diag.model_T_sink_min is not None \
                and diag.sink_T_max < diag.model_T_sink_min:
            msgs.append(
                f"Sink too cold: the heat demand only reaches {diag.sink_T_max:.1f} °C, "
                f"below the lowest sink temperature the COP model was trained on "
                f"({diag.model_T_sink_min:.1f} °C)."
            )
        if diag.dropped_negligible and not msgs:
            msgs.append(
                f"{diag.dropped_negligible} operating points were dropped because the "
                f"available waste heat would have covered less than "
                f"{MIN_COVERAGE * 100:.0f} % of the demand above T_sink."
            )
        if diag.rejected_no_source_heat and not msgs:
            msgs.append(
                "No usable source heat: within every refrigerant's operating window "
                "the available waste heat is zero."
            )
        if diag.rejected_no_demand == diag.candidates_total and diag.candidates_total:
            msgs.append("No heat demand above the pinch — nothing for a heat pump to supply.")
        if not msgs:
            msgs.append(
                "No refrigerant in the COP model can operate between this source and "
                "sink temperature range."
            )
    elif diag.accepted_source_limited:
        msg = (
            f"{diag.accepted_source_limited} of {n_points} operating points are "
            f"source-limited: the heat pump covers only part of the demand above "
            f"T_sink because the available waste heat runs out."
        )
        if diag.dropped_negligible:
            msg += (
                f" A further {diag.dropped_negligible} were dropped for covering "
                f"less than {MIN_COVERAGE * 100:.0f} % of that demand."
            )
        msgs.append(msg)

    if n_points and diag.accepted_demand_limited:
        msgs.append(
            f"{diag.accepted_demand_limited} of {n_points} operating points are "
            f"demand-limited: they cover the full demand above T_sink but leave "
            f"waste heat unused at T_source, so they sit off the source profile. "
            f"They are hidden from the chart unless switched on."
        )

    if diag.candidates_total and diag.rejected_sink_range == diag.candidates_total:
        msgs.append(
            f"Every candidate was rejected on the sink temperature range "
            f"({diag.sink_T_min:.0f}–{diag.sink_T_max:.0f} °C available, model needs "
            f"at least {diag.model_T_sink_min:.0f} °C)."
        )

    return msgs


def run_hpi_optimization(request: HPIOptimizationRequest | PinchResult) -> HPIOptimizationResult:
    # Accept a bare PinchResult as well, so older callers keep working.
    cop_formula = None
    if isinstance(request, HPIOptimizationRequest):
        pinch = request.pinch_result
        profile_mode = request.profile_mode
        cop_formula = request.cop_formula
    else:
        pinch = request
        profile_mode = "net_load"

    _, alternatives = _load_model_and_data()

    # A user formula is appended as one more alternative rather than replacing
    # the model, so it lands in the same table and chart and can be compared
    # against the trained refrigerants directly.
    if cop_formula is not None and cop_formula.enabled and cop_formula.expression.strip():
        # _load_model_and_data caches its list; copy before appending so the
        # custom entry does not leak into the next request.
        alternatives = list(alternatives) + [_formula_alternative(cop_formula)]

    # Reconstruct Pinch for HPI
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="")
    try:
        writer = csv.writer(tmp)
        writer.writerow(["Tmin", str(pinch.T_min)])
        writer.writerow(["CP", "TSUPPLY", "TTARGET"])
        for sd in pinch.streams_data:
            writer.writerow([str(sd["cp"]), str(sd["ts"]), str(sd["tt"])])
        tmp.close()

        from app.modules.pinch_main import PinchMain
        from app.modules.heat_pump_integration.heat_pump_integration import HeatPumpIntegration
        from app.modules.utility.heat_profiles import resolve_profiles

        pm = PinchMain(tmp.name, options={"draw": False})
        pm.solve_pinch_for_hpi("EN")

        hpi = HeatPumpIntegration(tmp.name, None, pm)
        hpi.gcc_draw = pm.pinch_analyse.grand_composite_curve
        hpi.gcc_source, hpi.gcc_sink = resolve_profiles(
            pm.pinch_analyse, hpi, profile_mode
        )

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
                original_gcc={"H": pinch.grand_composite_curve.get("H", []), "T": pinch.grand_composite_curve.get("T", [])},
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
        max_q = -1.0
        max_q_point = None

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

            cop_preds = np.asarray(alt["cop_fn"](T_quelle_model, T_senke_model), dtype=float)

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
                        hp_level=alt["hp_level"]
                    )
                    feasible_points.append(pt)
                    found_full = True
                    diag.accepted_full += 1

                    if q_dem > max_q:
                        max_q = q_dem
                        max_q_point = pt

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
                    hp_level=alt["hp_level"]
                )
                feasible_points.append(pt)
                if limited:
                    diag.accepted_source_limited += 1
                else:
                    diag.accepted_demand_limited += 1

                if q_sink_best > max_q:
                    max_q = q_sink_best
                    max_q_point = pt

        diag.messages = _diagnostic_messages(diag, len(feasible_points))

        return HPIOptimizationResult(
            feasible_points=feasible_points,
            max_q_point=max_q_point,
            original_gcc={"H": pinch.grand_composite_curve.get("H", []), "T": pinch.grand_composite_curve.get("T", [])},
            pocketless_source={"H": q_avail_clean.tolist(), "T": t_source_clean.tolist()},
            pocketless_sink={"H": q_demand_clean.tolist(), "T": t_sink_clean.tolist()},
            profile_mode=profile_mode,
            diagnostics=diag,
        )
    finally:
        os.unlink(tmp.name)
