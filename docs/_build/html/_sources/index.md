# HeatTransPlan — Calculation Logic

This document explains the engineering calculations behind HeatTransPlan, a tool for **Pinch Analysis** and **heat pump integration & optimization** in industrial processes.

It is written for engineers and researchers who understand energy recovery concepts but do not need to read source code. Every section explains the thermodynamic logic first, with equations and step-by-step descriptions. The actual Python implementation is hidden behind toggle buttons — click **"▶ Show implementation"** to expand the code whenever you want to see exactly how a step is programmed.

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
