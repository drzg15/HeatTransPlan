# Heat Pump Optimization — Predictive ML Model & Grid Search

While classic [Heat Pump Integration](heat_pump_integration.md) uses empirical regressions of prototypical heat pumps at a single operating point, **Heat Pump Optimization** evaluates a wide spectrum of **refrigerants and multi-stage heat pump designs** using a **trained Machine Learning model**, together with the published technology archetypes and, optionally, a COP formula of the user's own.

It evaluates every candidate across a 2D mesh of $(T_{source}, T_{sink})$ operating points to discover the exact thermal matching conditions. This is the main heat pump view of the Potential Analysis page, and the one the generated report shows.

The whole calculation is {code}`backend/app/services/optimization_service.py#run_hpi_optimization`, behind the `/api/analysis/hpi-optimization` endpoint.

---

## Predictive ML Model & Refrigerant Alternatives

The optimization engine loads a trained Scikit-Learn regressor model (persisted via `joblib`, {code}`models/cop/best_model.joblib`) along with a database of refrigerant alternatives ({code}`models/cop/cop_ranges.json`). Both are loaded once and cached.

The model predicts the COP from four inputs:

| Model input | Meaning |
|---|---|
| `T_Rücklauf_Quelle` | Source return temperature (°C) |
| `T_Vorlauf_Senke` | Sink supply temperature (°C) |
| `Medium_Senke` | Sink medium: `Water` or `Steam` |
| `Kältemittel_stufen` | Refrigerant and number of compression stages, e.g. `Butane_2` |

### Refrigerant Data Schema

The ranges file lists 42 alternatives — each refrigerant in each stage count and sink medium. Each defines its operational envelope:

| Field | Unit | Meaning |
|---|---|---|
| `name`, `Kältemittel_stufen` | — | Refrigerant and stage count, e.g. `Butane_2` |
| `refrigerant_type` | — | `Natural` or `Synthetic` |
| `hp_level` | — | Number of compression stages: 1, 2 or 3 |
| `medium_sink` | — | `Water` or `Steam` |
| `T_src_min`, `T_src_max` | °C | Valid source temperatures |
| `T_sink_min`, `T_sink_max` | °C | Valid sink temperatures |
| `cop_min`, `cop_max` | — | COP range the model was fitted on |

The file is exported from the modelling data by `cop_analysis/export_cop_ranges.py`; the training data itself is not deployed.

## Refrigerant Operating Limits

For the complete list of operating temperature ranges and COP bounds for all refrigerant alternatives, see [Refrigerant Operating Limits](refrigerant_limits.md).

**Implementation:** {code}`backend/app/services/optimization_service.py#_load_model_and_data`, {code}`backend/app/services/optimization_service.py#_model_cop_fn`

<details>
<summary><b>Show the code</b></summary>

```{literalinclude} ../backend/app/services/optimization_service.py
:language: python
:pyobject: _load_model_and_data
```

```{literalinclude} ../backend/app/services/optimization_service.py
:language: python
:pyobject: _model_cop_fn
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

```{important}
The Carnot archetype is the formula $\frac{T_{sink} + 273.15}{\Delta T} \times 0.5$ evaluated at the point's own temperatures — **not** a regression. Because it is deliberately **half** the thermodynamic ceiling rather than the ceiling itself, a real refrigerant scoring above it is expected and is not a physics violation.

The archetypes accept COPs between 1 and **15.0**. Unlike in the integration module, where a higher COP is capped at 15.0, a point above 15.0 is **discarded** here rather than capped.
```

**Implementation:** {code}`backend/app/services/optimization_service.py#_theoretical_alternatives`

<details>
<summary><b>Show the code</b></summary>

```{literalinclude} ../backend/app/services/optimization_service.py
:language: python
:pyobject: _theoretical_alternatives
```

</details>

### Provenance of each COP

Every reported point records **how its COP was arrived at**, so a number can be traced back to its source without reading code. For an archetype this is the published formula with the point's own temperatures substituted; for a trained refrigerant it names the regression, the sink medium and the number of compression stages. In the results table it sits behind the help bulb in each row.

```{note}
The trained model is a regression over a heat pump manufacturer's **simulation** parameter study — not measurements of operating machines.
```

**Implementation:** {code}`backend/app/services/optimization_service.py#_calculation_details`

<details>
<summary><b>Show the code</b></summary>

```{literalinclude} ../backend/app/services/optimization_service.py
:language: python
:pyobject: _calculation_details
```

</details>

---

## Temperature Approach Corrections

The optimizer can correct process temperatures for heat exchanger approach temperature differences before predicting the COP:

$$
T_{source,model} = T_{source,process} - \Delta T_{evap}
$$

$$
T_{sink,model} = T_{sink,process} + \Delta T_{cond}
$$

where $\Delta T_{evap}$ and $\Delta T_{cond}$ are the approach temperature drops across the evaporator and condenser.

**Both are currently set to 0 K**, so the model is evaluated at the profile temperatures directly. They are operating assumptions rather than properties of the training data, so they live in the configuration and apply to every alternative alike.

**Implementation:** {code}`backend/app/config_optimization.py#OPTIMIZATION_CONFIG`

<details>
<summary><b>Show the code</b></summary>

```{literalinclude} ../backend/app/config_optimization.py
:language: python
:start-at: OPTIMIZATION_CONFIG = {
```

</details>

---

## Custom COP Formula Evaluation

Users can enter a COP formula of their own under *COP source → Use my own COP formula*. It is **added as one more candidate** next to the trained refrigerants and the archetypes — not a replacement — so it lands in the same table and chart and can be compared against them directly. Its rows are tagged `Custom formula`.

Along with the expression, the user gives the formula's own operating window (source and sink temperature ranges), its valid COP range, the sink medium and the number of stages; the grid search treats these exactly like a trained refrigerant's envelope.

The expression may use:

| Name | Meaning |
|---|---|
| `T_source` | Source (evaporator) temperature in °C |
| `T_sink` | Sink (condenser) temperature in °C |
| `T_lift` | Temperature lift, $T_{sink} - T_{source}$, in K |
| `carnot` | Carnot COP: $T_{sink}$ in K divided by $T_{lift}$ |
| `pi`, `e` | The mathematical constants |
| `exp`, `log`, `log10`, `sqrt`, `sin`, `cos`, `tan`, `abs`, `min`, `max`, `clip`, `where` | Functions |

with the usual arithmetic, comparisons and `a if condition else b`. For example `0.5 * carnot` reproduces the 50 % Carnot baseline.

$$
COP_{custom} = f(T_{source}, T_{sink}, T_{lift})
$$

The expression is parsed into an AST (Abstract Syntax Tree) and every node checked before anything runs: only the names and operations above are accepted, so a formula cannot execute arbitrary code. While typing, the formula is checked and its COP previewed at a probe point the user can move, 60 °C → 110 °C by default.

**Implementation:** {code}`backend/app/utils/cop_formula.py#compile_formula`, turned into a candidate by {code}`backend/app/services/optimization_service.py#_formula_alternative`; entered in {code}`frontend/src/components/analysis/CopFormulaModal.tsx`

<details>
<summary><b>Show the code</b></summary>

```{literalinclude} ../backend/app/utils/cop_formula.py
:language: python
:pyobject: compile_formula
```

```{literalinclude} ../backend/app/services/optimization_service.py
:language: python
:pyobject: _formula_alternative
```

</details>

---

## 2D Mesh Grid Search Algorithm

The optimization algorithm evaluates candidates across a 2D mesh of all valid $(T_{source}, T_{sink})$ pairs extracted from the source and sink profiles of the selected [heat recovery mode](heat_pump_integration.md#source-and-sink-profiles--heat-recovery-modes).

### The grid

Both temperature axes run from the coldest to the hottest point of their profile in **0.5 K** steps, with the profile's own breakpoints added so no corner is missed. Available waste heat and sink demand are read off the profiles by linear interpolation.

A grid point is a valid operating point for a candidate only if:

- the COP is above 1 and inside the candidate's COP range;
- the source and sink temperatures are inside the candidate's operating window;
- the lift is at least **10 K** ($T_{source} \leq T_{sink} - 10$).

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

**Implementation:** {code}`backend/app/services/optimization_service.py#run_hpi_optimization`

<details>
<summary><b>Show the code</b></summary>

```{literalinclude} ../backend/app/services/optimization_service.py
:language: python
:start-at: step = OPTIMIZATION_CONFIG
:end-before: if found_full:
:dedent:
```

</details>

---

## Source-Limited Heat Pump Integration

When available waste heat is insufficient to cover the full process heating demand, the algorithm evaluates **source-limited integration points**.

In this regime, the heat pump absorbs all available waste heat $\dot{Q}_{available}$, and the maximum achievable condenser heat delivery is:

$$
\dot{Q}_{sink,achievable} = \min\left(\dot{Q}_{available} \cdot \frac{COP}{COP - 1},\ \dot{Q}_{demand}\right)
$$

For each candidate and sink temperature, the grid point delivering the most heat is kept (the higher COP breaks a tie). It is reported as a valid source-limited option if its coverage ratio reaches the threshold:

$$
\frac{\dot{Q}_{sink,achievable}}{\dot{Q}_{demand}} \ge 0.01 \quad (1\%)
$$

Points below it are not design options; they are left out but counted in the diagnostics, so the omission stays visible.

**Implementation:** {code}`backend/app/services/optimization_service.py#run_hpi_optimization`, threshold {code}`backend/app/services/optimization_service.py#MIN_COVERAGE`

<details>
<summary><b>Show the code</b></summary>

```{literalinclude} ../backend/app/services/optimization_service.py
:language: python
:start-at: "# No exact match between available source heat"
:end-at: diag.accepted_demand_limited += 1
:dedent:
```

</details>

---

## Selecting the Maximum-Duty Point

The result names the point delivering the **greatest sink duty** — the largest heat pump the process can absorb — as `max_q_point`. Many candidates typically reach that same maximum: in a representative case 48 machines tie at the top duty, with COPs spanning 2.57 to 9.08, because the duty ceiling is set by the process profile rather than by the machine.

A plain `>` comparison therefore left the winner to iteration order, and could report a markedly worse machine than an equally large one sitting beside it. Ties are broken by COP:

$$
\text{select } p \quad \text{if} \quad \dot{Q}_p > \dot{Q}_{max} \quad \text{or} \quad \left( \dot{Q}_p = \dot{Q}_{max} \ \text{and} \ COP_p > COP_{max} \right)
$$

```{note}
`max_q_point` can be an archetype or an off-profile point. The page and the report highlight a real machine on the chart, so they use it only when it is one — see [How the results are shown](#how-the-results-are-shown).
```

---

## Demand-Limited Heat Pump Integration

The mirror image of the source-limited case. Here waste heat is *not* the constraint — there is more of it than the sink can absorb — so the duty is capped at the process demand and the surplus waste heat is left unused:

$$
\dot{Q}_{sink} = \dot{Q}_{demand} \quad \text{while} \quad \dot{Q}_{available} > \dot{Q}_{demand} \cdot \frac{COP - 1}{COP}
$$

The distinction matters for reading the charts. A **source-limited** point sits off the *sink* profile, because it cannot reach the demand; a **demand-limited** point sits off the *source* profile, because it does not consume all the waste heat available. Both are partial solutions: they are **hidden from the chart by default** — the checkboxes *Plot source-limited points* and *Plot demand-limited points* bring them back, drawn as hollow markers — and both are excluded from the COP-versus-coverage frontier, where a capped machine would otherwise put a dip in the curve at the coverage where it happens to be the only candidate. They stay in the results table.

| Flag | Constraint | Sits off | Meaning |
|---|---|---|---|
| `source_limited` | Waste heat runs out | Sink profile | Cannot meet the full demand |
| `demand_limited` | Sink demand runs out | Source profile | Leaves waste heat unused |

**Implementation:** the COP-versus-coverage frontier is {code}`frontend/src/components/analysis/CopCoverageChart.tsx`

---

## Output Summary

The service returns every feasible operating point; sorting and filtering are left to the page. The result ({code}`backend/app/models/analysis.py#HPIOptimizationResult`):

| Field | Meaning |
|---|---|
| `feasible_points` | Every accepted operating point — full, source-limited and demand-limited — for every candidate |
| `max_q_point` | The point delivering the greatest sink duty, ties broken by COP |
| `original_gcc` | The grand composite curve, drawn faint behind the chart |
| `pocketless_source`, `pocketless_sink` | The source and sink profiles the search ran on, for the selected mode |
| `profile_mode` | `net_load` (with heat recovery) or `composite` (no heat recovery) |
| `diagnostics` | The profile ranges, and how many candidates were accepted or rejected and why — so an empty result can explain itself |

Each operating point ({code}`backend/app/models/analysis.py#OptimizedIntegrationPoint`):

| Field | Meaning |
|---|---|
| `refrigerant` | Refrigerant and stage count (e.g. `Butane_2`), archetype name, or the custom formula's name |
| `refrigerant_type` | `Natural`, `Synthetic`, `Theoretical` or `Custom formula` |
| `medium_sink`, `hp_level` | Sink medium and number of compression stages |
| `T_source`, `T_sink` | Operating temperatures, on the shifted scale of the profiles |
| `COP` | Coefficient of performance at that point |
| `Q_demand` | Heat delivered to the sink |
| `Q_source` | Heat drawn from the source |
| `Q_demand_total` | The full sink demand at this temperature, against which a limited point's coverage is read |
| `source_limited`, `demand_limited` | The partial-solution flags above |
| `theoretical` | `true` for a technology archetype |
| `calculation_details` | How this point's COP was arrived at — the formula, or the regression and its inputs |

The table on the page derives the remaining columns: the electrical input $W_{el} = \dot{Q}_{sink} / COP$, and the **actual** temperatures. `T_source` and `T_sink` are the shifted ones the COP is computed at, shown as they are in the columns headed *Shifted*; the actual sink temperature is $\Delta T_{min}/2$ below the shifted one, the actual source temperature $\Delta T_{min}/2$ above.

---

## How the results are shown

The optimization returns hundreds or thousands of points. What the page shows of them follows a fixed set of rules, and the [generated report](#the-report) applies the same ones.

**The chart** plots only on-profile points by default (see [Demand-Limited Heat Pump Integration](#demand-limited-heat-pump-integration)), falling back to every point if none is on a profile. It then **thins** them: per sink temperature, the best COP for each refrigerant type (each technology, for the archetypes); and where dozens of points stack at practically the same duty on a steep stretch of the profile, only the coolest sink in each step of 2 % of the duty range is kept — the cheapest lift for that duty.

**The highlighted pump** — the one drawn with the box, the COP and the electrical input — is `max_q_point` if it is a real machine on the chart. Otherwise it is the real machine on the chart delivering the most heat, ties broken by COP. Carnot would otherwise always take the box at the top duty.

**The filters** — sink medium, refrigerant type, refrigerant, stages, the archetypes, the off-profile points — narrow the points before any of the rules below apply ({code}`frontend/src/components/analysis/hpRules.ts#filterPoints`). They are saved with each scenario.

**Clicking a point** picks every machine at that sink temperature. The box moves to the best of them, and they join the table, shaded. A pick lasts until it is cleared: a new result keeps it if that exact pump is in it, and a filter change keeps it if the filter still lets it through ({code}`frontend/src/components/analysis/hpRules.ts#picksAmong`, {code}`frontend/src/store/analysisStore.ts#useAnalysisStore.setHPIOptimizationResult`). A filter value the new result no longer offers falls back to *All* ({code}`frontend/src/components/analysis/hpRules.ts#filtersFor`).

**The table** lists the best real machine per refrigerant type, plus Carnot and the best of the other archetypes — best meaning most heat delivered, COP breaking a tie — plus any picked pump. It opens sorted by heat delivered, highest first; clicking a column header re-sorts it.

**Implementation:** {code}`frontend/src/components/analysis/hpRules.ts` — {code}`frontend/src/components/analysis/hpRules.ts#chartPointsOf`, {code}`frontend/src/components/analysis/hpRules.ts#thinnedCloudOf`, {code}`frontend/src/components/analysis/hpRules.ts#defaultHighlightOf`, {code}`frontend/src/components/analysis/hpRules.ts#activePointsOf`, {code}`frontend/src/components/analysis/hpRules.ts#boxPointOf`, {code}`frontend/src/components/analysis/hpRules.ts#tableRowsOf`, {code}`frontend/src/components/analysis/hpRules.ts#DEFAULT_TABLE_SORT`; used by {code}`frontend/src/components/analysis/HPIOptimizationPanel.tsx` and {code}`frontend/src/components/analysis/HPIOptimizationChart.tsx`

### The report

The generated report draws the same chart and table on the server, with a function-for-function port of these rules ({code}`backend/app/services/report/hp_rules.py#_hp_view`). Each scenario's picked pumps and filters are sent along, so the report shows the same rows, chart and boxed pump as the page; above the table it lists the filters that were on, so a filtered table is not read as the full one. A request without filters gets the page's defaults ({code}`backend/app/models/report.py#HPFilters`).

Both implementations are tested against one shared file, {code}`contracts/hp_rules.json`: hand-written points that hit every rule, with the outputs the page's rules give for them. A rule changed on one side and not the other fails a test ({code}`frontend/src/components/analysis/hpRules.test.ts`, {code}`backend/tests/test_hp_rules_contract.py`).
