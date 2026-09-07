# Heat Pump Optimization — Predictive ML Model & Grid Search

While classic Heat Pump Integration uses empirical regressions of prototypical heat pumps, **Heat Pump Optimization** evaluates a wide spectrum of **refrigerants and multi-stage heat pump designs** using a **trained Machine Learning model** or custom COP mathematical expressions.

It evaluates every candidate across a 2D mesh of $(T_{source}, T_{sink})$ operating points to discover the exact thermal matching conditions.

---

## Predictive ML Model & Refrigerant Alternatives

The optimization engine loads a trained Scikit-Learn regressor model (persisted via `joblib`) along with a pre-configured database of refrigerant alternatives (`cop_ranges.json`).

### Refrigerant Data Schema

Each alternative defines its operational envelope:

| Parameter | Symbol | Unit | Meaning |
|---|---|---|---|
| Source temperature range | $[T_{src,min}, T_{src,max}]$ | °C | Valid evaporator inlet temperatures |
| Sink temperature range | $[T_{sink,min}, T_{sink,max}]$ | °C | Valid condenser outlet temperatures |
| COP range bounds | $[COP_{min}, COP_{max}]$ | — | Valid COP physical limits |
| Heat pump design level | `Kältemittel_stufen` | — | Single-stage, two-stage, cascade configuration |
| Sink medium | `medium_sink` | — | Water, steam, or air loop |


## Refrigerant Operating Limits

The following table lists the operating temperature ranges and COP bounds for all refrigerant alternatives used by the optimization engine.

| Name | Stage | Medium Sink | Refrigerant Type | HP Level | $T_{src\,min}$ (°C) | $T_{src\,max}$ (°C) | $T_{sink\,min}$ (°C) | $T_{sink\,max}$ (°C) | $COP_{min}$ | $COP_{max}$ |
|---|---|---|---|---|---|---|---|---|---|---|
| Butane_1 | 1 | Steam | Natural | 1 | 40.0 | 85.0 | 105.0 | 135.0 | 2.615 | 4.806 |
| Butane_1 | 1 | Water | Natural | 1 | 25.0 | 85.0 | 80.0 | 140.0 | 0.909 | 8.439 |
| Butane_2 | 2 | Steam | Natural | 2 | 40.0 | 85.0 | 105.0 | 135.0 | 2.664 | 4.938 |
| Butane_2 | 2 | Water | Natural | 2 | 25.0 | 85.0 | 80.0 | 140.0 | 0.909 | 8.915 |
| Butane_3 | 3 | Steam | Natural | 3 | 40.0 | 85.0 | 105.0 | 135.0 | 2.678 | 4.975 |
| Butane_3 | 3 | Water | Natural | 3 | 25.0 | 85.0 | 80.0 | 140.0 | 0.909 | 8.439 |
| Isobutane_1 | 1 | Steam | Natural | 1 | 40.0 | 75.0 | 105.0 | 115.0 | 2.672 | 4.203 |
| Isobutane_1 | 1 | Water | Natural | 1 | 20.0 | 85.0 | 80.0 | 120.0 | 0.986 | 6.775 |
| Isobutane_2 | 2 | Steam | Natural | 2 | 40.0 | 75.0 | 105.0 | 115.0 | 2.759 | 4.203 |
| Isobutane_2 | 2 | Water | Natural | 2 | 20.0 | 85.0 | 80.0 | 120.0 | 0.986 | 6.775 |
| Isobutane_3 | 3 | Steam | Natural | 3 | 40.0 | 75.0 | 105.0 | 115.0 | 2.789 | 4.203 |
| Isobutane_3 | 3 | Water | Natural | 3 | 20.0 | 85.0 | 80.0 | 120.0 | 0.986 | 6.775 |
| Isopentane_1 | 1 | Steam | Natural | 1 | 50.0 | 85.0 | 105.0 | 165.0 | 2.776 | 5.027 |
| Isopentane_1 | 1 | Water | Natural | 1 | 40.0 | 85.0 | 80.0 | 160.0 | 0.799 | 8.492 |
| Isopentane_2 | 2 | Steam | Natural | 2 | 50.0 | 85.0 | 105.0 | 165.0 | 2.831 | 5.179 |
| Isopentane_2 | 2 | Water | Natural | 2 | 40.0 | 85.0 | 80.0 | 160.0 | 0.799 | 9.255 |
| Isopentane_3 | 3 | Steam | Natural | 3 | 50.0 | 85.0 | 105.0 | 165.0 | 2.846 | 5.222 |
| Isopentane_3 | 3 | Water | Natural | 3 | 40.0 | 85.0 | 80.0 | 160.0 | 0.799 | 8.492 |
| Propane_1 | 1 | Water | Natural | 1 | 20.0 | 40.0 | 80.0 | 80.0 | 3.335 | 3.660 |
| Propane_2 | 2 | Water | Natural | 2 | 20.0 | 40.0 | 80.0 | 80.0 | 3.372 | 3.660 |
| Propane_3 | 3 | Water | Natural | 3 | 20.0 | 40.0 | 80.0 | 80.0 | 3.335 | 3.660 |
| R1224yd_1 | 1 | Steam | Synthetic | 1 | 50.0 | 85.0 | 105.0 | 145.0 | 2.762 | 4.865 |
| R1224yd_1 | 1 | Water | Synthetic | 1 | 35.0 | 85.0 | 80.0 | 150.0 | 0.889 | 8.731 |
| R1224yd_2 | 2 | Steam | Synthetic | 2 | 55.0 | 85.0 | 105.0 | 145.0 | 3.002 | 4.962 |
| R1224yd_2 | 2 | Water | Synthetic | 2 | 35.0 | 85.0 | 80.0 | 150.0 | 0.889 | 9.584 |
| R1224yd_3 | 3 | Steam | Synthetic | 3 | 50.0 | 85.0 | 105.0 | 145.0 | 2.884 | 4.995 |
| R1224yd_3 | 3 | Water | Synthetic | 3 | 35.0 | 85.0 | 80.0 | 150.0 | 0.889 | 8.731 |
| R1233zd_1 | 1 | Steam | Synthetic | 1 | 50.0 | 85.0 | 105.0 | 145.0 | 2.820 | 4.906 |
| R1233zd_1 | 1 | Water | Synthetic | 1 | 40.0 | 85.0 | 80.0 | 150.0 | 0.892 | 8.769 |
| R1233zd_2 | 2 | Steam | Synthetic | 2 | 50.0 | 85.0 | 105.0 | 145.0 | 2.915 | 5.061 |
| R1233zd_2 | 2 | Water | Synthetic | 2 | 40.0 | 85.0 | 80.0 | 150.0 | 0.892 | 9.594 |
| R1233zd_3 | 3 | Steam | Synthetic | 3 | 50.0 | 85.0 | 105.0 | 145.0 | 2.948 | 5.102 |
| R1233zd_3 | 3 | Water | Synthetic | 3 | 40.0 | 85.0 | 80.0 | 150.0 | 0.892 | 8.769 |
| R1234ZEE_1 | 1 | Water | Synthetic | 1 | 20.0 | 85.0 | 80.0 | 100.0 | 1.176 | 5.864 |
| R1234ZEE_2 | 2 | Water | Synthetic | 2 | 20.0 | 85.0 | 80.0 | 100.0 | 1.176 | 5.864 |
| R1234ZEE_3 | 3 | Water | Synthetic | 3 | 20.0 | 85.0 | 80.0 | 100.0 | 1.176 | 5.864 |
| R1336mzzZ_1 | 1 | Steam | Synthetic | 1 | 60.0 | 85.0 | 105.0 | 155.0 | 3.011 | 4.849 |
| R1336mzzZ_1 | 1 | Water | Synthetic | 1 | 50.0 | 85.0 | 80.0 | 160.0 | 0.879 | 8.876 |
| R1336mzzZ_2 | 2 | Steam | Synthetic | 2 | 60.0 | 85.0 | 105.0 | 155.0 | 3.077 | 5.010 |
| R1336mzzZ_2 | 2 | Water | Synthetic | 2 | 50.0 | 85.0 | 80.0 | 160.0 | 0.879 | 9.574 |
| R1336mzzZ_3 | 3 | Steam | Synthetic | 3 | 60.0 | 85.0 | 105.0 | 155.0 | 3.096 | 5.057 |
| R1336mzzZ_3 | 3 | Water | Synthetic | 3 | 50.0 | 85.0 | 80.0 | 160.0 | 0.879 | 8.876 |

*All temperatures are in degrees °C. COP bounds are dimensionless.*

<details>
<summary><b>Source code:</b> <code>backend/app/services/optimization_service.py</code> (lines 36–90)</summary>

```python
def _load_model_and_data():
    """Load joblib ML regressor and refrigerant alternatives configuration."""
    _model_cache = joblib.load(OPTIMIZATION_CONFIG["model_path"])

    with open(OPTIMIZATION_CONFIG["ranges_path"], encoding="utf-8") as fh:
        payload = json.load(fh)

    alts = []
    for entry in payload["alternatives"]:
        alt = {
            "name": entry["name"],
            "refrigerant_type": entry["refrigerant_type"],
            "medium_sink": entry["medium_sink"],
            "Kältemittel_stufen": entry["Kältemittel_stufen"],
            "T_src_min": float(entry["T_src_min"]),
            "T_src_max": float(entry["T_src_max"]),
            "T_sink_min": float(entry["T_sink_min"]),
            "T_sink_max": float(entry["T_sink_max"]),
            "cop_min": float(entry["cop_min"]),
            "cop_max": float(entry["cop_max"]),
            "deltaT_evap": OPTIMIZATION_CONFIG["deltaT_evap"],
            "deltaT_cond": OPTIMIZATION_CONFIG["deltaT_cond"],
        }
        alt["cop_fn"] = _model_cop_fn(alt)
        alts.append(alt)

    return _model_cache, alts
```

</details>

---

## Temperature Approach Corrections

Before predicting the COP, process temperatures are corrected for heat exchanger approach temperature differences:

$$
T_{source,model} = T_{source,process} - \Delta T_{evap}
$$

$$
T_{sink,model} = T_{sink,process} + \Delta T_{cond}
$$

where $\Delta T_{evap}$ and $\Delta T_{cond}$ are the minimum approach temperature drops across the evaporator and condenser heat exchangers (typically 5 K each).

<details>
<summary><b>Source code:</b> <code>backend/app/services/optimization_service.py</code> (lines 92–110)</summary>

```python
def _model_cop_fn(alt):
    """COP prediction callable backed by the trained ML regressor."""
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
```

</details>

---

## Custom COP Formula Evaluation

Users can also specify custom mathematical COP formulas using standard algebraic operations and variables (`T_src`, `T_sink`, `dT`). Custom expressions are compiled into an AST (Abstract Syntax Tree) to prevent arbitrary code execution before evaluation:

$$
COP_{custom} = f(T_{src}, T_{sink}, \Delta T)
$$

<details>
<summary><b>Source code:</b> <code>backend/app/utils/cop_formula.py</code> (lines 15–45)</summary>

```python
def compile_formula(formula_str: str):
    """Safely compile user-provided COP mathematical expression into executable AST."""
    parsed = ast.parse(formula_str, mode="eval")
    # Verify AST nodes contain only safe math operators (+, -, *, /, **, numbers, symbols)
    _validate_ast_safety(parsed)
    return compile(parsed, filename="<cop_formula>", mode="eval")
```

</details>

---

## 2D Mesh Grid Search Algorithm

The optimization algorithm evaluates candidates across a 2D mesh of all valid $(T_{source}, T_{sink})$ pairs extracted from the process GCC source and sink profiles.

### 1. Source-Sink Energy Balance

At each target sink temperature $T_{sink}$ requiring heating duty $\dot{Q}_{demand}$, the required waste heat supply $\dot{Q}_{source,req}$ is:

$$
\dot{Q}_{source,req} = \dot{Q}_{demand} \cdot \frac{COP - 1}{COP}
$$

### 2. Zero-Crossing Exact Point Detection

The available waste heat curve $\dot{Q}_{available}(T_{source})$ is compared against the required waste heat curve $\dot{Q}_{source,req}(T_{source})$ by tracking the sign of the difference:

$$
D(T_{source}) = \dot{Q}_{available}(T_{source}) - \dot{Q}_{source,req}(T_{source})
$$

When $D(T_{source})$ changes sign between two grid points $idx$ and $idx+1$, an exact operating match exists. The exact source temperature $T_{source,exact}$ and COP are determined by linear zero-crossing interpolation:

$$
f_{fraction} = \frac{-D_{idx}}{D_{idx+1} - D_{idx}}
$$

$$
T_{source,exact} = T_{source,idx} + f_{fraction} \cdot (T_{source,idx+1} - T_{source,idx})
$$

<details>
<summary><b>Source code:</b> <code>backend/app/services/optimization_service.py</code> (lines 370–425)</summary>

```python
# Detect zero-crossings where available waste heat equals required waste heat
diff = q_avail_valid - q_src_req
crossings = np.where(np.diff(np.sign(diff)))[0]

for idx in crossings:
    denom = diff[idx + 1] - diff[idx]
    if abs(denom) < 1e-12:
        continue
    fraction = -diff[idx] / denom
    t_src_exact = t_src_valid[idx] + fraction * (t_src_valid[idx + 1] - t_src_valid[idx])
    cop_exact = cop_valid[idx] + fraction * (cop_valid[idx + 1] - cop_valid[idx])
```

</details>

---

## Source-Limited Heat Pump Integration

When available waste heat is insufficient to cover the full process heating demand, the algorithm evaluates **source-limited integration points**.

In this regime, the heat pump absorbs all available waste heat $\dot{Q}_{available}$, and the maximum achievable condenser heat delivery is:

$$
\dot{Q}_{sink,achievable} = \min\left(\dot{Q}_{available} \cdot \frac{COP}{COP - 1},\ \dot{Q}_{demand}\right)
$$

A candidate is reported as a valid source-limited option if its coverage ratio exceeds the threshold:

$$
\frac{\dot{Q}_{sink,achievable}}{\dot{Q}_{demand}} \ge 0.01 \quad (1\%)
$$

<details>
<summary><b>Source code:</b> <code>backend/app/services/optimization_service.py</code> (lines 430–475)</summary>

```python
# Source-limited check: when waste heat is insufficient to fully satisfy Q_demand
q_sink_achievable = np.minimum(q_avail_valid * cop_valid / (cop_valid - 1.0), q_dem)
coverage = q_sink_achievable / q_dem

# Filter out candidates covering less than 1% of target demand
valid_indices = np.where(coverage >= MIN_COVERAGE)[0]
```

</details>

---

## Output Summary

The optimization service ranks candidates by **COP**, **condenser thermal output ($\dot{Q}_{sink}$)**, and **electrical power input ($W_{el} = \dot{Q}_{sink} / COP$)**, returning:

| Output Parameter | Meaning |
|---|---|
| `best_cop_points` | Exact zero-crossing operating points with highest COP |
| `source_limited_points` | Maximum heat delivery points when waste heat is constrained |
| `refrigerant_type` | Selected fluid (e.g. R1233zd(E), R290, R717) |
| `diagnostics` | Count of evaluated mesh points, skipped points outside operating envelope, and zero-crossing solutions |
