"""Economic evaluation of a heat pump against the system it replaces.

Kapitalwertmethode (net present value) with price-dynamic cash flows, the
approach of VDI 2067 Blatt 1; the VDI 4646 results (LCOH, static payback,
internal rate of return, Finnish allocation factor) are derived from the
same cash flows. Both systems are costed in full each year:

  reference = a fuel-fired heater supplying the demand + the cooling that
              today removes the heat source's waste heat
  heat pump = the pump + whatever heat and cooling it leaves to the old
              systems, plus maintenance, operation and capacity charge

Prices are given for the base year (today) and change from year 1. Gas is
priced per kWh of gross calorific value (Hs, as tariffs are); its CO₂
factor is per kWh of net calorific value (Hi), so the two are linked by
the Hs/Hi ratio (VDI 4646 eq. 23). Every value, formula and check is
documented in data/economic_calculation/economic_analysis_rationale.md.

Line for line the same as frontend/src/utils/economics.ts used to be, so
the page shows exactly what it showed when the numbers were computed there.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, replace as dc_replace
from typing import Callable, List, Optional


@dataclass(frozen=True)
class EconInputs:
    hours: float  # full-load hours per year
    eta: float  # efficiency of the reference heater on Hs, 0..1
    hsHi: float  # ratio gross / net calorific value of the fuel (gas 1,11)
    pFuel: float  # €/kWh_Hs, base year, excluding CO₂
    rFuel: float  # price change rate per year, 0.03 = 3 %
    co2Fuel: float  # t CO₂ per MWh of fuel on Hi
    co2Priced: bool  # false where the CO₂ cost is already in the price (electric heater)
    co2Price: float  # €/t, base year
    rCo2: float
    pEl: float  # €/kWh, base year
    rEl: float
    co2El: float  # t CO₂ per MWh of grid electricity
    co2ElPriced: bool  # CO₂ cost added on electricity too (not already in its price)
    i: float  # Kalkulationszins
    T: int  # Betrachtungszeitraum, years
    fMaint: float  # maintenance per year (f_Inst + f_W+Insp) as share of the investment
    opHours: float  # hours of operation (Bedienen) per year …
    wage: float  # … at this hourly rate, €/h
    funding: float  # Förderquote, share of the investment
    pDemand: float  # Leistungspreis, € per kW electrical per year
    coolShare: float  # share of the source heat that is actively cooled today, 0..1
    eer: float  # efficiency of that cooling (kW cold per kW electrical)
    reinvestShare: float  # extra reinvestment as share of the investment …
    reinvestYear: float  # … in this year of operation
    life: float  # service life (TN), years: replacements and residual value, 0 = none
    rInv: float  # price change rate of the investment (replacements)
    boilerInvest: float  # € per kW of heat pump output: boiler investment avoided (replacement case)
    fMaintRef: float  # maintenance of that avoided boiler, share per year
    opFunding: float  # operating funding, € per kWh of heat from the heat pump …
    opFundingYears: float  # … paid in the first this many years


@dataclass(frozen=True)
class EconReference:
    """What the reference system has to supply: the largest demand of the pumps compared."""
    Q: float  # heat, kW
    Qsrc: float  # waste heat at the source, kW


@dataclass(frozen=True)
class EconVariant:
    Q: float  # heat the pump delivers, kW
    Qsrc: float  # heat it draws from the source, kW
    cop: float
    capex: float  # €


# Payback is searched past T up to this horizon ("nach 2067" on the slides).
PAYBACK_HORIZON = 40


def annuity_factor(i: float, T: float) -> float:
    """Annuity factor a = (q − 1) / (1 − q^−T), VDI 2067 eq. (4)."""
    return 1 / T if abs(i) < 1e-12 else i / (1 - (1 + i) ** -T)


def _co2_at(inp: EconInputs, t: float) -> float:
    return inp.co2Price * (1 + inp.rCo2) ** t


def fuel_price(inp: EconInputs, t: float) -> float:
    """Fuel price incl. CO₂ cost in year t, € per kWh_Hs. The CO₂ factor is per
    kWh_Hi, so per kWh_Hs it is divided by Hs/Hi."""
    co2 = (inp.co2Fuel / inp.hsHi / 1000) * _co2_at(inp, t) if inp.co2Priced else 0
    return inp.pFuel * (1 + inp.rFuel) ** t + co2


def el_price(inp: EconInputs, t: float) -> float:
    """Electricity price in year t, €/kWh, with its CO₂ cost when that is not
    already in the price."""
    return inp.pEl * (1 + inp.rEl) ** t + ((inp.co2El / 1000) * _co2_at(inp, t) if inp.co2ElPriced else 0)


@dataclass(frozen=True)
class _Flows:
    fuel: float
    el: float
    elCool: float
    co2: float
    cost: Callable[[int], float]


def _flows(inp: EconInputs, ref: EconReference, v: Optional[EconVariant]) -> _Flows:
    """Energy flows and fixed costs of a system: the reference alone (v = None)
    or a heat pump with the reference covering what the pump leaves."""
    fuel = (max(ref.Q - (v.Q if v else 0), 0) * inp.hours) / inp.eta
    el = (v.Q * inp.hours) / v.cop if v and v.cop > 0 else 0
    el_cool = (
        (max(ref.Qsrc - (v.Qsrc if v else 0), 0) * inp.hours * inp.coolShare) / inp.eer
        if inp.eer > 0
        else 0
    )
    p_el_kw = v.Q / v.cop if v and v.cop > 0 else 0
    # Heat pump only: maintenance, operation, capacity charge; minus the
    # maintenance of a boiler that no longer has to be bought (replacement case).
    fixed = (
        inp.fMaint * v.capex + inp.opHours * inp.wage + inp.pDemand * p_el_kw
        - inp.fMaintRef * inp.boilerInvest * v.Q
        if v
        else 0
    )

    def cost(t: int) -> float:
        # Operating funding lowers the heat pump's cost while it is paid.
        return (
            fuel * fuel_price(inp, t)
            + (el + el_cool) * el_price(inp, t)
            + fixed
            - (inp.opFunding * v.Q * inp.hours if v and t <= inp.opFundingYears else 0)
        )

    return _Flows(
        fuel=fuel,
        el=el,
        elCool=el_cool,
        co2=((fuel / inp.hsHi) * inp.co2Fuel + (el + el_cool) * inp.co2El) / 1000,
        cost=cost,
    )


def reference_cost(inp: EconInputs, ref: EconReference) -> dict:
    f = _flows(inp, ref, None)
    cum = 0.0
    for t in range(1, int(inp.T) + 1):
        cum += f.cost(t)
    return {"fuel": f.fuel, "elCool": f.elCool, "co2": f.co2, "opex1": f.cost(1), "cumCost": cum}


def _replacement(inp: EconInputs, capex: float, t: int) -> float:
    """Replacement purchase in year t (VDI 2067 eq. 2): the machine is bought
    again at the end of each service life, at the then-current price. None at
    the end of the period itself."""
    return capex * (1 + inp.rInv) ** t if inp.life > 0 and _js_mod(t, inp.life) == 0 and t != inp.T else 0


def _js_mod(a: float, b: float) -> float:
    # JavaScript's % keeps the sign of the dividend; Python's follows the divisor.
    return math.fmod(a, b)


def residual_value(inp: EconInputs, capex: float) -> float:
    """Residual value after T years (VDI 2067 eq. 3, undiscounted): the last
    purchase depreciated linearly over its service life."""
    if inp.life <= 0:
        return 0
    n = math.ceil(inp.T / inp.life) - 1  # replacements within T
    return (capex * (1 + inp.rInv) ** (n * inp.life) * ((n + 1) * inp.life - inp.T)) / inp.life


def npv_at(inp: EconInputs, ref: EconReference, v: EconVariant, i: float) -> float:
    """NPV over T at discount rate i: the heart of evaluate, reused to solve for
    the internal rate of return."""
    r = _flows(inp, ref, None)
    h = _flows(inp, ref, v)
    npv = -((1 - inp.funding) * v.capex) + inp.boilerInvest * v.Q
    for t in range(1, int(inp.T) + 1):
        reinvest = (inp.reinvestShare * v.capex if t == inp.reinvestYear else 0) + _replacement(inp, v.capex, t)
        npv += (r.cost(t) - h.cost(t) - reinvest) / (1 + i) ** t
    return npv + residual_value(inp, v.capex) / (1 + i) ** inp.T


def _internal_rate(inp: EconInputs, ref: EconReference, v: EconVariant) -> Optional[float]:
    """Internal rate of return: the discount rate at which the NPV over T is 0,
    by bisection. None when the NPV has no root in −99 % … 1000 %."""
    lo = -0.99
    hi = 10.0
    f_lo = npv_at(inp, ref, v, lo)
    if f_lo * npv_at(inp, ref, v, hi) > 0:
        return None
    k = 0
    while k < 200 and hi - lo > 1e-9:
        mid = (lo + hi) / 2
        if npv_at(inp, ref, v, mid) * f_lo > 0:
            lo = mid
        else:
            hi = mid
        k += 1
    return (lo + hi) / 2


def allocation_factor(inp: EconInputs, cop: float) -> float:
    """Finnish allocation factor (VDI 4646 eq. 17/18): the share of the heat
    pump's electricity that is charged to heating when its cold side also
    replaces cooling. Only the actively cooled share of the source heat counts
    as useful cooling, so with nothing cooled today α = 1."""
    heat = cop / inp.eta
    cold = (inp.coolShare * max(cop - 1, 0)) / inp.eer if inp.eer > 0 else 0
    return heat / (heat + cold)


def evaluate(inp: EconInputs, ref: EconReference, v: EconVariant, with_irr: bool = True) -> dict:
    """All results of one heat pump. `with_irr=False` skips the internal rate
    of return, the one costly result, where only the NPV is wanted."""
    r = _flows(inp, ref, None)
    h = _flows(inp, ref, v)
    # A boiler that no longer has to be bought counts as income at t = 0.
    net_invest = (1 - inp.funding) * v.capex - inp.boilerInvest * v.Q

    def rate(t: float) -> float:
        return (1 + inp.i) ** t

    npv_curve: List[float] = [-net_invest]
    npv = -net_invest
    payback: Optional[int] = 0 if npv >= 0 else None
    cum_cost = 0.0
    for t in range(1, int(max(inp.T, PAYBACK_HORIZON)) + 1):
        cost = h.cost(t)
        reinvest = (inp.reinvestShare * v.capex if t == inp.reinvestYear else 0) + _replacement(inp, v.capex, t)
        npv += (r.cost(t) - cost - reinvest) / rate(t)
        if payback is None and npv >= 0:
            payback = t
        if t <= inp.T:
            npv_curve.append(npv)
            cum_cost += cost

    # Counted in the Kapitalwert, not in the payback curve.
    residual = residual_value(inp, v.capex)
    npv_T = npv_curve[-1] + residual / rate(inp.T)
    saving1 = r.cost(1) - h.cost(1)

    # LCOH (VDI 4646 eq. 21–23): annuity of a heater's costs over the heat it
    # makes. The heat pump: capital (net of funding, with replacements, less
    # residual value) + maintenance and operation + its electricity, of which
    # only the share α is charged to heating. The reference heater: its fuel.
    a = annuity_factor(inp.i, inp.T)
    heat = v.Q * inp.hours
    alpha = allocation_factor(inp, v.cop)
    pv_hp = (1 - inp.funding) * v.capex - residual / rate(inp.T)
    pv_ref = inp.boilerInvest * v.Q
    p_el_kw = v.Q / v.cop if v.cop > 0 else 0
    for t in range(1, int(inp.T) + 1):
        own = (
            alpha * h.el * el_price(inp, t)
            + inp.fMaint * v.capex
            + inp.opHours * inp.wage
            + inp.pDemand * p_el_kw
            - (inp.opFunding * heat if t <= inp.opFundingYears else 0)
        )
        pv_hp += (own + _replacement(inp, v.capex, t)) / rate(t)
        pv_ref += ((heat / inp.eta) * fuel_price(inp, t) + inp.fMaintRef * inp.boilerInvest * v.Q) / rate(t)

    return {
        "fuel": h.fuel,
        "el": h.el,
        "elCool": h.elCool,
        "co2": h.co2,
        "opex1": h.cost(1),
        "energySaving": r.fuel + r.elCool - (h.fuel + h.el + h.elCool),
        "saving1": saving1,
        "co2Saving": r.co2 - h.co2,
        "npvCurve": npv_curve,
        "residual": residual,
        "npv": npv_T,
        "payback": payback,
        "paybackStatic": 0 if net_invest <= 0 else (net_invest / saving1 if saving1 > 0 else None),
        "irr": _internal_rate(inp, ref, v) if with_irr else None,
        "lcohHp": (a * pv_hp) / heat if heat > 0 else 0,
        "lcohRef": (a * pv_ref) / heat if heat > 0 else 0,
        "alpha": alpha,
        "cumCost": cum_cost,
    }


def break_even_el_price(inp: EconInputs, ref: EconReference, v: EconVariant, p_fuel: float) -> Optional[float]:
    """Electricity price [€/kWh] at which the Kapitalwert is exactly 0 for a given
    fuel price: below it the heat pump beats the reference. The Kapitalwert is
    linear in the electricity price, so two evaluations pin the root exactly.
    None when the electricity price has no effect."""
    def at(p_el: float) -> float:
        return npv_at(dc_replace(inp, pFuel=p_fuel, pEl=p_el), ref, v, inp.i)

    npv0 = at(0)
    slope = at(1) - npv0
    return -npv0 / slope if slope < 0 else None


def vdi_specific_cost(Q: float) -> float:
    """VDI 4646 cost function (eq. 25/26, Tabelle 6): specific investment of a
    large heat pump incl. planning, installation and integration, €/kW_th.
    Shown for reference only; the app's default comes from newer literature."""
    if Q <= 0:
        return 0
    F, E = (1521, 0.637) if Q <= 210 else (349.5, 0.912)
    return (F * Q ** E * 1.25 * 1.8) / Q
