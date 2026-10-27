# Economic Analysis — Net Present Value of the Heat Pump

The heat pump optimization says what a machine *can* deliver. The **economic analysis** asks whether it is worth buying: it compares the heat pump with the system it replaces, year by year, and turns the difference into a **net present value**, a **dynamic payback** and a **break-even electricity price**, plus the results of **VDI 4646**: heat cost per kWh (LCOH), **static payback** and **internal rate of return**.

The method is the **net present value method** (*Kapitalwertmethode*) with price-dynamic cash flows, the approach of **VDI 2067 Blatt 1** (2012); its annuity method, which **VDI 4646** (2026) builds on, gives the same decision (annuity = NPV × annuity factor). Defaults follow VDI 4646 and VDI 2067, except the heat pump's specific investment. Every input, formula and deviation is listed below with the page of the norm it comes from; the implementation reproduces the worked examples of both norms, a VDI 4646 training course and an industrial feasibility study (Hipp, 2026) — see *Validation* below.

Citations: **[4646]** VDI 4646:2026-05, **[2067]** VDI 2067 Blatt 1:2012-09, **[L]** Hitzköpfe Academy seminar, chapter 7 (slide numbers), **[H]** Hipp final presentation 2026 (slide numbers).

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
| Group | Input | Symbol | Unit | Default | Source of the default |
|---|---|---|---|---|---|
| General | First year of operation | $t_0$ | year | next year | — |
| | Full-load hours | $h$ | h/year | 6.000 | [4646] Tabelle 8, p. 62 (three shifts) |
| | Discount rate | $i$ | % | 12 | [4646] p. 58 (8–12 %), Tabelle 8 |
| | Period of analysis | $T$ | years | 20 | [4646] p. 58; [2067] Tabelle 1, p. 11 |
| Reference heater | Type | | | gas condensing boiler | [4646] p. 61 |
| | Efficiency on Hs | $\eta$ | % | 87 | [4646] Tabelle 8, p. 62 |
| | Calorific value ratio | $H_s/H_i$ | – | 1,11 | natural gas H; needed by [4646] eq. (23), p. 57 |
| | Fuel price (excl. CO₂, per kWh Hs) | $p_{fuel,0}$ | ct/kWh | 6 | ≈ 7 ct incl. CO₂ as in [H] |
| | Fuel price change | $r_{fuel}$ | %/year | 3 | [H]; **deviation** from [4646] p. 57 (constant prices) |
| | CO₂ factor of the fuel (on Hi) | $c_{CO_2}$ | t/MWh | 0,201 | UBA; [4646] p. 64: 202 g/kWh |
| | CO₂ price | $p_{CO_2,0}$ | €/t | 55 | BEHG 2025 |
| | CO₂ price change | $r_{CO_2}$ | %/year | 0 | [4646] p. 57 |
| Electricity | Electricity price | $p_{el,0}$ | ct/kWh | 13 | [H] |
| | Electricity price change | $r_{el}$ | %/year | 3 | as the fuel; **deviation** from [4646] p. 57 |
| | CO₂ factor of electricity | $c_{CO_2,el}$ | t/MWh | 0,352 | UBA 2025 |
| | Add CO₂ cost on electricity | | yes/no | no | [4646] p. 60: check if in the price (EU ETS) |
| Heat pump | Heat pump price per kW (equipment) | $c_{spec}$ | €/kW | **380** | literature (see below), installed ≈ 855 €/kW |
| | Planning & installation factor | $F_{PI}$ | – | 1,25 | [4646] Tabelle 6, p. 59 |
| | Integration factor (periphery) | $F_{Per}$ | – | 1,8 | [4646] Tabelle 6, p. 59 |
| | Maintenance | $f_M$ | % of $I$ per year | 2,5 | [2067] Tabelle A2, p. 22 (1 + 1,5 %) |
| | Operation effort × hourly rate | $t_{AB} \cdot w$ | h/year × €/h | 5 × 100 | [2067] Tabelle A2, p. 22; [L] slide 18 |
| | Capacity charge | $p_C$ | €/kW$_{el}$ per year | 0 | [2067] p. 15 |
| | Reinvestment | | % of $I$ in a chosen year | 0 | app extension |
| | Service life | $L$ | years | 20 | [2067] Tabelle A2, p. 22 |
| | Investment price change | $r_{inv}$ | %/year | 0 | [2067] eq. (2)/(3), p. 17 |
| | Investment funding | $\varphi$ | % of $I$ | 0 | [2067] §8.2, p. 19 |
| Operating funding | Funding per MWh of heat | $f_{op}$ | €/MWh | 0 | [2067] §8.2, p. 19 |
| | Paid for | $t_{op}$ | years | 10 | BEW Modul 4 |
| Cooling | Actively cooled share of the source heat | $a$ | % | 0 | — |
| | Cooling COP (EER) | $EER$ | – | 4 | mechanical chiller ([4646] §8.2 uses 15 for a cooling tower) |
| Replacement case | Avoided boiler investment | $c_{boiler}$ | €/kW of HP | 0 | [4646] Tabelle 8, p. 62 (efficiency case); 131 €/kW on p. 74 |
| | Its maintenance | $f_{k,ref}$ | %/year | 3 | [4646] Tabelle 8, p. 62 |

Choosing the reference type loads a preset for efficiency (on Hs), Hs/Hi, fuel price and CO₂ factor (gas 87 % / 1,11 / 6 ct / 0,201; oil 85 % / 1,06 / 8 ct / 0,266; electric boiler 99 % / 1 / 13 ct / 0,352). The electric boiler's CO₂ is in its electricity price unless "Add CO₂ cost on electricity" is on.

> [!IMPORTANT]
> **Gross and net calorific value.** Gas is billed per kWh of gross calorific value $H_s$, but its CO₂ factor refers to the net calorific value $H_i$ ([4646] p. 60; eq. (23), p. 57 uses $\eta_{H_s}$ for the price and $\eta_{H_i}$ for CO₂). The efficiency, fuel price and fuel consumption are therefore on $H_s$, and the CO₂ factor is converted with $H_s/H_i$. Using one efficiency for both overstates the CO₂ of gas by about 11 %.

**Investment.** The heat pump's own price per kW times the planning-and-installation and integration factors of VDI 4646 ([4646] eq. (25)/(26), Tabelle 6, p. 58–59), times the heat output:

$$
I = c_{spec} \cdot F_{PI} \cdot F_{Per} \cdot \dot{Q}
$$

Editing the investment sets the price per kW back through the same factors. The default 380 €/kW × 1,25 × 1,8 ≈ 855 €/kW installed, the middle of the literature range for installed industrial high-temperature heat pumps:

| Source | Specific investment |
|---|---|
| [Danish Energy Agency (2026), Technology Data – Industrial Process Heat](https://ens.dk/media/7757/download) | 1.400 €/kW ≤ 125 °C, 1.750 €/kW ≤ 150 °C (steam, incl. installation) |
| [Energy (2024): VHTHPs in European markets](https://www.sciencedirect.com/science/article/pii/S0360544224029220) | ~200–1.500 €/kW, ≥ 600 €/kW for lifts > 100 K |
| [TNO / energy.nl factsheet](https://energy.nl/wp-content/uploads/industrial-high-temperature-heat-pump-2-7.pdf) | 300–900 €/kW up to 160 °C |

> [!NOTE]
> **Deviation from VDI 4646 — heat pump price.** [4646] eq. (25)/(26) with Tabelle 6 (p. 58–59) gives an installed price that falls with size: about 643 €/kW at 100 kW, 476 at 300 kW, 428 at 1 MW and 389 at 3 MW. The app keeps the norm's two factors but uses one flat price per kW for the heat pump itself, so economies of scale are not modelled: the training course calls the VDI curve possibly outdated ([L] slide 14), and HeatTransPlan's pumps are high-temperature machines for which newer sources give higher costs. The VDI value is shown for comparison under *Detailed results*. (Tabelle 6 prints "≤ 210 kW" on both rows; the second means "> 210 kW".)

The full-load hours default to 6.000 h as in [4646]; with a load profile, set $h$ to the real full-load hours.

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
CO_2 = \frac{E_{fuel}}{H_s/H_i} \cdot c_{CO_2} + (E_{el} + E_{cool}) \cdot c_{CO_2,el}
$$

with $E_{fuel}$ on $H_s$ — [4646] eq. (30)/(31), p. 63.

**Final energy saving** is the difference in final energy, fuel and electricity alike:

$$
\Delta E = (E_{fuel} + E_{cool})_{ref} - (E_{fuel} + E_{el} + E_{cool})_{HP}
$$

## Step 2 — Prices over time

Prices are given for the base year and change from year 1 at their own rates. The fuel carries a CO₂ cost with its own price path:

$$
p_{fuel}(t) = p_{fuel,0} \cdot (1 + r_{fuel})^t + \frac{c_{CO_2}}{1000 \cdot H_s/H_i} \cdot p_{CO_2,0} \cdot (1 + r_{CO_2})^t
$$

$$
p_{el}(t) = p_{el,0} \cdot (1 + r_{el})^t \;\big[ + \tfrac{c_{CO_2,el}}{1000} \cdot p_{CO_2,0} \cdot (1 + r_{CO_2})^t \big]
$$

The bracket only when CO₂ cost on electricity is switched on. This is [4646] eq. (23) and (29), p. 57 and 61. [4646] assumes constant prices (all $r = 0$, p. 57). The app's default is +3 %/year for fuel and electricity (CO₂ and investment 0 %): a deliberate deviation, allowed by [2067] §6.9 (p. 12), which permits change rates per cost type. The same rate on both sides keeps the electricity-to-gas price ratio constant. Set both to 0 for the VDI 4646 case. Today's price $p_0$ grown by one year equals the "first-year cost" $A_{V1}$ of [2067] eq. (6), so the two conventions agree.

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
K(t) = E_{fuel} \cdot p_{fuel}(t) + (E_{el} + E_{cool}) \cdot p_{el}(t) + f_M \cdot I + t_{AB} \cdot w + p_C \cdot P_{el} - f_{k,ref} \cdot I_{ref} - F_{op}(t)
$$

— the demand-related, operation-related and maintenance costs of [2067] eq. (6)–(9), p. 18–19, and [4646] eq. (22)–(28), p. 57–60. $I_{ref} = c_{boiler} \cdot \dot{Q}$ is the boiler investment avoided in the replacement case (0 by default), whose maintenance is then saved too.

with $P_{el} = \dot{Q} / COP$ and the operating funding

$$
F_{op}(t) = \begin{cases} f_{op} \cdot \dot{Q} \cdot h & t \le t_{op} \\ 0 & \text{otherwise} \end{cases}
$$

Maintenance, operation, capacity charge and operating funding apply to the heat pump only. The **cost saving in year 1** is $S(1) = K_{ref}(1) - K_{HP}(1)$.

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
NPV = -(1 - \varphi) \cdot I + I_{ref} + \sum_{t=1}^{T} \frac{CF(t) - R(t)}{(1 + i)^t} + \frac{RV}{(1 + i)^T}
$$

$R(t)$ are the **replacements** of [2067] eq. (1)–(2), p. 16–17 — the heat pump is bought again at the end of each service life, at the then-current price — plus an optional manual reinvestment:

$$
R(t) = I \cdot (1 + r_{inv})^t \quad \text{at } t = L, 2L, \dots < T
$$

The **residual value** is the last purchase, depreciated linearly over its service life ([2067] eq. (3), p. 17):

$$
RV = I \cdot (1 + r_{inv})^{nL} \cdot \frac{(n+1) \cdot L - T}{L}, \qquad n = \lceil T/L \rceil - 1
$$

A positive NPV means the heat pump earns more over $T$ years than the money would earn at the discount rate $i$. The annuity of [2067] eq. (12) / [4646] eq. (22) is the same result spread over the years: $A = NPV \cdot a$ with the annuity factor $a = i / (1 - (1+i)^{-T})$ ([2067] eq. (4), p. 17; [4646] eq. (24), p. 57).

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
:end-before: /** VDI 4646 cost function
```

</details>

## Step 7 — The VDI 4646 results

Shown under *Detailed results*:

| Result | Formula | Source |
|---|---|---|
| **Static payback** | $PP = \dfrac{(1-\varphi) \cdot I - I_{ref}}{S(1)}$ | [4646] eq. (C5), p. 90 |
| **Internal rate of return** | the discount rate at which $NPV = 0$ | [4646] eq. (C6), p. 91 |
| **Heat cost of the heat pump** | $LCOH_{HP} = a \cdot PV\big(\text{capital} + f_M I + t_{AB} w + p_C P_{el} + \alpha \, E_{el} \, p_{el}(t) - F_{op}\big) / (\dot{Q} h)$ | [4646] eq. (21)–(23), p. 57 |
| **Heat cost of the reference** | $LCOH_{ref} = a \cdot PV\big(\dot{Q} h / \eta \cdot p_{fuel}(t) + f_{k,ref} I_{ref}\big) / (\dot{Q} h)$ | [4646] p. 61 (efficiency case: demand-related costs only) |
| **Allocation factor** (Finnish method) | $\alpha = \dfrac{COP/\eta}{COP/\eta + a \cdot (COP-1)/EER}$, $COP_\alpha = COP/\alpha$ | [4646] eq. (17)–(19), p. 55–57 |
| **VDI cost function** (reference only) | $k_{Inv} = F_{WP} \, \dot{Q}^{E_{WP}} \, F_{PI} \, F_{Per} / \dot{Q}$ | [4646] eq. (26), Tabelle 6, p. 58–59 |

"Capital" is the investment net of funding plus replacements minus the residual value, all as present values. The allocation factor charges the heat pump's electricity partly to the cooling its cold side provides, so the heat cost is not burdened with it. The app multiplies the cooling term by the actively cooled share $a$ — **an extension of [4646]**, whose formula assumes the whole cold side is useful (it is the case $a = 1$); cold that replaces no chiller earns no credit. The NPV does not need $\alpha$: it compares the whole systems, heating and cooling, as in [4646] Bild 9 (p. 54).

The ROI shown in earlier versions has been replaced by the internal rate of return: the ROI's definition was an assumption, the IRR is the norm's.

<details>
<summary><b>Source code:</b> <code>frontend/src/utils/economics.ts</code> (<code>allocationFactor</code>, <code>vdiSpecificCost</code>)</summary>

```{literalinclude} ../frontend/src/utils/economics.ts
:language: typescript
:start-at: /** Finnish allocation factor
:end-before: export function evaluate
```

```{literalinclude} ../frontend/src/utils/economics.ts
:language: typescript
:start-at: /** VDI 4646 cost function
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

## Validation

### Against VDI 2067, VDI 4646 and the training course

| Example | Source | Expected | App |
|---|---|---|---|
| Replacements and residual value | [2067] Annex B, p. 37 | $A_1$ = 1.266,11 €, $A_2$ = 801,52 €, $RV$ = 267,04 € | identical |
| Heat cost of a 250 kW heat pump | [L] slides 15–22 | 6,75 ct/kWh | 6,75 ct/kWh |
| Annuity factor (6 %, 20 a) | [L] slide 20; [2067] eq. (4) | 0,087185 | 0,087185 |
| VDI cost function at 250 kW | [L] slide 15 | 483,74 €/kW | 483,74 €/kW |
| Static payback / IRR, example of §8.2 | [4646] p. 72, eq. (C5)/(C6) | 13,65 a / 3,95 % from the equations | 13,65 a / 3,95 % |
| Allocated COP (COP 3,2, η 0,87, COP$_{KA,ref}$ 15) | [4646] p. 73 | 3,35 (read off Bild 24) | 3,33 |
| NPV × annuity factor = annuity difference | [L] slide 11 | −20.171,78 €/a | −20.171,78 €/a |

The text of [4646] §8.2 states "just under 12 years" and an IRR of 6 % for the static-payback example. These are read off the nomogram (Bild 22); its own equations (C5)/(C6) give 13,65 years and 3,95 % for the stated inputs, as does the app.

### Against the reference study

The study compares a gas boiler (current situation, 7 ct/kWh incl. CO₂) with two heat pump variants, *Status Quo* and *Max. WRG* (maximum heat recovery), at 13 ct/kWh electricity, 3 % price change, 6 % discount rate, 15 years and 5 % maintenance — values that differ from the VDI defaults above. Set to the study's values, with the extensions it does not have switched off (separate CO₂ cost, Hs/Hi, operation effort, cooling, capacity charge, replacements, residual value), the implementation reproduces its table exactly:

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
