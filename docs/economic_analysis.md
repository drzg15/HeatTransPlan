# Economic Analysis — Net Present Value of the Heat Pump

The heat pump optimization says what a machine *can* deliver. The **economic analysis** asks whether it is worth buying: it compares the heat pump with the system it replaces, year by year, and turns the difference into a **net present value**, a **dynamic payback** and a **break-even electricity price**.

The method is the **net present value method** (*Kapitalwertmethode*) with price-dynamic cash flows, the approach of **VDI 2067-1**. The layout of the results follows an industrial heat pump feasibility study (Hipp, 2026), whose numbers the implementation reproduces to the euro (see *Validation against the reference study* below).

All of it runs in the browser, so every input change and every click on the sensitivity map updates at once.

---

## What is compared

Both systems are costed **in full** every year:

| System | Supplies heat with | Removes the source's waste heat with |
|---|---|---|
| **Reference** (current situation) | a fuel-fired heater (gas, oil or electric boiler) | today's cooling, if the source is actively cooled |
| **Heat pump** | the heat pump, plus the old heater for whatever the pump does not cover | the heat pump's evaporator, plus the old cooling for what it does not take |

The heat pump is credited only with what it actually replaces. A pump that covers 60 % of the demand leaves 40 % on the old heater, and that residual fuel stays in its costs.

### The pump analysed

One pump is analysed at a time, so the results stay readable:

- nothing selected on the optimization chart → the default pump the chart highlights (largest duty);
- one or more selected → the best of the selection: real machines before theoretical archetypes, then the largest heat output, then the highest COP.

### The reference demand

The reference must supply the **largest** demand any candidate could cover, so a small and a large pump are compared against the same current situation:

$$
\dot{Q}_{ref} = \max_p \dot{Q}_{demand,total,p} \qquad \dot{Q}_{src,ref} = \max_p \dot{Q}_{source,p}
$$

taken over the analysed pump, the maximum-duty point and all real feasible points of the optimization.

<details>
<summary><b>Source code:</b> <code>frontend/src/components/analysis/econModel.ts</code> (<code>pickPump</code>, <code>econCore</code>)</summary>

```{literalinclude} ../frontend/src/components/analysis/econModel.ts
:language: typescript
:start-at: export const pickPump
:end-before: type Fig =
```

</details>

---

## Inputs

The six inputs people change most sit in the **Key inputs** row; everything else is under **More assumptions**. Every input has a help bulb with typical values.

| Group | Input | Symbol | Unit | Default |
|---|---|---|---|---|
| General | First year of operation | $t_0$ | year | next year |
| | Full-load hours | $h$ | h/year | 8.760 |
| | Discount rate | $i$ | % | 6 |
| | Period of analysis | $T$ | years | 15 |
| Reference heater | Type | | | gas boiler |
| | Efficiency | $\eta$ | % | 90 |
| | Fuel price (excl. CO₂) | $p_{fuel,0}$ | ct/kWh | 6 |
| | Fuel price change | $r_{fuel}$ | %/year | 3 |
| | CO₂ factor of the fuel | $c_{CO_2}$ | t/MWh | 0,201 |
| | CO₂ price | $p_{CO_2,0}$ | €/t | 55 |
| | CO₂ price change | $r_{CO_2}$ | %/year | 5 |
| Electricity | Electricity price | $p_{el,0}$ | ct/kWh | 13 |
| | Electricity price change | $r_{el}$ | %/year | 3 |
| | CO₂ factor of electricity | $c_{CO_2,el}$ | t/MWh | 0,352 (UBA 2025) |
| Heat pump | Specific investment | $c_{spec}$ | €/kW | 850 |
| | Maintenance | $f_M$ | % of $I$ per year | 5 |
| | Capacity charge | $p_C$ | €/kW$_{el}$ per year | 0 |
| | Reinvestment | | % of $I$ in a chosen year | 0 |
| | Service life (residual value) | $L$ | years | 20 |
| | Investment funding | $\varphi$ | % of $I$ | 0 |
| Operating funding | Funding per MWh of heat | $f_{op}$ | €/MWh | 0 |
| | Paid for | $t_{op}$ | years | 10 |
| Cooling | Actively cooled share of the source heat | $a$ | % | 0 |
| | Cooling COP (EER) | $EER$ | – | 4 |

Choosing the reference type loads a preset for efficiency, fuel price and CO₂ factor (gas 90 % / 6 ct / 0,201; oil 88 % / 8 ct / 0,266; electric boiler 99 % / 13 ct / 0,352). The electric boiler's CO₂ is already in its electricity price, so no CO₂ cost is added on top.

**Investment.** Specific investment and investment are one value seen two ways, $I = c_{spec} \cdot \dot{Q}$; editing either updates the other. The default 850 €/kW is the middle of the literature range for industrial high-temperature heat pumps:

| Source | Specific investment |
|---|---|
| [Danish Energy Agency (2026), Technology Data – Industrial Process Heat](https://ens.dk/media/7757/download) | 1.400 €/kW ≤ 125 °C, 1.750 €/kW ≤ 150 °C (steam, incl. installation) |
| [Energy (2024): VHTHPs in European markets](https://www.sciencedirect.com/science/article/pii/S0360544224029220) | ~200–1.500 €/kW, ≥ 600 €/kW for lifts > 100 K |
| [TNO / energy.nl factsheet](https://energy.nl/wp-content/uploads/industrial-high-temperature-heat-pump-2-7.pdf) | 300–900 €/kW up to 160 °C |

> [!NOTE]
> The full-load hours default to 8.760 h, i.e. the pump runs at the analysed duty all year. Until a load profile drives it, lower $h$ for shift or seasonal operation.

All inputs are kept for the whole project: every saved scenario is evaluated with the same prices and assumptions, so scenarios differ only in their heat pump.

---

## Step 1 — Energy flows per year

The heat pump draws electricity for its duty; the old heater burns fuel for the rest; the old cooling still removes whatever source heat the pump does not take:

$$
E_{fuel} = \frac{(\dot{Q}_{ref} - \dot{Q}) \cdot h}{\eta} \qquad
E_{el} = \frac{\dot{Q} \cdot h}{COP} \qquad
E_{cool} = \frac{(\dot{Q}_{src,ref} - \dot{Q}_{src}) \cdot h \cdot a}{EER}
$$

For the reference, $\dot{Q} = \dot{Q}_{src} = 0$ and $E_{el} = 0$.

**CO₂ emissions** follow from the same flows:

$$
CO_2 = E_{fuel} \cdot c_{CO_2} + (E_{el} + E_{cool}) \cdot c_{CO_2,el}
$$

**Final energy saving** is the difference in final energy, fuel and electricity alike:

$$
\Delta E = (E_{fuel} + E_{cool})_{ref} - (E_{fuel} + E_{el} + E_{cool})_{HP}
$$

## Step 2 — Prices over time

Prices are given for the base year and change from year 1 at their own rates. The fuel carries a CO₂ cost with its own price path:

$$
p_{fuel}(t) = p_{fuel,0} \cdot (1 + r_{fuel})^t + \frac{c_{CO_2}}{1000} \cdot p_{CO_2,0} \cdot (1 + r_{CO_2})^t
$$

$$
p_{el}(t) = p_{el,0} \cdot (1 + r_{el})^t
$$

<details>
<summary><b>Source code:</b> <code>frontend/src/utils/economics.ts</code> (<code>fuelPrice</code>, <code>elPrice</code>)</summary>

```{literalinclude} ../frontend/src/utils/economics.ts
:language: typescript
:start-at: /** Fuel price incl. CO₂ cost
:end-before: /** Energy flows and fixed costs
```

</details>

## Step 3 — Operating costs per year

$$
K(t) = E_{fuel} \cdot p_{fuel}(t) + (E_{el} + E_{cool}) \cdot p_{el}(t) + f_M \cdot I + p_C \cdot P_{el} - F_{op}(t)
$$

with $P_{el} = \dot{Q} / COP$ and the operating funding

$$
F_{op}(t) = \begin{cases} f_{op} \cdot \dot{Q} \cdot h & t \le t_{op} \\ 0 & \text{otherwise} \end{cases}
$$

Maintenance, capacity charge and operating funding apply to the heat pump only. The **cost saving in year 1** is $S(1) = K_{ref}(1) - K_{HP}(1)$.

<details>
<summary><b>Source code:</b> <code>frontend/src/utils/economics.ts</code> (<code>flows</code>)</summary>

```{literalinclude} ../frontend/src/utils/economics.ts
:language: typescript
:start-at: function flows(
:end-before: export function referenceCost
```

</details>

## Step 4 — Net present value

The yearly cash flow is what the heat pump saves against the reference:

$$
CF(t) = K_{ref}(t) - K_{HP}(t)
$$

The net present value discounts every cash flow to the base year, after the investment net of funding, any reinvestment $R(t)$, and the residual value at the end of the period:

$$
NPV = -(1 - \varphi) \cdot I + \sum_{t=1}^{T} \frac{CF(t) - R(t)}{(1 + i)^t} + \frac{RV}{(1 + i)^T}
$$

The **residual value** depreciates the investment linearly over its service life:

$$
RV = I \cdot \max\left(0,\ 1 - \frac{T}{L}\right)
$$

A positive NPV means the heat pump earns more over $T$ years than the money would earn at the discount rate $i$.

**ROI** is reported as $NPV / ((1 - \varphi) \cdot I)$. The reference study shows an ROI without its definition, so this one is an assumption.

## Step 5 — Dynamic payback

The **dynamic payback** is the first year in which the cumulated, discounted cash flows have recovered the net investment:

$$
t_P = \min \{ k : NPV(k) \ge 0 \}, \qquad NPV(k) = -(1 - \varphi) \cdot I + \sum_{t=1}^{k} \frac{CF(t) - R(t)}{(1 + i)^t}
$$

The search runs past $T$ up to **40 years**, so a pump that pays back after the period still gets a year. The residual value is left out here: it is not cash in hand before the end of the period. The NPV-over-time chart interpolates between the two years around the crossing for the exact point.

<details>
<summary><b>Source code:</b> <code>frontend/src/utils/economics.ts</code> (<code>evaluate</code>)</summary>

```{literalinclude} ../frontend/src/utils/economics.ts
:language: typescript
:start-at: export function evaluate
:end-before: /** Electricity price
```

</details>

## Step 6 — Break-even electricity price

For a given fuel price, the **break-even electricity price** $p_{el}^*$ is the one at which the NPV is exactly zero. Below it the heat pump wins. The NPV is linear in the electricity price, so two evaluations give the root exactly:

$$
p_{el}^* = -\frac{NPV(p_{el} = 0)}{NPV(p_{el} = 1) - NPV(p_{el} = 0)}
$$

<details>
<summary><b>Source code:</b> <code>frontend/src/utils/economics.ts</code> (<code>breakEvenElPrice</code>)</summary>

```{literalinclude} ../frontend/src/utils/economics.ts
:language: typescript
:start-at: export function breakEvenElPrice
```

</details>

---

## Charts

| Chart | What it shows |
|---|---|
| **Investment and cumulative operating costs** | One stacked bar per system: investment plus the nominal (undiscounted) operating costs over $T$. The legend gives the investment's share of the total. |
| **Energy prices over time** | $p_{fuel}(t)$ incl. CO₂ and $p_{el}(t)$ over the period. |
| **NPV over time** | $NPV(k)$ year by year, past $T$ until payback; red markers before payback, green after; a dotted line marks the end of the period. |
| **Sensitivity map** | NPV for every pair of fuel and electricity prices, each from 0 to twice the entered price. Cells are red where the reference is cheaper and green where the heat pump pays off; the dashed line is $p_{el}^*$ per fuel price; the dot is the entered prices. Clicking a cell adopts its prices everywhere. The step is chosen so each axis has at most about 14 cells. |
| **Economic heat pump size** | NPV against heat output for every real feasible pump of the optimization, keeping the best machine per 1 % of the demand. A smaller pump costs less but leaves more on the old heater; the peak (gold diamond) is the economic optimum. Clicking a point analyses that pump. |

A plain-language **summary** closes the section: coverage, energy and CO₂ saved, cost saving, investment, payback, NPV and break-even price of the pump analysed.

---

## Scenario comparison and report

- **Scenario comparison** (Potential Analysis page): each saved scenario gets its investment, NPV, dynamic payback and cost saving in year 1, plus a bar chart of NPV per scenario. All scenarios use the same economic inputs.
- **HTML report**: every scenario page ends with the full economic analysis — key results, all inputs, both result tables, the five charts and the summary. The comparison page carries the same four economic columns and the NPV-per-scenario chart.

The panel, the comparison and the report are all built from one module, so they always show the same numbers.

<details>
<summary><b>Source code:</b> <code>frontend/src/components/analysis/econModel.ts</code> (<code>econReportData</code>)</summary>

```{literalinclude} ../frontend/src/components/analysis/econModel.ts
:language: typescript
:start-at: export function econReportData
```

</details>

---

## Validation against the reference study

The study compares a gas boiler (current situation, 7 ct/kWh incl. CO₂) with two heat pump variants, *Status Quo* and *Max. WRG* (maximum heat recovery), at 13 ct/kWh electricity, 3 % price change, 6 % discount rate, 15 years and 5 % maintenance. With the extensions it does not have switched off (separate CO₂ cost, cooling, capacity charge, reinvestment, residual value), the implementation reproduces its table exactly:

| Value | Study | HeatTransPlan |
|---|---|---|
| Operating costs year 1, reference | 921.299 € | 921.299 € |
| Operating costs year 1, Status Quo / Max. WRG | 1.002.617 / 822.716 € | 1.002.617 / 822.716 € |
| Cost saving year 1, Status Quo / Max. WRG | −81.318 / 98.583 € | −81.318 / 98.583 € |
| NPV, Status Quo | −3.222.575 € | −3.222.575 € |
| Cumulative costs, reference / Status Quo / Max. WRG | 17.135.161 / 18.194.115 / 14.713.211 € | identical |

> [!IMPORTANT]
> The study's NPV for Max. WRG (−4.025.615 €) cannot be reproduced and contradicts the study itself: the variant has a positive yearly saving and lower cumulative costs than the reference, yet its NPV curve falls every year. The same formulas that give exactly −3.222.575 € for Status Quo give −1.801.069 € for Max. WRG. HeatTransPlan uses the consistent formula.

These checks run as unit tests in `frontend/src/utils/economics.test.ts`.

> [!NOTE]
> Like the rest of the tool, the economic analysis is a screening estimate. It assumes constant duty and COP over the year, prices that change at fixed rates, and an investment from a specific cost per kW. It shows whether a detailed offer is worth requesting, not what the offer will say.
