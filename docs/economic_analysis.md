# Step 4 — Cost Analysis

Step 3 says what a heat pump *can* deliver. **Step 4, the cost analysis**, asks whether it is worth buying. It compares the heat pump with the system it replaces year by year and turns the difference into a **net present value**, a **dynamic payback**, the **heat cost (LCOH)**, the **CO₂ saving** and a **break-even electricity price**.

The method is the **net present value method** (*Kapitalwertmethode*) with price-dynamic cash flows, as in VDI 2067 Blatt 1:2012. Its annuity method, which VDI 4646:2026 builds on, gives the same decision (annuity = NPV × annuity factor). Every input, formula and deviation below names the page of the guideline it comes from. The implementation reproduces the worked examples of both guidelines (see *4.9 Validation*).

**References.** Both are German engineering guidelines of the VDI (*Verein Deutscher Ingenieure*, Association of German Engineers), published in German and English; the German text is binding.

| Short | Guideline |
|---|---|
| **[4646:2026]** | VDI 4646:2026-05 *Anwendung von Großwärmepumpen* (Application of large-scale heat pumps) |
| **[2067-1:2012]** | VDI 2067 Blatt 1:2012-09 *Wirtschaftlichkeit gebäudetechnischer Anlagen – Grundlagen und Kostenberechnung* (Economic efficiency of building installations – Fundamentals and economic calculation) |
| **[GEG 2024]** | *Gebäudeenergiegesetz* 2024, the German Buildings Energy Act, Anlage 9 (CO₂-equivalent factors) |

The backend computes every number (`/api/analysis/economics`). The page, the scenario comparison and the report all show the same results.

---

## 4.0 What is compared

Both systems are costed **in full** every year:

| System | Supplies heat with | Removes the source's waste heat with |
|---|---|---|
| **Reference** (current situation) | a fuel-fired heater (gas, oil or electric boiler) | today's cooling, if the source is actively cooled |
| **Heat pump** | the heat pump, plus the old heater for whatever the pump does not cover | the heat pump's evaporator, plus the old cooling for what it does not take |

The heat pump is credited only with what it actually replaces. A pump that covers 60 % of the demand leaves 40 % on the old heater, and that remaining fuel stays in its costs.

### The pump analysed

One pump is analysed at a time, so the results stay readable:

- nothing selected in Step 3 → the default pump the optimization chart highlights (largest duty);
- one or more selected → the best of the selection: real machines before theoretical archetypes, then the largest heat output, then the highest COP;
- a click on a point of the *Economic heat pump size* chart selects that pump.

### The reference demand

The reference must supply the **largest** demand any candidate could cover, so a small and a large pump are compared against the same current situation:

$$
\dot{Q}_{ref} = \max_p \dot{Q}_{demand,total,p} \qquad \dot{Q}_{src,ref} = \max_p \dot{Q}_{source,p}
$$

taken over the analysed pump, the maximum-duty point and all real feasible points of the optimization.

<details>
<summary><b>Source code:</b> <code>backend/app/services/economics/model.py</code> (<code>pick_pump</code>, <code>econ_core</code>)</summary>

```{literalinclude} ../backend/app/services/economics/model.py
:language: python
:pyobject: pick_pump
```

```{literalinclude} ../backend/app/services/economics/model.py
:language: python
:pyobject: econ_core
```

</details>

---

## 4.1 Inputs

The six inputs people change most sit in the **Key inputs** row: period $T$, discount rate $i$, fuel price, electricity price, heat pump price per kW and investment funding. Everything else is under **More assumptions**, in two columns: *General*, *Reference heater*, *Operating funding*, *Cooling* and *Replacement case* on the left, *Heat pump* and *Electricity* on the right. Every input has a help bulb with typical values.

Options that are off by default have a checkbox. Switching one on fills in the typical value given in the table, and inputs that only count while it is on are greyed out until then.

| Input | Symbol | Default | Source of the default |
|---|---|---|---|
| **General** | | | |
| First year of operation (year 0) | $t_0$ | next year | only labels the time axis |
| Full-load hours | $h$ | 6.000 h/a | [4646:2026] Tabelle 8, p. 62 (three shifts) |
| Discount rate | $i$ | 8 % | [4646:2026] p. 58: companies use 8–12 % (Tabelle 8, p. 62 uses 12 %) |
| Period of analysis | $T$ | 20 a | [4646:2026] p. 58; [2067-1:2012] Tabelle 1, p. 11 |
| CO₂ balance in CO₂-equivalents | | **on** | [GEG 2024] Anlage 9; see *4.2* |
| **Reference heater** | | | |
| Type | | gas condensing boiler | [4646:2026] p. 61 |
| Efficiency on Hs | $\eta$ | 87 % | [4646:2026] Tabelle 8, p. 62 |
| Calorific value ratio | $H_s/H_i$ | 1,11 | natural gas H; needed by [4646:2026] eq. (23), p. 57 |
| Fuel price (excl. CO₂, per kWh Hs) | $p_{fuel,0}$ | 6 ct/kWh | ≈ 7 ct incl. CO₂ |
| Fuel price change | $r_{fuel}$ | 3 %/a | **deviation** from [4646:2026] p. 57 (constant prices) |
| CO₂ factor of the fuel (on Hi) | $c_{CO_2}$ | 0,201 t/MWh | UBA; [4646:2026] p. 64: 202 g/kWh |
| CO₂e factor of the fuel (incl. upstream, on Hi) | $c_{CO_2e}$ | 0,24 t/MWh | [GEG 2024] Anlage 9 |
| CO₂ price | $p_{CO_2,0}$ | 55 €/t | BEHG 2025 fixed price |
| CO₂ price change | $r_{CO_2}$ | 0 %/a | [4646:2026] p. 57 |
| **Electricity** | | | |
| Electricity price | $p_{el,0}$ | 13 ct/kWh | assumption |
| Electricity price change | $r_{el}$ | 3 %/a | as the fuel; **deviation** from [4646:2026] p. 57 |
| CO₂ factor of electricity | $c_{CO_2,el}$ | 0,352 t/MWh | UBA 2025 |
| CO₂e factor of electricity (incl. upstream) | $c_{CO_2e,el}$ | 0,56 t/MWh | [GEG 2024] Anlage 9 |
| Add CO₂ cost on electricity | | off | [4646:2026] p. 60: check if in the price (EU ETS) |
| **Heat pump** | | | |
| Capacity charge (if not in the electricity price) | $p_C$ | off; on: 100 €/kW$_{el}$·a | [2067-1:2012] p. 15 |
| Heat pump price per kW (machine only) | $c_{spec}$ | **1.000 €/kW** | manufacturer offers, see *Investment* below |
| Planning & installation factor | $F_{PI}$ | 1,25 | [4646:2026] Tabelle 6, p. 59 |
| Integration factor (periphery) | $F_{Per}$ | **1,35** | **deviation** from [4646:2026] Tabelle 6, p. 59 (1,8), see below |
| Maintenance | $f_M$ | 2,5 % of $I$ per a | [2067-1:2012] Tabelle A2, p. 22 (1 + 1,5 %) |
| Operation effort × hourly rate | $t_{AB} \cdot w$ | 5 h/a × 100 €/h | [2067-1:2012] Tabelle A2, p. 22 (hours); rate assumed |
| Reinvestment (share of $I$) in year … | | off; on: 20 % in year 10 | app extension (e.g. a compressor overhaul) |
| Service life | $L$ | 20 a | [2067-1:2012] Tabelle A2, p. 22 |
| Investment price change | $r_{inv}$ | 0 %/a | [2067-1:2012] eq. (2)/(3), p. 17 |
| Investment funding | $\varphi$ | 0 % of $I$ | [2067-1:2012] §8.2, p. 19 |
| **Operating funding** | | | |
| Funding per MWh of heat, paid for … years | $f_{op}$, $t_{op}$ | off; on: 92 €/MWh for 10 a | BEW Modul 4; [2067-1:2012] §8.2, p. 19 |
| **Cooling the heat pump takes over** | | | |
| Actively cooled share of the source | $a$ | off (0 %); on: 100 % | — |
| Cooling COP of the current cooling | $EER$ | 4 | mechanical chiller ([4646:2026] §8.2 uses 15 for a cooling tower) |
| **Replacement case (boiler due anyway)** | | | |
| Avoided boiler investment | $c_{boiler}$ | off (0); on: 200 €/kW of HP | [4646:2026] Tabelle 8, p. 62 (efficiency case = 0); p. 74 uses 131 €/kW |
| Its maintenance | $f_{k,ref}$ | 3 %/a | [4646:2026] Tabelle 8, p. 62 |

Choosing the reference type loads a preset (all editable):

| Type | $\eta$ (Hs) | $H_s/H_i$ | Price | $c_{CO_2}$ | $c_{CO_2e}$ |
|---|---|---|---|---|---|
| Gas condensing boiler | 87 % | 1,11 | 6 ct | 0,201 | 0,24 |
| Oil boiler | 85 % | 1,06 | 8 ct | 0,266 | 0,31 |
| Electric boiler | 99 % | 1 | 13 ct | 0,352 | 0,56 |

The electric boiler's CO₂ cost is in its electricity price unless *Add CO₂ cost on electricity* is on.

> [!IMPORTANT]
> **Gross and net calorific value.** Gas is billed per kWh of gross calorific value $H_s$, but its CO₂ factor refers to the net calorific value $H_i$ ([4646:2026] p. 60; eq. (23), p. 57 uses $\eta_{H_s}$ for the price and $\eta_{H_i}$ for CO₂). The efficiency, fuel price and fuel consumption are therefore on $H_s$, and the CO₂ factor is converted with $H_s/H_i$. Using one efficiency for both overstates the CO₂ of gas by about 11 %.

### Investment

The heat pump's own price per kW times the planning-and-installation and integration factors of [4646:2026] eq. (25)/(26), Tabelle 6, p. 58–59, times the heat output:

$$
I = c_{spec} \cdot F_{PI} \cdot F_{Per} \cdot \dot{Q}
$$

Editing the investment sets the price per kW back through the same factors. The default of 1.000 €/kW is the machine alone, from manufacturer offers for large industrial high-temperature heat pumps up to about 150 °C (about 1.000–1.200 €/kW; 175 °C steam about 2.000 €/kW). With the factors, 1.000 × 1,25 × 1,35 ≈ **1.690 €/kW installed**, between the Danish Energy Agency values for heat pumps up to 150 °C (1.550 €/kW) and steam heat pumps up to 150 °C (1.750 €/kW).

| Source | Specific investment |
|---|---|
| Manufacturer offers, machine only | ≈ 1.000–1.200 €/kW up to ~150 °C; ≈ 2.000–2.200 €/kW for 175 °C steam |
| [Danish Energy Agency (2026), Technology Data – Industrial Process Heat](https://ens.dk/media/8517/download) | installed: 1.200 €/kW ≤ 125 °C, 1.550 €/kW ≤ 150 °C; steam 1.400 / 1.750 €/kW |
| [Energy (2024): VHTHPs in European markets](https://www.sciencedirect.com/science/article/pii/S0360544224029220) | ~200–1.500 €/kW, ≥ 600 €/kW for lifts > 100 K |
| [TNO / energy.nl factsheet](https://energy.nl/wp-content/uploads/industrial-high-temperature-heat-pump-2-7.pdf) | 300–900 €/kW up to 160 °C |

The full-load hours default to 6.000 h as in [4646:2026]; with a load profile, set $h$ to the real full-load hours. All inputs are kept for the whole project: every saved scenario is evaluated with the same prices and assumptions, so scenarios differ only in their heat pump.

---

## 4.2 Energy flows and CO₂ per year

The heat pump draws electricity for its duty; the old heater burns fuel for the rest; the old cooling still removes whatever source heat the pump does not take:

$$
E_{fuel} = \frac{(\dot{Q}_{ref} - \dot{Q}) \cdot h}{\eta} \qquad
E_{el} = \frac{\dot{Q} \cdot h}{COP} \qquad
E_{cool} = \frac{(\dot{Q}_{src,ref} - \dot{Q}_{src}) \cdot h \cdot a}{EER}
$$

For the reference, $\dot{Q} = \dot{Q}_{src} = 0$ and $E_{el} = 0$.

**CO₂ emissions** follow from the same flows, with $E_{fuel}$ on $H_s$ ([4646:2026] eq. (30)/(31), p. 63):

$$
CO_2 = \frac{E_{fuel}}{H_s/H_i} \cdot c_{CO_2} + (E_{el} + E_{cool}) \cdot c_{CO_2,el}
$$

With **CO₂ balance in CO₂-equivalents** on (the default), the same formula uses $c_{CO_2e}$ and $c_{CO_2e,el}$: CO₂-equivalents including the upstream chain (methane, nitrous oxide, extraction and transport), [GEG 2024] Anlage 9. The CO₂ rows are then labelled "(CO₂e)". The **CO₂ costs** in *4.3* always use the pure CO₂ factors $c_{CO_2}$, $c_{CO_2,el}$: BEHG and EU ETS price only the CO₂ from combustion.

**Final energy saving** is the difference in final energy, fuel and electricity alike:

$$
\Delta E = (E_{fuel} + E_{cool})_{ref} - (E_{fuel} + E_{el} + E_{cool})_{HP}
$$

## 4.3 Prices over time

Prices are given for year 0 and change from year 1 at their own rates. The fuel carries a CO₂ cost with its own price path:

$$
p_{fuel}(t) = p_{fuel,0} \cdot (1 + r_{fuel})^t + \frac{c_{CO_2}}{1000 \cdot H_s/H_i} \cdot p_{CO_2,0} \cdot (1 + r_{CO_2})^t
$$

$$
p_{el}(t) = p_{el,0} \cdot (1 + r_{el})^t \;\big[ + \tfrac{c_{CO_2,el}}{1000} \cdot p_{CO_2,0} \cdot (1 + r_{CO_2})^t \big]
$$

The bracket counts only when *Add CO₂ cost on electricity* is on. This is [4646:2026] eq. (23) and (29), p. 57 and 61. [4646:2026] assumes constant prices (all $r = 0$, p. 57). The app's default is +3 %/a for fuel and electricity (CO₂ and investment 0 %): a deliberate deviation, allowed by [2067-1:2012] §6.9, p. 12, which permits change rates per cost type. The same rate on both sides keeps the electricity-to-gas price ratio constant; set both to 0 for the VDI 4646:2026 case. Today's price grown by one year equals the "first-year cost" $A_{V1}$ of [2067-1:2012] eq. (6), so the two conventions agree.

<details>
<summary><b>Source code:</b> <code>backend/app/services/economics/formulas.py</code> (<code>fuel_price</code>, <code>el_price</code>)</summary>

```{literalinclude} ../backend/app/services/economics/formulas.py
:language: python
:pyobject: fuel_price
```

```{literalinclude} ../backend/app/services/economics/formulas.py
:language: python
:pyobject: el_price
```

</details>

## 4.4 Operating costs per year

$$
K(t) = E_{fuel} \cdot p_{fuel}(t) + (E_{el} + E_{cool}) \cdot p_{el}(t) + f_M \cdot I + t_{AB} \cdot w + p_C \cdot P_{el} - f_{k,ref} \cdot I_{ref} - F_{op}(t)
$$

with $P_{el} = \dot{Q} / COP$, the avoided boiler investment $I_{ref} = c_{boiler} \cdot \dot{Q}$ (0 in the default efficiency case) and the operating funding

$$
F_{op}(t) = \begin{cases} f_{op} \cdot \dot{Q} \cdot h & t \le t_{op} \\ 0 & \text{otherwise} \end{cases}
$$

These are the demand-related, operation-related and maintenance costs of [2067-1:2012] eq. (6)–(9), p. 18–19, and [4646:2026] eq. (22)–(28), p. 57–60. Maintenance, operation, capacity charge, the saved boiler maintenance and operating funding apply to the heat pump only. The **cost saving in year 1** is $S(1) = K_{ref}(1) - K_{HP}(1)$ (in the result table).

<details>
<summary><b>Source code:</b> <code>backend/app/services/economics/formulas.py</code> (<code>_flows</code>)</summary>

```{literalinclude} ../backend/app/services/economics/formulas.py
:language: python
:pyobject: _flows
```

</details>

## 4.5 Net present value

The yearly cash flow is what the heat pump saves against the reference:

$$
CF(t) = K_{ref}(t) - K_{HP}(t)
$$

The net present value discounts every cash flow to year 0, after the investment net of funding, the avoided boiler investment, any reinvestment $R(t)$ and the residual value at the end of the period:

$$
NPV = -(1 - \varphi) \cdot I + I_{ref} + \sum_{t=1}^{T} \frac{CF(t) - R(t)}{(1 + i)^t} + \frac{RV}{(1 + i)^T}
$$

$R(t)$ are the **replacements** of [2067-1:2012] eq. (1)–(2), p. 16–17 — the heat pump is bought again at the end of each service life, at the then-current price — plus the optional reinvestment (share × $I$ in its year):

$$
R(t) = I \cdot (1 + r_{inv})^t \quad \text{at } t = L, 2L, \dots < T
$$

The **residual value** is the last purchase, depreciated linearly over its service life ([2067-1:2012] eq. (3), p. 17):

$$
RV = I \cdot (1 + r_{inv})^{nL} \cdot \frac{(n+1) \cdot L - T}{L}, \qquad n = \lceil T/L \rceil - 1
$$

A positive NPV means the heat pump earns more over $T$ years than the money would earn at the discount rate $i$. The annuity of [2067-1:2012] eq. (12) / [4646:2026] eq. (22) is the same result spread over the years: $A = NPV \cdot a$ with the annuity factor $a = i / (1 - (1+i)^{-T})$ ([2067-1:2012] eq. (4), p. 17; [4646:2026] eq. (24), p. 57).

## 4.6 Dynamic payback

The **dynamic payback** is the time until the cumulated, discounted cash flows have recovered the net investment:

$$
NPV(k) = -(1 - \varphi) \cdot I + I_{ref} + \sum_{t=1}^{k} \frac{CF(t) - R(t)}{(1 + i)^t}, \qquad k^* = \min \{ k : NPV(k) \ge 0 \}
$$

Within the year $k^*$ it is interpolated linearly, so it has one decimal:

$$
t_P = k^* - 1 + \frac{-NPV(k^*-1)}{NPV(k^*) - NPV(k^*-1)}
$$

It is shown as "8,2 years / 2035": the years, and the calendar year $t_0 + \lceil t_P \rceil$ in which it is reached. The search runs past $T$ up to **40 years**, so a pump that pays back after the period still gets a value. The residual value is left out here: it is not cash in hand before the end of the period.

<details>
<summary><b>Source code:</b> <code>backend/app/services/economics/formulas.py</code> (<code>evaluate</code>)</summary>

```{literalinclude} ../backend/app/services/economics/formulas.py
:language: python
:pyobject: evaluate
```

</details>

## 4.7 Break-even electricity price

For a given fuel price, the **break-even electricity price** $p_{el}^*$ is the one at which the NPV is exactly zero. Below it the heat pump wins. The NPV is linear in the electricity price, so two evaluations give the root exactly:

$$
p_{el}^* = -\frac{NPV(p_{el} = 0)}{NPV(p_{el} = 1) - NPV(p_{el} = 0)}
$$

<details>
<summary><b>Source code:</b> <code>backend/app/services/economics/formulas.py</code> (<code>break_even_el_price</code>)</summary>

```{literalinclude} ../backend/app/services/economics/formulas.py
:language: python
:pyobject: break_even_el_price
```

</details>

## 4.8 Heat cost (LCOH) and the other VDI 4646:2026 results

The **heat cost of the heat pump** is a key result (with the reference's heat cost underneath); the rest is under *Detailed results*.

| Result | Formula | Source |
|---|---|---|
| **Heat cost of the heat pump** | $LCOH_{HP} = a \cdot \Big[(1-\varphi) I - \dfrac{RV}{(1+i)^T} + \displaystyle\sum_{t=1}^{T} \dfrac{\alpha E_{el} p_{el}(t) + f_M I + t_{AB} w + p_C P_{el} - F_{op}(t) + R_L(t)}{(1+i)^t}\Big] \Big/ (\dot{Q} h)$ | [4646:2026] eq. (21)–(23), p. 57 |
| **Heat cost of the reference** | $LCOH_{ref} = a \cdot \Big[I_{ref} + \displaystyle\sum_{t=1}^{T} \dfrac{\dot{Q} h / \eta \cdot p_{fuel}(t) + f_{k,ref} I_{ref}}{(1+i)^t}\Big] \Big/ (\dot{Q} h)$ | [4646:2026] p. 61 (efficiency case: fuel costs only) |
| **Allocation factor** (Finnish method) | $\alpha = \dfrac{COP/\eta}{COP/\eta + a \cdot (COP-1)/EER}$, $COP_\alpha = COP/\alpha$ | [4646:2026] eq. (17)–(19), p. 55–57 |
| **Static payback** | $PP = \dfrac{(1-\varphi) \cdot I - I_{ref}}{S(1)}$ | [4646:2026] eq. (C5), p. 90 |
| **Internal rate of return** | the discount rate at which $NPV = 0$ | [4646:2026] eq. (C6), p. 91 |
| **VDI cost function** (reference only) | $k_{Inv} = F_{WP} \, \dot{Q}^{E_{WP}} \cdot 1{,}25 \cdot 1{,}8 / \dot{Q}$ | [4646:2026] eq. (26), Tabelle 6, p. 58–59 |

$R_L(t)$ are the replacements at the end of each service life (the optional reinvestment is not in the LCOH). Both heat costs are for the heat the pump makes, $\dot{Q} h$, so they compare like with like.

**Finnish method.** When the heat pump's cold side replaces cooling, the pump makes two products, heat and cold. Its electricity is split by what each would cost made separately: heat from the boiler ($COP/\eta$), cold from the existing cooling ($a \cdot (COP-1)/EER$). Only the share $\alpha$ is charged to heat. The app multiplies the cooling term by the actively cooled share $a$ — **an extension of [4646:2026]**, whose formula assumes the whole cold side is useful (the case $a = 1$); cold that replaces no chiller earns no credit, so with $a = 0$, $\alpha = 1$. The NPV and payback need no split: they compare the whole systems, heating and cooling, as in [4646:2026] Bild 9, p. 54.

<details>
<summary><b>Source code:</b> <code>backend/app/services/economics/formulas.py</code> (<code>allocation_factor</code>, <code>vdi_specific_cost</code>)</summary>

```{literalinclude} ../backend/app/services/economics/formulas.py
:language: python
:pyobject: allocation_factor
```

```{literalinclude} ../backend/app/services/economics/formulas.py
:language: python
:pyobject: vdi_specific_cost
```

</details>

---

## What the page shows

**Key results** (one card each): dynamic payback ($t_P$, *4.6*), net present value (*4.5*), heat cost of the heat pump with the reference's underneath (*4.8*), CO₂ saving (*4.2*) and break-even electricity price (*4.7*). Every result row has a help bulb with its formula and source.

| Chart | What it shows |
|---|---|
| **Costs over $T$ years** | One stacked bar per system: the nominal (undiscounted) operating costs over $T$, with the investment on top. In the replacement case the reference bar carries the boiler investment it would have to make ($c_{boiler} \cdot \dot{Q}$). The total is written above each bar; the legend gives the investment's share. |
| **Energy price development** | $p_{fuel}(t)$ with and without CO₂, and $p_{el}(t)$ over the period. |
| **NPV over time** | $NPV(k)$ year by year, past $T$ until payback; red markers before payback, green after; a dotted line marks the end of the period. The legend names the payback year. |
| **Sensitivity map** | NPV for every pair of fuel and electricity prices, each from 0 to twice the entered price (at most about 14 cells per axis). Cells are red where the reference is cheaper and green where the heat pump pays off; the dashed line between them is $p_{el}^*$, with the exact price pair on hover. The "WP" box marks the entered prices. Clicking a cell or the line adopts its prices everywhere. |
| **Economic heat pump size** | NPV against heat output for every real pump on the profiles, keeping the best machine per 1 % of the demand. A smaller pump costs less but leaves more on the old heater; the peak is the economic optimum (open gold ring). The analysed pump is the "WP" box; when it is the optimum, the ring sits around the box. Clicking a point analyses that pump. Source- and demand-limited pumps are left out, as on the optimization chart: on-profile pumps come in duty steps wider than 1 %, so a source-limited pump (partial coverage at a high sink temperature, poor COP) landing in an empty step would otherwise pull the curve down to a loss. |

A plain-language **summary** closes the section: coverage, energy and CO₂ saved, cost saving, investment, payback, NPV and break-even price of the pump analysed.

### Scenario comparison and report

- **Scenario comparison**: each saved scenario gets its investment, NPV, dynamic payback and cost saving in year 1, plus a bar chart of NPV per scenario. All scenarios use the same inputs.
- **Report**: every scenario page ends with the full cost analysis — key results, all inputs, both result tables, the charts and the summary. The comparison page carries the same economic columns and the NPV-per-scenario chart.

<details>
<summary><b>Source code:</b> <code>frontend/src/components/analysis/econModel.ts</code> (<code>econReportData</code>)</summary>

```{literalinclude} ../frontend/src/components/analysis/econModel.ts
:language: typescript
:start-at: export function econReportData
```

</details>

---

## 4.9 Validation

| Example | Source | Expected | App |
|---|---|---|---|
| Replacements and residual value | [2067-1:2012] Annex B, p. 37 | $A_1$ = 1.266,11 €, $A_2$ = 801,52 €, $RV$ = 267,04 € | identical |
| Annuity factor (6 %, 20 a) | [2067-1:2012] eq. (4), p. 17 | 0,087185 | 0,087185 |
| Static payback / IRR, example of §8.2 | [4646:2026] p. 72, eq. (C5)/(C6) | 13,65 a / 3,95 % from the equations | 13,65 a / 3,95 % |
| Allocated COP (COP 3,2, η 0,87, cooling COP 15) | [4646:2026] p. 73 | 3,35 (read off Bild 24) | 3,33 |

The text of [4646:2026] §8.2 states "just under 12 years" and an IRR of 6 % for the static-payback example. These are read off the nomogram (Bild 22); its own equations (C5)/(C6) give 13,65 years and 3,95 % for the stated inputs, as does the app. These checks run as unit tests in `backend/tests/test_economics.py`.

> [!NOTE]
> The cost analysis assumes constant duty and COP over the year, prices that change at fixed rates, and an investment from a specific cost per kW.
