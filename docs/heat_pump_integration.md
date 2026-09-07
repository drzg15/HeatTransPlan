# Heat Pump Integration — Classic Method

Heat Pump Integration (HPI) determines the **operating point** for a heat pump placed on the Grand Composite Curve (GCC). It answers the key engineering questions: *At what source temperature should the heat pump extract waste heat? How much condenser duty can it deliver? And what is the resulting COP?*

The module supports both a **best-available** mode (picks whichever technology gives the highest COP at each operating point) and a **technology-specific** mode (evaluates one named heat pump type across its full operating window).

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


A heat pump is only considered available when **both** the sink temperature and the temperature lift fall within its operating window.

<details>
<summary><b>Source code:</b> <code>backend/app/modules/heat_pump_integration/heat_pump_integration.py</code> (lines 10–42)</summary>

```python
HP_OPERATING_WINDOWS = {
    'Prototypical Stirling':   {'t_sink_min': 144, 't_sink_max': 212,
                                'dt_min': 25, 'dt_max': 190},
    'VHTHP (HFC/HFO)':        {'t_sink_min': 80,  't_sink_max': 160,
                                'dt_min': 25, 'dt_max': 95},
    'SHP and HTHPs (HFC/HFO)':{'t_sink_min': 25,  't_sink_max': 100,
                                'dt_min': 10, 'dt_max': 78},
    'SHP and HTHPs (R717)':    {'t_sink_min': 70,  't_sink_max': 85,
                                'dt_min': 30, 'dt_max': 75},
}

def in_operating_window(hp_type, t_sink, dt):
    """True when the technology is rated for this sink temperature and lift."""
    w = HP_OPERATING_WINDOWS.get(hp_type)
    if w is None:
        return False
    return (w['t_sink_min'] <= t_sink <= w['t_sink_max']
            and w['dt_min'] <= dt <= w['dt_max'])
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

> [!IMPORTANT]
> **Physical Lift and Shifted Temperatures**: The source and sink temperatures taken from the Grand Composite Curve are shifted temperatures ($T_{hot} - \Delta T_{min}/2$ and $T_{cold} + \Delta T_{min}/2$). Because of this opposite shift, the difference between them ($T_{sink} - T_{source}$) exactly equals the true physical temperature lift the heat pump must overcome ($T_{cold} - T_{hot} + \Delta T_{min}$). Therefore, no additional $\Delta T_{min}$ penalty is needed in the COP calculation; it is mathematically built into the curve.
> 
> **COP Limit**: To prevent mathematically unrealistic values when the temperature lift approaches zero, the final calculated COP is strictly capped at a maximum of **15.0**.

These regression formulas take the form:

$$
COP = a \cdot (\Delta T + 2c)^b \cdot (T_{sink} + 273 + c)^d
$$

where $a, b, c, d$ are fitted regression coefficients specific to each prototypical technology. The temperature is converted to Kelvin ($+273$) for the sink term.

For example, the **VHTHP (HFC/HFO)** regression model is:

$$
COP_{VHTHP} = 1.9118 \cdot (\Delta T + 2 \times 0.04419)^{-0.89094} \cdot (T_{sink} + 273 + 0.04419)^{0.67895}
$$

### Carnot Fallback

When no named technology can operate at a given point, the system falls back to a **generic Carnot COP** at 50% efficiency factor ($\times 0.5$):

$$
COP_{Carnot} = \frac{T_{sink} + 273.15}{\Delta T} \times 0.5
$$

This represents "any theoretical heat pump" — it is not a real machine, but an upper bound for comparison.

<details>
<summary><b>Source code:</b> <code>backend/app/modules/heat_pump_integration/heat_pump_integration.py</code> (lines 19–33)</summary>

```python
HP_COP_CORRELATIONS = {
    'Prototypical Stirling':
        lambda t_sink, dt: (1.28792 * (dt + 2 * 0.54103) ** (-0.37606)
                            * (t_sink + 273 + 0.54103) ** 0.35992),
    'VHTHP (HFC/HFO)':
        lambda t_sink, dt: (1.9118 * (dt + 2 * 0.04419) ** (-0.89094)
                            * (t_sink + 273 + 0.04419) ** 0.67895),
    'SHP and HTHPs (HFC/HFO)':
        lambda t_sink, dt: 1.4480 * (10 ** 12) * (dt + 2 * 88.73) ** (-4.9469),
    'SHP and HTHPs (R717)':
        lambda t_sink, dt: (40.789 * (dt + 2 * 1.0305) ** (-1.0489)
                            * (t_sink + 273 + 1.0305) ** 0.29998),
}

def carnot_cop(t_sink, dt):
    """Carnot COP at 50% efficiency — generic fallback."""
    return (t_sink + 273.15) / dt * 0.5
```

</details>

---

## Best-Available COP Selection

When asked for the COP at a source temperature $T_{source}$, the system:

1. Computes the temperature lift: $\Delta T = T_{sink} - T_{source}$
2. Checks which technologies have this point inside their operating window
3. Evaluates the COP correlation for each valid technology
4. Returns the **highest COP** among all candidates

If no named technology applies, the Carnot fallback is returned.

<details>
<summary><b>Source code:</b> <code>backend/app/modules/heat_pump_integration/heat_pump_integration.py</code> (lines 98–118)</summary>

```python
def COP(self, T):
    """Best COP available at source temperature T, across all technologies."""
    self._check_lift(T)
    delta_T = self.t_sink_out - T

    candidates = [
        (correlation(self.t_sink_out, delta_T), hp_type)
        for hp_type, correlation in HP_COP_CORRELATIONS.items()
        if in_operating_window(hp_type, self.t_sink_out, delta_T)
    ]
    if not candidates:
        cop, hp = carnot_cop(self.t_sink_out, delta_T), 'Carnot'
    else:
        cop, hp = max(candidates, key=lambda c: c[0])
    return min(cop, 15.0), hp
```

</details>

---

## Source and Sink Profiles & Heat Recovery Modes

Before integrating the heat pump, process heat curves are converted into a **source profile** (below the pinch — heat available for the evaporator) and a **sink profile** (above the pinch — heat demand for the condenser).

The application supports **two primary heat recovery modes** depending on how much internal heat exchange is assumed to happen between process streams before placing the heat pump:

| Mode | Heat Recovery Assumption | What the Heat Pump Sees | Engineering Use Case |
|---|---|---|---|
| **net_load** (default) | **Full recovery (100%)** | Residual utility demand only (pocket-free GCC) | Standard Pinch analysis — invest in heat pump only for net deficit remaining after internal exchangers |
| **composite** | **No heat recovery (0%)** | Full raw stream duties directly | Used when streams cannot exchange heat with each other (e.g. distant buildings or contamination risks) |

### Detailed Mode Breakdown

1. **`net_load` (Full Heat Recovery - Default)**
   - All internal process heat recovery takes place first. Temperature pockets are deleted.
   - The heat pump only sees the **residual net utility demand** remaining above and below the pinch point.

2. **`composite` (No Heat Recovery - Raw Composite Curves)**
   - Assumes **zero internal heat exchange** between streams.
   - Every hot stream dumps 100% of its thermal duty into the heat pump evaporator (or cold utility).
   - Every cold stream receives 100% of its thermal duty from the heat pump condenser (or hot utility).

<details>
<summary><b>Source code:</b> <code>backend/app/modules/utility/heat_profiles.py</code> (lines 170–202)</summary>

```python
def resolve_profiles(pinch, hpi, mode="net_load"):
    """Return (source, sink) profiles for the given mode."""
    if mode == "net_load":
        # Standard: delete temperature pockets, then split GCC
        hpi.delete_temperature_pockets()
        return hpi.split_hot_and_cold()

    # Non-default modes use the problem table directly
    return build_heat_profiles(pinch, mode)
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

### Iterative sink temperature mode

When no sink temperature is specified, the system iterates: it starts at the top of the sink profile, computes $\dot{Q}_{ko}$, reads back what temperature that corresponds to on the sink curve, and repeats until the sink temperature converges within 1°C.

<details>
<summary><b>Source code:</b> <code>backend/app/modules/heat_pump_integration/heat_pump_integration.py</code> (lines 252–339)</summary>

```python
def integrate_heat_pump(self):
    # Starting at the top of the source profile
    Quelle = 0
    self.step_size_temp = (
        self.gcc_source['T'][Quelle] - self.gcc_source['T'][Quelle+1]
    ) / 10
    T = self.gcc_source['T'][Quelle] - self.step_size_temp

    while T > self.gcc_source['T'][-1]:
        # Move to next segment if needed
        if T <= self.gcc_source['T'][Quelle+1]:
            Quelle += 1

        # Skip points with no temperature lift
        if self.t_sink_out is not None and T >= self.t_sink_out:
            T -= max(self.step_size_temp, 1e-6)
            continue

        COP = self.COP(T)
        q_punkt_ev = self.q_punkt_ev(T, Quelle)  # interpolate on source
        q_punkt_ko = q_punkt_ev * ((1 - (1/COP[0])) ** (-1))

        self.cop_werte.append(round(COP[0], 3))
        self.ev_wp.append(round(q_punkt_ev))
        self.ko_wp.append(round(q_punkt_ko))
        self.cop_t.append(T)

        # Refine step size near convergence
        if q_punkt_ko >= self.gcc_sink['H'][0] and Test == 0:
            T += self.step_size_temp
            self.step_size_temp = self.step_size_temp / 200
            Test = 1
        elif q_punkt_ko >= self.gcc_sink['H'][0] and Test == 1:
            break

        T -= max(self.step_size_temp, 1e-6)
```

</details>
