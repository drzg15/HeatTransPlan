# Heat Pump Integration — Classic Method

Heat Pump Integration (HPI) determines the **operating point** for a heat pump placed on the Grand Composite Curve (GCC). It answers the key engineering questions: *At what source temperature should the heat pump extract waste heat? How much condenser duty can it deliver? And what is the resulting COP?*

In the app this is the **single-point heat pump analysis**: on the Potential Analysis page it sits behind the *Show single-point heat pump analysis* button, below the [optimization](heat_pump_optimization.md), which is the main view. It is not part of the generated report.

The module supports two modes:

- **Technology-specific** — one named heat pump type, across its own operating window. This is what the app runs: each of the five technologies below is integrated separately ({code}`backend/app/services/analysis_service.py#run_hpi`), and one that leaves its rated window during the walk is listed as unavailable, with the reason.
- **Best-available** — at each operating point, whichever technology gives the highest COP. Available in the module; the app does not use it.

---

## Heat Pump Technologies and Operating Windows

Each heat pump technology has a defined **operating envelope**: a sink temperature range it is built for, and a temperature lift it can deliver. These are hard limits from manufacturer data.

| Technology | $T_{sink,min}$ (°C) | $T_{sink,max}$ (°C) | $\Delta T_{min}$ (°C) | $\Delta T_{max}$ (°C) |
|---|---|---|---|---|
| Prototypical Stirling | 144 | 212 | 25 | 190 |
| VHTHP (HFC/HFO) | 80 | 160 | 25 | 95 |
| SHP and HTHPs (HFC/HFO) | 25 | 100 | 10 | 78 |
| SHP and HTHPs (R717) | 70 | 85 | 30 | 75 |
| Theoretical Carnot ($\times 0.5$ efficiency) | $-\infty$ | $+\infty$ | $0$ | $+\infty$ |

The table is the single source of truth: the COP functions, the list of available heat pumps and the exclusion messages all read it.

**Implementation:** {code}`backend/app/modules/heat_pump_integration/heat_pump_integration.py#HP_OPERATING_WINDOWS`, checked by {code}`backend/app/modules/heat_pump_integration/heat_pump_integration.py#in_operating_window`

<details>
<summary><b>Show the code</b></summary>

```{literalinclude} ../backend/app/modules/heat_pump_integration/heat_pump_integration.py
:language: python
:start-at: HP_OPERATING_WINDOWS = {
:end-before: HP_COP_CORRELATIONS
```

```{literalinclude} ../backend/app/modules/heat_pump_integration/heat_pump_integration.py
:language: python
:pyobject: in_operating_window
```

</details>

---

## Regressions of Prototypical Heat Pumps

The COP models for classic heat pump integration are **empirical regressions of prototypical heat pump technologies** (fitted from manufacturer performance datasets and literature models), rather than theoretical thermodynamic correlations.

Each prototypical technology model represents a specific heat pump architecture, refrigerant class, and temperature range:

- **Prototypical Stirling**: Stirling cycle heat pump baseline for high-temperature lift process applications ($T_{sink}$: 144°C–212°C, $\Delta T$: 25–190 K).
- **VHTHP (HFC/HFO)**: **Very High Temperature Heat Pump** utilizing low-GWP fluorinated refrigerants (HFC/HFO blends) for high-temperature process steam and hot water generation ($T_{sink}$: 80°C–160°C, $\Delta T$: 25–95 K).
- **SHP and HTHPs (HFC/HFO)**: **Standard Heat Pumps (SHP) & High Temperature Heat Pumps (HTHP)** using synthetic HFC/HFO refrigerants ($T_{sink}$: 25°C–100°C, $\Delta T$: 10–78 K).
- **SHP and HTHPs (R717)**: **Standard & High Temperature Heat Pumps** using natural Ammonia (R717) refrigerant ($T_{sink}$: 70°C–85°C, $\Delta T$: 30–75 K).
- **Theoretical Carnot (50% Carnot / 0.5 Carnot)**: Theoretical Carnot baseline operating at 50% exergetic second-law efficiency factor ($\eta_{Carnot} = 0.5$).

```{important}
**Physical Lift and Shifted Temperatures**: The source and sink temperatures taken from the Grand Composite Curve are shifted temperatures ($T_{hot} - \Delta T_{min}/2$ and $T_{cold} + \Delta T_{min}/2$). Because of this opposite shift, the difference between them ($T_{sink} - T_{source}$) exactly equals the true physical temperature lift the heat pump must overcome ($T_{cold} - T_{hot} + \Delta T_{min}$). Therefore, no additional $\Delta T_{min}$ penalty is needed in the COP calculation; it is mathematically built into the curve.

**COP Limit**: To prevent mathematically unrealistic values when the temperature lift approaches zero, the calculated COP is capped at **15.0** — a higher value is reported as 15.0.
```

These regression formulas take the form:

$$
COP = a \cdot (\Delta T + 2c)^b \cdot (T_{sink} + 273 + c)^d
$$

where $a, b, c, d$ are fitted regression coefficients specific to each prototypical technology. The temperature is converted to Kelvin ($+273$) for the sink term. *SHP and HTHPs (HFC/HFO)* is the exception: its fit depends on the lift alone, $COP = a \cdot (\Delta T + 2c)^b$.

For example, the **VHTHP (HFC/HFO)** regression model is:

$$
COP_{VHTHP} = 1.9118 \cdot (\Delta T + 2 \times 0.04419)^{-0.89094} \cdot (T_{sink} + 273 + 0.04419)^{0.67895}
$$

The app shows the formula behind every number: each technology's COP comes with the regression written out and the point's own temperatures substituted ({code}`backend/app/modules/heat_pump_integration/heat_pump_integration.py#HP_COP_FORMULAS`).

### The 50 % Carnot Baseline

Alongside the regressions, every operating point is also rated by a **generic Carnot COP** at 50 % efficiency ($\times 0.5$):

$$
COP_{Carnot} = \frac{T_{sink} + 273.15}{\Delta T} \times 0.5
$$

This represents "any heat pump" — not a real machine. It is deliberately **half** the thermodynamic ceiling, a rule of thumb for a realistically achievable machine rather than an upper bound: a real refrigerant scoring above it is expected and is not a physics violation.

**Implementation:** {code}`backend/app/modules/heat_pump_integration/heat_pump_integration.py#HP_COP_CORRELATIONS`, {code}`backend/app/modules/heat_pump_integration/heat_pump_integration.py#carnot_cop`

<details>
<summary><b>Show the code</b></summary>

```{literalinclude} ../backend/app/modules/heat_pump_integration/heat_pump_integration.py
:language: python
:start-at: HP_COP_CORRELATIONS = {
:end-before: "# String templates"
```

```{literalinclude} ../backend/app/modules/heat_pump_integration/heat_pump_integration.py
:language: python
:pyobject: carnot_cop
```

</details>

---

## COP Selection

In the **technology-specific** mode the app uses, the COP at a source temperature $T_{source}$ is that technology's correlation at the lift $\Delta T = T_{sink} - T_{source}$. If the point falls outside the technology's operating window, the calculation stops with an error instead of quietly substituting another number, and the technology is reported as unavailable with the reason.

In the **best-available** mode, the system:

1. Computes the temperature lift: $\Delta T = T_{sink} - T_{source}$
2. Checks which technologies have this point inside their operating window
3. Evaluates the COP correlation for each valid technology
4. Returns the **highest COP** among all candidates

The 50 % Carnot baseline is always among the candidates, since its window is unbounded: it is returned whenever no named technology applies, or when it scores highest.

Either way, a lift of zero or less is rejected — there is no heat pump to place.

**Implementation:** {code}`backend/app/modules/heat_pump_integration/heat_pump_integration.py#HeatPumpIntegration.COP_specific`, {code}`backend/app/modules/heat_pump_integration/heat_pump_integration.py#HeatPumpIntegration.COP`

<details>
<summary><b>Show the code</b></summary>

```{literalinclude} ../backend/app/modules/heat_pump_integration/heat_pump_integration.py
:language: python
:pyobject: HeatPumpIntegration.COP_specific
```

```{literalinclude} ../backend/app/modules/heat_pump_integration/heat_pump_integration.py
:language: python
:pyobject: HeatPumpIntegration.COP
```

</details>

---

## Source and Sink Profiles & Heat Recovery Modes

Before integrating the heat pump, process heat curves are converted into a **source profile** (below the pinch — heat available for the evaporator) and a **sink profile** (above the pinch — heat demand for the condenser).

The application supports **two heat recovery modes**, chosen on the Potential Analysis page, depending on how much internal heat exchange is assumed to happen between process streams before placing the heat pump:

| Mode | Heat Recovery Assumption | What the Heat Pump Sees |
|---|---|---|
| **With heat recovery** (default) | **Full recovery (100%)** | Residual utility demand only (pocket-free GCC) |
| **No heat recovery** | **No heat recovery (0%)** | Full raw stream duties directly (composite curves) |

### Detailed Mode Breakdown

1. **With heat recovery (Full Heat Recovery - Default)**
   - All internal process heat recovery takes place first. [Temperature pockets are deleted](pinch_analysis.md#step-8--temperature-pocket-deletion).
   - The heat pump only sees the **residual net utility demand** remaining above and below the pinch point.

2. **No heat recovery (Raw Composite Curves)**
   - Assumes **zero internal heat exchange** between streams.
   - Every hot stream dumps 100% of its thermal duty into the heat pump evaporator (or cold utility).
   - Every cold stream receives 100% of its thermal duty from the heat pump condenser (or hot utility).
   - The composite curves have no pinch, so the source and sink temperature ranges can overlap; points without a positive lift are skipped.

**Implementation:** {code}`backend/app/modules/utility/heat_profiles.py#resolve_profiles`, with {code}`backend/app/modules/heat_pump_integration/heat_pump_integration.py#HeatPumpIntegration.split_hot_and_cold` for the default mode and {code}`backend/app/modules/utility/heat_profiles.py#_composite_profiles` for the other

<details>
<summary><b>Show the code</b></summary>

```{literalinclude} ../backend/app/modules/utility/heat_profiles.py
:language: python
:pyobject: resolve_profiles
```

```{literalinclude} ../backend/app/modules/utility/heat_profiles.py
:language: python
:pyobject: _composite_profiles
```

</details>

---

## Integration Walk: Finding the Operating Point

The integration walk is the core algorithm. Starting from the hottest point of the source profile, it steps downward in temperature and computes at each point:

### At each source temperature $T$:

1. **Evaporator duty** $\dot{Q}_{ev}$: Read from the source profile by linear interpolation:

$$
\dot{Q}_{ev}(T) = \dot{Q}_{source}(T_i) + \frac{\dot{Q}_{source}(T_{i+1}) - \dot{Q}_{source}(T_i)}{T_{i+1} - T_i} \cdot (T - T_i)
$$

2. **COP**: Evaluated at the current source temperature using the selected correlation.

3. **Condenser duty** $\dot{Q}_{ko}$: Derived from the evaporator duty and COP using the first law:

$$
\dot{Q}_{ko} = \dot{Q}_{ev} \cdot \left(1 - \frac{1}{COP}\right)^{-1}
$$

This formula comes from the heat pump energy balance: $\dot{Q}_{ko} = \dot{Q}_{ev} + W_{el}$, where $W_{el} = \dot{Q}_{ko} / COP$.

### Convergence

The walk continues until the condenser duty meets the sink demand. When it gets close, the **step size is refined** (divided by 200) for precision. The iteration converges when $\dot{Q}_{ko}$ matches the sink profile at the target sink temperature.

The reported operating point is the last point of the walk — the converged one — unless the very first (hottest) source point already covers the hot utility requirement, in which case the heat pump over-delivers straight away and that point is reported.

### Iterative sink temperature mode

When no sink temperature is specified — as in the app — the system iterates: it starts at the top of the sink profile, computes $\dot{Q}_{ko}$, reads back what temperature that corresponds to on the sink curve, and repeats until the sink temperature converges within 1°C.

**Implementation:** {code}`backend/app/modules/heat_pump_integration/heat_pump_integration.py#HeatPumpIntegration.integrate_heat_pump`, pinned to one technology by {code}`backend/app/modules/heat_pump_integration/heat_pump_integration.py#HeatPumpIntegration.integrate_heat_pump_specific`; the reported point is picked by {code}`backend/app/modules/heat_pump_integration/heat_pump_integration.py#HeatPumpIntegration.find_integration`

<details>
<summary><b>Show the code</b></summary>

```{literalinclude} ../backend/app/modules/heat_pump_integration/heat_pump_integration.py
:language: python
:pyobject: HeatPumpIntegration.integrate_heat_pump
```

```{literalinclude} ../backend/app/modules/heat_pump_integration/heat_pump_integration.py
:language: python
:pyobject: HeatPumpIntegration.integrate_heat_pump_specific
```

```{literalinclude} ../backend/app/modules/heat_pump_integration/heat_pump_integration.py
:language: python
:pyobject: HeatPumpIntegration.find_integration
```

</details>

---

## On the Page

The single-point analysis draws each available technology's operating point on the GCC — or, in the *no heat recovery* mode, between the mirrored source and sink profiles — and lists them with their COP, temperatures and duties.

**Implementation:** {code}`frontend/src/components/analysis/HPIChart.tsx#HPIChart`, {code}`frontend/src/components/analysis/HeatPumpTable.tsx`
