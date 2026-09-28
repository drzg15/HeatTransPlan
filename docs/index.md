# HeatTransPlan — Calculation Logic

This document explains the engineering calculations behind HeatTransPlan, a tool for **Pinch Analysis** and **heat pump integration & optimization** in industrial processes.

It is written for engineers and researchers who understand energy recovery concepts but do not need to read source code. Every section explains the thermodynamic logic first, with equations and step-by-step descriptions. The actual Python implementation is hidden behind toggle buttons — click **"▶ Show implementation"** to expand the code whenever you want to see exactly how a step is programmed.

---

## What the application does

An industrial site heats some streams and cools others. Wherever something hot is being cooled while something else is being heated, that heat is bought twice: once from the boiler and once from the chiller. **HeatTransPlan finds how much of it can be exchanged internally instead, and what a heat pump could do with the rest.**

The tool answers three questions in order:

1. **How much energy is unavoidable?** Pinch analysis sets the thermodynamic floor — the minimum external heating and cooling the process needs once every feasible internal match has been made. No heat exchanger network can beat it.
2. **Where is the bottleneck?** The pinch temperature divides the site into a region that needs heat and one that has heat to spare. Moving heat across that divide is what wastes utility.
3. **What can bridge the gap?** A heat pump can lift waste heat from below the pinch to above it. The optimizer searches the feasible operating points for real refrigerants and published technology archetypes, and reports what each would deliver.

### The workflow

A user works through four stages:

| Stage | What happens |
|---|---|
| **Data collection** | Processes, subprocesses and their hot and cold streams are entered — mass flow, heat capacity, inlet and outlet temperatures — and placed on a map of the site. |
| **Stream selection** | The streams to analyse are chosen, so scenarios can be compared without re-entering data. |
| **Pinch analysis** | Composite curves, the grand composite curve, the pinch temperature and the minimum utility demands are computed. |
| **Heat pump integration** | Feasible heat pump operating points are evaluated across the temperature range, with COP, duty and electrical input for each. |

### What the numbers mean

Three results carry most of the value:

- **Minimum heating and cooling demand** — the external energy still required after maximum internal recovery. The gap between this and what the site buys today is the saving available from heat exchangers alone.
- **Pinch temperature** — the temperature at which the process is most constrained. Heat transferred across it is energy wasted twice over.
- **Heat pump operating points** — for each feasible sink temperature, the COP and duty a machine would achieve, so a high-efficiency pump covering part of the demand can be weighed against a lower-efficiency one covering all of it.

> [!NOTE]
> Everything here describes a thermodynamic *potential*, not a design. The analysis assumes heat can be exchanged wherever temperatures allow; it does not cost the pipework, check that two streams run at the same time of day, or size equipment. It tells you whether a detailed study is worth commissioning, and where to point it.

### The geographic dimension

Streams are placed on a real map rather than an abstract flowsheet, because a match that is thermodynamically ideal may sit half a kilometre away. The distance matrix export gives the separation between subprocesses, so a promising match can be checked against what it would cost to connect.

---

## How to read this document

- **Equations** use standard engineering notation (LaTeX).
- **Toggle blocks** contain the real source code from the repository — they stay in sync automatically.
- If you only care about the methodology, ignore all toggle blocks.
- If you want to audit the implementation, expand the blocks that interest you.

---

```{toctree}
:maxdepth: 2
:caption: Modules

pinch_analysis
heat_pump_integration
heat_pump_optimization
refrigerant_limits
```
