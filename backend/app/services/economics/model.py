"""The economic analysis as numbers: which pump is analysed, its results
against the reference system, and the data behind every chart (price
sensitivity, economic pump size, net present value over time).

The page, the scenario comparison, the HTML report and the MCP server all
read these numbers, so they agree. Wording and chart styling stay with
whoever displays them.
"""

from __future__ import annotations

import math
from dataclasses import replace as dc_replace
from datetime import date
from typing import Any, Dict, List, Literal, Optional, Sequence

from app.models.analysis import HPIOptimizationResult, OptimizedIntegrationPoint
from app.services.economics.formulas import (
    PAYBACK_HORIZON,
    EconInputs,
    EconReference,
    EconVariant,
    break_even_el_price,
    evaluate,
    reference_cost,
)

RefType = Literal["gas", "oil", "eboiler"]

# Display units: prices in ct/kWh, rates and shares in %.
# Defaults follow VDI 4646 (2026) and VDI 2067 Blatt 1 (2012), except the
# specific investment of the heat pump. Each value, its source page and why
# it may differ: economic_calculation/economic_analysis_rationale.md.
DEFAULTS: Dict[str, float] = {
    "year": date.today().year + 1,
    "hours": 6000,  # VDI 4646 Tabelle 8: three-shift operation
    "i": 12,  # VDI 4646 Tabelle 8; companies use 8–12 % (p. 58)
    "T": 20,  # VDI 4646 p. 58 / VDI 2067 Tabelle 1: heating 20 years
    # Reference heater (gas condensing boiler, VDI 4646 Tabelle 8: η = 0,87 on
    # Hs). The fuel price is per kWh Hs and excludes CO₂, which is costed on Hi.
    "eta": 87,
    "hsHi": 1.11,  # natural gas H: Hs/Hi ≈ 1,11
    "pFuel": 6,
    # Not VDI 4646 (p. 57: constant prices): 3 %/a, user decision 2026-10-27.
    "rFuel": 3,
    "co2Fuel": 0.201,  # t/MWh on Hi (UBA); VDI 4646 p. 64 uses 202 g/kWh
    "co2Price": 55,  # BEHG fixed price 2025
    "rCo2": 0,
    "boilerInvest": 0,  # efficiency case: the boiler exists (VDI 4646 Tabelle 8)
    "fMaintRef": 3,  # VDI 4646 Tabelle 8: f_k gas boiler 3 %
    # Electricity and heat pump.
    "pEl": 13,
    "rEl": 3,  # as rFuel
    "co2El": 0.352,  # UBA 2025, location-based
    "co2ElPriced": 0,  # 1 = add CO₂ cost on electricity (lecture slide 19)
    "pDemand": 0,  # only if not already in the electricity price
    # Price of the heat pump itself per kW (machine only): SPH offers for large
    # industrial high-temperature heat pumps up to ~150 °C (≈ 1.000–1.200 €/kW).
    "specCost": 1000,
    "fPI": 1.25,  # VDI 4646 Tabelle 6, p. 59: planning and installation
    # System integration (periphery). VDI 4646 Tabelle 6 has 1,8, fitted to cheap
    # machines; with a 1.000 €/kW machine 1,25 gives ≈ 1.560 €/kW installed.
    "fPer": 1.25,
    "fMaint": 2.5,  # VDI 2067 Tabelle A2: f_Inst 1 % + f_W+Insp 1,5 %
    "opHours": 5,  # VDI 2067 Tabelle A2: 5 h/a operation
    "wage": 100,  # lecture slide 18: 100 €/h
    "reinvestShare": 0,
    "reinvestYear": 10,
    "life": 20,  # VDI 2067 Tabelle A2: water/water heat pump 20 years
    "rInv": 0,  # constant prices, as the energy prices
    "funding": 0,
    "opFunding": 0,  # operating funding (e.g. BEW Modul 4): none by default
    "opFundingYears": 10,
    # Cooling the pump takes over. 0 % = the source is not actively cooled today.
    "coolShare": 0,
    "eer": 4,
}

# Reference heaters: picking one loads its efficiency, price and CO₂ factor.
# Efficiencies and prices on Hs, CO₂ factors on Hi.
PRESETS: Dict[str, Dict[str, float]] = {
    "gas": {"eta": 87, "hsHi": 1.11, "pFuel": 6, "co2Fuel": 0.201},
    "oil": {"eta": 85, "hsHi": 1.06, "pFuel": 8, "co2Fuel": 0.266},
    "eboiler": {"eta": 99, "hsHi": 1, "pFuel": 13, "co2Fuel": 0.352},
}


def js_round(x: float) -> int:
    """Math.round: halves go up, unlike Python's round()."""
    return math.floor(x + 0.5)


def to_inputs(f: Dict[str, float], ref_type: str) -> EconInputs:
    return EconInputs(
        hours=f["hours"],
        eta=f["eta"] / 100,
        hsHi=f["hsHi"] or 1,
        pFuel=f["pFuel"] / 100,
        rFuel=f["rFuel"] / 100,
        co2Fuel=f["co2Fuel"],
        # The electric boiler's CO₂ cost follows the electricity setting.
        co2Priced=ref_type != "eboiler" or bool(f["co2ElPriced"]),
        co2Price=f["co2Price"],
        rCo2=f["rCo2"] / 100,
        pEl=f["pEl"] / 100,
        rEl=f["rEl"] / 100,
        co2El=f["co2El"],
        co2ElPriced=bool(f["co2ElPriced"]),
        i=f["i"] / 100,
        T=max(1, js_round(f["T"])),
        fMaint=f["fMaint"] / 100,
        opHours=f["opHours"],
        wage=f["wage"],
        funding=f["funding"] / 100,
        pDemand=f["pDemand"],
        coolShare=f["coolShare"] / 100,
        eer=f["eer"],
        reinvestShare=f["reinvestShare"] / 100,
        reinvestYear=js_round(f["reinvestYear"]),
        life=js_round(f["life"]),
        rInv=f["rInv"] / 100,
        boilerInvest=f["boilerInvest"],
        fMaintRef=f["fMaintRef"] / 100,
        opFunding=f["opFunding"] / 1000,
        opFundingYears=js_round(f["opFundingYears"]),
    )


def pick_pump(
    selected: Sequence[OptimizedIntegrationPoint], opt: Optional[HPIOptimizationResult]
) -> Optional[OptimizedIntegrationPoint]:
    """The one pump analysed, so the analysis stays readable however many are
    picked: the best of the selection (real machines before archetypes, then
    largest heat output, then highest COP). Nothing picked: the default pump, as
    the optimization chart shows."""
    if selected:
        return sorted(selected, key=lambda p: (int(bool(p.theoretical)), -p.Q_demand, -p.COP))[0]
    return opt.max_q_point if opt else None


def econ_core(
    form: Dict[str, float],
    ref_type: str,
    selected: Sequence[OptimizedIntegrationPoint],
    opt: Optional[HPIOptimizationResult],
) -> Optional[Dict[str, Any]]:
    """The numbers alone, no text or charts: what the scenario comparison needs."""
    pump = pick_pump(selected, opt)
    if pump is None:
        return None
    points = [pump]
    inp = to_inputs(form, ref_type)
    # The reference supplies the largest demand (and cools the largest source)
    # among the variants, so every pump is compared against the same Ist-Situation.
    real_feasible = [p for p in (opt.feasible_points if opt else []) if not p.theoretical and p.COP > 0]
    ref_pool = [*points, *([opt.max_q_point] if opt and opt.max_q_point else []), *real_feasible]
    ref_sys = EconReference(
        Q=max(p.Q_demand_total if p.Q_demand_total is not None else p.Q_demand for p in ref_pool),
        Qsrc=max(p.Q_source for p in ref_pool),
    )
    ref = reference_cost(inp, ref_sys)
    # Investment and specific investment are one value seen two ways: I = c_spez · Q.
    # Installed price per kW: the heat pump's own price × planning and
    # installation × integration (VDI 4646 eq. 26 factors).
    spec_total = form["specCost"] * form["fPI"] * form["fPer"]

    def capex_of(p: OptimizedIntegrationPoint) -> int:
        return js_round(spec_total * p.Q_demand)

    variants = [EconVariant(Q=p.Q_demand, Qsrc=p.Q_source, cop=p.COP, capex=capex_of(p)) for p in points]
    results = [evaluate(inp, ref_sys, v) for v in variants]
    break_even = [break_even_el_price(inp, ref_sys, v, inp.pFuel) for v in variants]
    return {
        "pump": pump,
        "points": points,
        "inp": inp,
        "realFeasible": real_feasible,
        "refSys": ref_sys,
        "ref": ref,
        "specTotal": spec_total,
        "capexOf": capex_of,
        "variants": variants,
        "results": results,
        "breakEven": break_even,
    }


def _axis_ct(today: float) -> Dict[str, Any]:
    """Sensitivity window: each price from 0 to twice today's, so today's
    prices sit in the middle, with at most ~14 cells per axis."""
    hi = max(2 * today, 1)
    step = next((st for st in (0.5, 1, 2, 5, 10, 20) if hi / st <= 14), 50)
    return {"step": step, "ct": [float(f"{k * step:.2f}") for k in range(0, math.ceil(hi / step) + 1)]}


def sensitivity(core: Dict[str, Any], form: Dict[str, float], sens_base: Optional[Dict[str, float]]) -> Dict[str, Any]:
    """Net present value over fuel × electricity price, and the break-even line."""
    inp, ref_sys, variant = core["inp"], core["refSys"], core["variants"][0]
    gas = _axis_ct(sens_base["fuel"] if sens_base else form["pFuel"])
    el = _axis_ct(sens_base["el"] if sens_base else form["pEl"])
    gas_ct, el_ct, gas_step = gas["ct"], el["ct"], gas["step"]
    z = [
        [evaluate(dc_replace(inp, pFuel=g / 100, pEl=e / 100), ref_sys, variant, with_irr=False)["npv"] for g in gas_ct]
        for e in el_ct
    ]
    # Break-even line: the electricity price at which KW = 0, per gas price.
    # On the cheaper-electricity side of it the heat pump beats the boiler.
    be_x = [gas_ct[0] - gas_step / 2, *gas_ct, gas_ct[-1] + gas_step / 2]
    be_y = []
    for g in be_x:
        p = break_even_el_price(inp, ref_sys, variant, g / 100)
        be_y.append(None if p is None else 100 * p)
    return {"gasStep": gas_step, "gasCt": gas_ct, "elStep": el["step"], "elCt": el_ct, "z": z, "beX": be_x, "beY": be_y}


def size_curve(core: Dict[str, Any]) -> Dict[str, Any]:
    """Economic heat pump size: every working pump on the optimisation curve,
    costed with the same inputs. Per size (1 % of the demand) the best machine
    is kept, so the line is the best you can do at each size and its peak is
    the economic optimum.

    Only pumps on the profiles count, as on the optimization chart. A source-
    limited pump covers only part of the demand above a high sink temperature
    at a poor COP; on-profile pumps come in duty steps wider than 1 %, so one
    landing in an empty step would be "the best of that size" and pull the
    line down to a loss that no sensible choice of pump makes."""
    inp, ref_sys, capex_of = core["inp"], core["refSys"], core["capexOf"]
    size_best: Dict[int, Dict[str, Any]] = {}
    on_profile = [p for p in core["realFeasible"] if not p.source_limited and not p.demand_limited]
    for p in on_profile or core["realFeasible"]:
        npv = evaluate(
            inp, ref_sys, EconVariant(Q=p.Q_demand, Qsrc=p.Q_source, cop=p.COP, capex=capex_of(p)), with_irr=False
        )["npv"]
        bucket = js_round((100 * p.Q_demand) / ref_sys.Q)
        cur = size_best.get(bucket)
        if cur is None or npv > cur["npv"]:
            size_best[bucket] = {"p": p, "npv": npv}
    sizes = sorted(size_best.values(), key=lambda s: s["p"].Q_demand)
    optimum = None
    for s in sizes:
        if optimum is None or s["npv"] > optimum["npv"]:
            optimum = s
    return {"sizes": sizes, "optimum": optimum}


def npv_runs(core: Dict[str, Any]) -> Dict[str, Any]:
    """Kapitalwert over time for every pump, run past T up to the payback
    horizon so the year a pump turns profitable shows even when that is after
    T. Up to T the curve is the period's own: the longer run would buy a
    replacement at the end of the service life, which the period does not."""
    inp, ref_sys = core["inp"], core["refSys"]
    runs = []
    for v, r in zip(core["variants"], core["results"]):
        long = evaluate(dc_replace(inp, T=PAYBACK_HORIZON), ref_sys, v, with_irr=False)["npvCurve"]
        runs.append([r["npvCurve"][j] if j <= inp.T else y for j, y in enumerate(long)])
    crossings: List[Optional[float]] = []
    for c in runs:
        k = next((j for j, y in enumerate(c) if y >= 0), -1)
        crossings.append(None if k == -1 else 0 if k == 0 else k - 1 + -c[k - 1] / (c[k] - c[k - 1]))
    last_crossing = max([0, *[0 if c is None else math.ceil(c) + 3 for c in crossings]])
    k_max = min(PAYBACK_HORIZON, max(inp.T, last_crossing))
    return {"runs": runs, "crossings": crossings, "kMax": k_max}


def economics(
    form: Dict[str, float],
    ref_type: str,
    selected: Sequence[OptimizedIntegrationPoint],
    opt: Optional[HPIOptimizationResult],
    sens_base: Optional[Dict[str, float]] = None,
) -> Optional[Dict[str, Any]]:
    """Everything the economic analysis shows, as numbers."""
    core = econ_core(form, ref_type, selected, opt)
    if core is None:
        return None
    return {
        "core": core,
        "sensitivity": sensitivity(core, form, sens_base),
        "size": size_curve(core),
        "npv": npv_runs(core),
    }

