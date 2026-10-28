"""Train a COP model on the user's data — neural network, polynomial or
linear regression — run it, and offer it to the optimization.

The network is set up exactly as the shipped models (scikit-learn MLP on
standardised temperatures plus one-hot categories). After
training it is exported as plain numbers (CustomCopModelSpec); predict()
runs it with numpy, so a model sent back by the page is never unpickled.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPRegressor
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures, StandardScaler

from app.models.cop_training import CAT_ROLES, SINK_CAP, TEMP_ROLES, ColumnMapping, CustomCopModelSpec
from app.services.cop_training.data import MAX_ROWS, MIN_ROWS, DataError, _numeric

# The shipped models' set-up (cop_analysis/train_cop_4t.py): the same data
# gives the same network, so a user can reproduce them.
HIDDEN = (128, 64)
TEST_SHARE = 0.2
SEED = 42
PARITY_POINTS = 400


def _prepare(df: pd.DataFrame, mapping: ColumnMapping):
    """The mapped columns, cleaned: numbers where numbers belong, rows with a
    gap or a COP of 1 or less dropped (no heat pump runs there)."""
    m = mapping.model_dump()
    missing = [c for c in m.values() if c is not None and c not in df.columns]
    if missing:
        raise DataError(f"Columns not in the file: {', '.join(missing)}")
    temps = [r for r in TEMP_ROLES if m.get(r)]
    cats = [r for r in CAT_ROLES if m.get(r)]
    data = pd.DataFrame({r: _numeric(df[m[r]]) for r in temps + ["COP"]})
    for r in cats:
        data[r] = df[m[r]].astype(str).str.strip()
    n_in = len(data)
    data = data.replace([np.inf, -np.inf], np.nan).dropna()
    data = data[data["COP"] > 1]
    for r in cats:
        data = data[data[r] != ""]
    dropped = n_in - len(data)
    sampled_from = None
    if len(data) > MAX_ROWS:
        sampled_from = len(data)
        data = data.sample(MAX_ROWS, random_state=SEED)
    if len(data) < MIN_ROWS:
        raise DataError(f"Only {len(data)} usable rows; at least {MIN_ROWS} are needed.")
    return data, temps, cats, dropped, sampled_from


def _design(data: pd.DataFrame, temps: List[str], cats: List[str], categories: Dict[str, List[str]]):
    """Inputs as the network sees them: temperatures, then one-hot categories."""
    parts = [data[temps].to_numpy(float)]
    for r in cats:
        col = data[r].to_numpy()
        parts.append(np.stack([(col == v).astype(float) for v in categories[r]], axis=1))
    return np.hstack(parts)


KINDS = ("nn", "poly", "linear")
# Written out with this many significant digits; predict() uses the exact values.
FORMULA_DIGITS = 7
SYMBOL = {"T_source_out": "T_src,out", "T_sink_out": "T_snk,out",
          "T_source_in": "T_src,in", "T_sink_in": "T_snk,in"}
POWER = {1: "", 2: "²", 3: "³"}


def _fit_nn(train_df, temps, cats, categories):
    """Neural network on standardised temperatures and one-hot categories."""
    scaler = StandardScaler().fit(train_df[temps].to_numpy(float))

    def X(frame):
        x = _design(frame, temps, cats, categories)
        x[:, : len(temps)] = scaler.transform(x[:, : len(temps)])
        return x

    net = MLPRegressor(hidden_layer_sizes=HIDDEN, alpha=0.0005, early_stopping=True,
                       max_iter=1000, random_state=SEED)
    net.fit(X(train_df), train_df["COP"].to_numpy(float))
    fields = {
        "mean": scaler.mean_.tolist(),
        "scale": scaler.scale_.tolist(),
        "layers": [{"W": W.tolist(), "b": b.tolist()} for W, b in zip(net.coefs_, net.intercepts_)],
    }
    return fields, lambda frame: net.predict(X(frame))


def _fit_regression(train_df, temps, cats, categories, degree):
    """Least squares on the temperatures in °C and their products up to
    `degree`, plus one offset per category value (the first value is the
    baseline, offset 0)."""
    pf = PolynomialFeatures(degree, include_bias=False)

    def X(frame):
        parts = [pf.transform(frame[temps].to_numpy(float))]
        for r in cats:
            col = frame[r].to_numpy()
            parts += [(col == v).astype(float)[:, None] for v in categories[r][1:]]
        return np.hstack(parts)

    pf.fit(train_df[temps].to_numpy(float))
    reg = LinearRegression().fit(X(train_df), train_df["COP"].to_numpy(float))
    n_poly = pf.powers_.shape[0]
    terms = [{"coef": float(reg.intercept_), "powers": {}}] + [
        {"coef": float(c), "powers": {temps[i]: int(p) for i, p in enumerate(row) if p}}
        for c, row in zip(reg.coef_[:n_poly], pf.powers_)
    ]
    offsets, k = {}, n_poly
    for r in cats:
        offsets[r] = {categories[r][0]: 0.0}
        for v in categories[r][1:]:
            offsets[r][v] = float(reg.coef_[k])
            k += 1
    fields = {"mean": [0.0] * len(temps), "scale": [1.0] * len(temps), "terms": terms,
              "offsets": offsets, "formula": _formula(terms, offsets)}
    return fields, lambda frame: reg.predict(X(frame))


def _num(v: float) -> str:
    return f"{abs(v):.{FORMULA_DIGITS}g}"


def _formula(terms: List[Dict[str, Any]], offsets: Dict[str, Dict[str, float]]) -> str:
    """COP = c₀ + c₁·T + …, then one line per category with its offsets."""
    out = f"COP = {'−' if terms[0]['coef'] < 0 else ''}{_num(terms[0]['coef'])}"
    for t in terms[1:]:
        mono = "·".join(SYMBOL[r] + POWER[p] for r, p in t["powers"].items())
        out += f" {'−' if t['coef'] < 0 else '+'} {_num(t['coef'])}·{mono}"
    for r, values in offsets.items():
        shifts = ", ".join(f"{v}: {'−' if c < 0 else '+'}{_num(c)}" for v, c in values.items())
        out += f"\n  + offset by {r} ({shifts})"
    return out


def train(df: pd.DataFrame, mapping: ColumnMapping, name: str = "My COP model",
          kind: str = "nn", degree: int = 2) -> Dict[str, Any]:
    """Fit the chosen kind of model: a neural network ("nn"), a polynomial
    ("poly", degree 2 or 3) or a linear regression ("linear")."""
    if kind not in KINDS:
        raise DataError(f"model type must be one of {', '.join(KINDS)}")
    if kind == "poly" and degree not in (2, 3):
        raise DataError("the polynomial degree must be 2 or 3")
    data, temps, cats, dropped, sampled_from = _prepare(df, mapping)
    categories = {r: sorted(data[r].unique().tolist()) for r in cats}
    train_df, test_df = train_test_split(data, test_size=TEST_SHARE, random_state=SEED)

    if kind == "nn":
        fields, model_predict = _fit_nn(train_df, temps, cats, categories)
    else:
        fields, model_predict = _fit_regression(train_df, temps, cats, categories,
                                                degree if kind == "poly" else 1)

    y_test = test_df["COP"].to_numpy(float)
    p_test = model_predict(test_df)
    p_train = model_predict(train_df)
    metrics = {
        "r2": float(r2_score(y_test, p_test)),
        "mae": float(mean_absolute_error(y_test, p_test)),
        "rmse": float(np.sqrt(mean_squared_error(y_test, p_test))),
        "mape": float(np.mean(np.abs((p_test - y_test) / y_test)) * 100),
        "r2_train": float(r2_score(train_df["COP"], p_train)),
        "n_train": float(len(train_df)),
        "n_test": float(len(test_df)),
        **({"degree": float(degree)} if kind == "poly" else {}),
    }
    data_env = {
        "T_source_min": float(data["T_source_out"].min()),
        "T_source_max": float(data["T_source_out"].max()),
        "T_sink_min": float(data["T_sink_out"].min()),
        "T_sink_max": float(data["T_sink_out"].max()),
        "cop_min": float(data["COP"].min()),
        "cop_max": float(data["COP"].max()),
    }
    combos = (
        data[cats].drop_duplicates().sort_values(cats).to_dict(orient="records") if cats else [{}]
    )
    spec = CustomCopModelSpec(
        name=name or "My COP model",
        kind=kind,
        temps=temps,
        cats=cats,
        categories=categories,
        envelope={**data_env, "T_sink_max": min(data_env["T_sink_max"], SINK_CAP),
                  "T_sink_min": min(data_env["T_sink_min"], SINK_CAP)},
        data_envelope=data_env,
        combos=[{k: str(v) for k, v in c.items()} for c in combos][:200],
        metrics=metrics,
        **fields,
    )
    # The page and the optimization run the exported numbers, not the fitted
    # object: they have to give the same COP, or the metrics above would
    # describe another model.
    exported = np.array([
        predict(spec, {r: [row[r]] for r in temps}, {c: row[c] for c in cats})[0]
        for _, row in test_df.iterrows()
    ])
    if not np.allclose(exported, p_test, rtol=1e-9, atol=1e-6):
        raise RuntimeError("The exported model does not reproduce the trained one.")
    pick = np.random.default_rng(SEED).permutation(len(y_test))[:PARITY_POINTS]
    return {
        "spec": spec,
        "rows_used": len(data),
        "rows_dropped": dropped,
        "sampled_from": sampled_from,
        "parity": {"actual": y_test[pick].tolist(), "predicted": p_test[pick].tolist()},
    }


def predict(spec: CustomCopModelSpec, temps: Dict[str, np.ndarray], cats: Dict[str, str]) -> np.ndarray:
    """COP from the exported numbers: the network's forward pass, or the
    regression's terms plus its category offsets."""
    n = len(next(iter(temps.values())))
    if spec.kind != "nn":
        t = {r: np.asarray(temps[r], float) for r in spec.temps}
        y = np.zeros(n)
        for term in spec.terms:
            mono = np.ones(n)
            for r, p in term.powers.items():
                mono = mono * t[r] ** p
            y = y + term.coef * mono
        for r, values in spec.offsets.items():
            y = y + values.get(cats.get(r, ""), 0.0)
        return y
    x_t = (np.stack([np.asarray(temps[r], float) for r in spec.temps], axis=1) - spec.mean) / spec.scale
    parts = [x_t]
    for r in spec.cats:
        hot = np.array([1.0 if v == cats.get(r) else 0.0 for v in spec.categories.get(r, [])])
        parts.append(np.tile(hot, (n, 1)))
    a = np.hstack(parts)
    for i, layer in enumerate(spec.layers):
        a = a @ np.asarray(layer.W) + np.asarray(layer.b)
        if i < len(spec.layers) - 1:
            a = np.maximum(a, 0)  # relu, scikit-learn's default
    return a[:, 0]


def alternatives(spec: CustomCopModelSpec, pinch: Any, deltaT_evap: float, deltaT_cond: float,
                 details: Callable[[CustomCopModelSpec, Dict[str, str]], Callable]) -> List[Dict[str, Any]]:
    """One heat pump per medium/refrigerant/stages combination in the data.
    With four temperatures, source supply and sink return come from the
    pinch, exactly as for the shipped 4-temperature model."""
    half = float(pinch.T_min) / 2.0
    fixed = {"T_source_in": float(pinch.pinch_temperature) - half,
             "T_sink_in": float(pinch.pinch_temperature) + half}
    env = spec.envelope
    out = []
    for combo in spec.combos or [{}]:
        label = "_".join(v for v in (combo.get("refrigerant"), combo.get("stages")) if v) or "model"

        def cop_fn(t_source_model, t_sink_model, combo=combo):
            n = len(t_source_model)
            temps = {"T_source_out": t_source_model, "T_sink_out": t_sink_model}
            temps.update({k: np.full(n, v) for k, v in fixed.items() if k in spec.temps})
            return predict(spec, temps, combo)

        out.append({
            "name": f"{spec.name}: {label}",
            "Kältemittel_stufen": label,
            "medium_sink": combo.get("medium", "Custom"),
            "refrigerant_type": "Custom model",
            "hp_level": combo.get("stages", "—"),
            "T_src_min": env["T_source_min"],
            "T_src_max": env["T_source_max"],
            "T_sink_min": env["T_sink_min"],
            "T_sink_max": env["T_sink_max"],
            # Never more optimistic than the data it learned from.
            "cop_min": max(1.0, env["cop_min"]),
            "cop_max": env["cop_max"],
            "deltaT_evap": deltaT_evap,
            "deltaT_cond": deltaT_cond,
            "cop_fn": cop_fn,
            "four_t": "T_source_in" in spec.temps,
            "formula_fn": details(spec, combo),
        })
    return out


def describe(spec: CustomCopModelSpec, combo: Dict[str, str]) -> Callable:
    """The help text behind a point's COP: which model, how good, which inputs."""
    m = spec.metrics
    what = ", ".join(f"{k} {v}" for k, v in combo.items()) or "all data"

    kind = {"nn": "neural network",
            "poly": f"polynomial regression (degree {int(m.get('degree', 2))})",
            "linear": "linear regression"}[spec.kind]

    def text(t_sink: float, lift: float) -> str:
        formula = f"\n{spec.formula}" if spec.formula else ""
        return (
            f"Your trained model '{spec.name}' ({what}): {kind} on {len(spec.temps)} temperatures, "
            f"trained on {int(m.get('n_train', 0))} rows, test R² {m.get('r2', float('nan')):.3f}, "
            f"MAE {m.get('mae', float('nan')):.3f}. Evaluated at T_source = {t_sink - lift:.1f} °C, "
            f"T_sink = {t_sink:.1f} °C.{formula}"
        )
    return text

