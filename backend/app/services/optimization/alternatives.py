"""Where each heat pump's COP comes from: the trained model (2 or 4
temperatures), the literature archetypes, or a formula the user typed in."""

from __future__ import annotations
import os
import json
import numpy as np
import pandas as pd
import joblib

from app.config_optimization import OPTIMIZATION_CONFIG
from app.utils.cop_formula import (
    build_variables,
    compile_formula,
    evaluate_formula,
)

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


_model_4t_cache = None


def _four_temperature_alternatives(alternatives, pinch):
    """The same refrigerants, scored by the model that sees all four temperatures.

    The grid only varies two of them (source return, sink supply). The other two
    are held at the pinch for every point: Vorlauf Quelle = pinch - dTmin/2 and
    Rücklauf Senke = pinch + dTmin/2. The envelopes in the ranges file are
    shared with the 2-temperature model, which was fitted on the same data.
    """
    global _model_4t_cache
    if _model_4t_cache is None:
        path = OPTIMIZATION_CONFIG["model_path_4t"]
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"4-temperature model not found at {path}. "
                "Create it with cop_analysis/train_cop_4t.py."
            )
        _model_4t_cache = joblib.load(path)
    model = _model_4t_cache

    half = float(pinch.T_min) / 2.0
    t_vorlauf_quelle = float(pinch.pinch_temperature) - half
    t_ruecklauf_senke = float(pinch.pinch_temperature) + half

    def make_fn(alt):
        def predict(t_source_model, t_sink_model):
            n = len(t_source_model)
            X = pd.DataFrame({
                "T_Vorlauf_Quelle": [t_vorlauf_quelle] * n,
                "T_Rücklauf_Quelle": t_source_model,
                "T_Rücklauf_Senke": [t_ruecklauf_senke] * n,
                "T_Vorlauf_Senke": t_sink_model,
                "Medium_Senke": [alt["medium_sink"]] * n,
                "Kältemittel_stufen": [alt["Kältemittel_stufen"]] * n,
            })
            return model.predict(X)
        return predict

    return [dict(alt, cop_fn=make_fn(alt), four_t=True) for alt in alternatives]


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


def _theoretical_alternatives():
    """The literature technology archetypes, shaped like model alternatives.

    The HPI panel above evaluates these same five correlations at a single sink
    temperature. Here they are swept through the optimiser's full grid so they
    appear as curves alongside the trained refrigerants, which is only valid
    because both sides use the identical shifted-temperature convention and the
    identical duty relation Q_sink = Q_source * COP/(COP-1).

    Each archetype is only rated inside its own sink/lift window, so the COP
    callable returns -1 outside it: the optimiser already discards any COP <= 1,
    which enforces the window without touching its loop.
    """
    from app.modules.heat_pump_integration.heat_pump_integration import (
        HP_OPERATING_WINDOWS,
        HP_COP_CORRELATIONS,
        HP_COP_FORMULAS,
    )

    alts = []
    for name, window in HP_OPERATING_WINDOWS.items():
        correlation = HP_COP_CORRELATIONS[name]

        def make_fn(correlation=correlation, window=window):
            def predict(t_source_model, t_sink_model):
                t_src = np.asarray(t_source_model, dtype=float)
                t_snk = np.asarray(t_sink_model, dtype=float)
                lift = t_snk - t_src
                with np.errstate(all="ignore"):
                    cop = np.asarray(correlation(t_snk, lift), dtype=float)
                # Outside the rated window the regression is extrapolation, not
                # a machine anyone can buy. -1 makes the optimiser drop it.
                in_window = (
                    (t_snk >= window["t_sink_min"]) & (t_snk <= window["t_sink_max"])
                    & (lift >= window["dt_min"]) & (lift <= window["dt_max"])
                )
                return np.where(in_window & np.isfinite(cop), cop, -1.0)
            return predict

        alts.append({
            "name": name,
            "Kältemittel_stufen": name,
            "medium_sink": "—",
            "refrigerant_type": "Theoretical",
            "hp_level": "—",
            "T_src_min": -273.0,
            "T_src_max": 10000.0,
            "T_sink_min": float(window["t_sink_min"]),
            "T_sink_max": float(window["t_sink_max"]),
            # The same ceiling the HPI panel clamps to, so a technology cannot
            # look better here than it does above.
            "cop_min": 1.0,
            "cop_max": 15.0,
            "deltaT_evap": OPTIMIZATION_CONFIG["deltaT_evap"],
            "deltaT_cond": OPTIMIZATION_CONFIG["deltaT_cond"],
            "cop_fn": make_fn(),
            "theoretical": True,
            # Renders the published formula with a point's own temperatures.
            "formula_fn": HP_COP_FORMULAS.get(name),
        })
    return alts


def _pin_carnot(alternatives, pinch):
    """Carnot reference on non-shifted sink temperatures, source fixed at the pinch.

    Vorlaufquelle = pinch - dTmin/2. The sink is the row's sink with the shift
    taken back out (grid value - dTmin/2), i.e. the real process temperature.
    """
    from app.modules.heat_pump_integration.heat_pump_integration import (
        HP_COP_FORMULAS, carnot_cop,
    )

    half = float(pinch.T_min) / 2.0
    t_source = float(pinch.pinch_temperature) - half

    def cop_fn(_t_src, t_snk):
        t_snk = np.asarray(t_snk, dtype=float) - half
        lift = t_snk - t_source
        with np.errstate(all="ignore"):
            return np.where(lift > 0, carnot_cop(t_snk, lift), -1.0)

    def beats_carnot(fn):
        # The other archetypes only where they beat the Carnot line at the same
        # sink temperature; elsewhere -1 makes the optimiser drop them.
        def predict(t_src, t_snk):
            cop = np.asarray(fn(t_src, t_snk), dtype=float)
            return np.where(cop > cop_fn(t_src, t_snk), cop, -1.0)
        return predict

    pinned = []
    for alt in alternatives:
        if alt["name"] == "Carnot":
            alt = dict(
                alt,
                cop_fn=cop_fn,
                formula_fn=lambda t_sink, _dt: HP_COP_FORMULAS["Carnot"](t_sink - half, t_sink - half - t_source),
            )
        elif alt.get("theoretical"):
            alt = dict(alt, cop_fn=beats_carnot(alt["cop_fn"]))
        pinned.append(alt)
    return pinned


def _calculation_details(alt, t_source, t_sink):
    """The formula behind one point's COP, with its own temperatures filled in.

    Archetypes carry a published correlation that can be written out; a trained
    refrigerant does not, so it gets a short statement of where its COP came
    from instead of a fake formula.
    """
    formula_fn = alt.get("formula_fn")
    if formula_fn is not None:
        try:
            return formula_fn(t_sink, t_sink - t_source)
        except Exception:
            # A help bubble is never worth failing an analysis over.
            return None
    return (
        f"Regression over heat pump simulation data from a manufacturer "
        f"parameter study, evaluated for {alt['name']} (sink medium "
        f"{alt['medium_sink']}, {alt['hp_level']} stage(s)) at "
        f"T_source = {t_source:.1f} °C, T_sink = {t_sink:.1f} °C."
    )
