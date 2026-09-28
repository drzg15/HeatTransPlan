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

For the complete list of operating temperature ranges and COP bounds for all refrigerant alternatives, see [Refrigerant Operating Limits](refrigerant_limits.md).


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

## Theoretical Technology Archetypes

Alongside the trained refrigerants, the optimizer sweeps the five **technology archetypes** from [Heat Pump Integration](heat_pump_integration.md) — Prototypical Stirling, VHTHP (HFC/HFO), SHP and HTHPs (HFC/HFO), SHP and HTHPs (R717), and the 50 % Carnot baseline.

The integration module evaluates those same correlations at a **single** sink temperature. Here they are put through the **identical mesh** as the trained refrigerants, so a published technology curve can be read directly against what a real machine achieves at the same duty. This comparison is only valid because both sides use the same shifted-temperature convention and the same duty relation:

$$
\dot{Q}_{sink} = \dot{Q}_{source} \cdot \frac{COP}{COP - 1}
$$

Each archetype is rated only inside its own sink and lift window. Rather than special-casing the optimizer loop, the COP callable returns $-1$ outside the window: the grid search already discards any candidate with $COP \leq 1$, which enforces the operating envelope for free.

$$
COP_{archetype}(T_{src}, T_{sink}) =
\begin{cases}
f_{tech}(T_{sink}, \Delta T) & \text{inside the rated window} \\
-1 & \text{outside (discarded)}
\end{cases}
$$

Archetype points carry `theoretical = true` in the output, which is what separates them from measured machines in the results table and gives them their own marker on the chart.

> [!IMPORTANT]
> The Carnot archetype is the formula $\frac{T_{sink} + 273.15}{\Delta T} \times 0.5$ evaluated at the point's own temperatures — **not** a regression. Because it is deliberately **half** the thermodynamic ceiling rather than the ceiling itself, a real refrigerant scoring above it is expected and is not a physics violation. The same COP cap of **15.0** used by the integration module applies here.

<details>
<summary><b>Source code:</b> <code>backend/app/services/optimization_service.py</code> (<code>_theoretical_alternatives</code>)</summary>

```{literalinclude} ../backend/app/services/optimization_service.py
:language: python
:pyobject: _theoretical_alternatives
```

</details>

### Provenance of each COP

Every reported point records **how its COP was arrived at**, so a number can be traced back to its source without reading code. For an archetype this is the published formula with the point's own temperatures substituted; for a trained refrigerant it names the regression, the sink medium and the number of compression stages.

> [!NOTE]
> The trained model is a regression over a heat pump manufacturer's **simulation** parameter study — not measurements of operating machines.

<details>
<summary><b>Source code:</b> <code>backend/app/services/optimization_service.py</code> (<code>_calculation_details</code>)</summary>

```{literalinclude} ../backend/app/services/optimization_service.py
:language: python
:pyobject: _calculation_details
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

## Selecting the Maximum-Duty Point

The results highlight the point delivering the **greatest sink duty** — the largest heat pump the process can absorb. Many candidates typically reach that same maximum: in a representative case 48 machines tie at the top duty, with COPs spanning 2.57 to 9.08, because the duty ceiling is set by the process profile rather than by the machine.

A plain `>` comparison therefore left the winner to iteration order, and could report a markedly worse machine than an equally large one sitting beside it. Ties are broken by COP:

$$
\text{select } p \quad \text{if} \quad \dot{Q}_p > \dot{Q}_{max} \quad \text{or} \quad \left( \dot{Q}_p = \dot{Q}_{max} \ \text{and} \ COP_p > COP_{max} \right)
$$

> [!NOTE]
> This is an API-level selection rule, so it applies to every consumer of the optimization result, not only the chart.

---

## Demand-Limited Heat Pump Integration

The mirror image of the source-limited case. Here waste heat is *not* the constraint — there is more of it than the sink can absorb — so the duty is capped at the process demand and the surplus waste heat is left unused:

$$
\dot{Q}_{sink} = \dot{Q}_{demand} \quad \text{while} \quad \dot{Q}_{available} > \dot{Q}_{demand} \cdot \frac{COP - 1}{COP}
$$

The distinction matters for reading the charts. A **source-limited** point sits off the *sink* profile, because it cannot reach the demand; a **demand-limited** point sits off the *source* profile, because it does not consume all the waste heat available. Both are drawn as hollow markers to mark them as partial solutions, and both are excluded from the COP-versus-coverage frontier — a capped machine would otherwise put a dip in that curve at the coverage where it happens to be the only candidate.

| Flag | Constraint | Sits off | Meaning |
|---|---|---|---|
| `source_limited` | Waste heat runs out | Sink profile | Cannot meet the full demand |
| `demand_limited` | Sink demand runs out | Source profile | Leaves waste heat unused |

---

## Output Summary

The optimization service ranks candidates by **COP**, **condenser thermal output ($\dot{Q}_{sink}$)**, and **electrical power input ($W_{el} = \dot{Q}_{sink} / COP$)**, returning:

| Output Parameter | Meaning |
|---|---|
| `best_cop_points` | Exact zero-crossing operating points with highest COP |
| `source_limited_points` | Maximum heat delivery points when waste heat is constrained |
| `refrigerant_type` | Selected fluid (e.g. R1233zd(E), R290, R717) |
| `theoretical` | `true` for a technology archetype, `false` for a trained refrigerant |
| `calculation_details` | How this point's COP was arrived at — the formula, or the regression and its inputs |
| `demand_limited` | Duty capped by the sink demand, leaving waste heat unused |
| `Q_demand_total` | The full sink demand at this temperature, against which a limited point's coverage is read |
| `diagnostics` | Count of evaluated mesh points, skipped points outside operating envelope, and zero-crossing solutions |
