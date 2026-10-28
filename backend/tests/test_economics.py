"""The Python economics against the numbers the page computed before the
calculation moved to the backend (tests/fixtures/economics_reference.json,
written by the original TypeScript on 120 random input sets).

Floats are compared to 1e-9 relative: the two languages' pow() may differ in
the last bit, nothing more.
"""

import json
import math
from dataclasses import asdict
from pathlib import Path

import pytest

from app.models.analysis import HPIOptimizationResult, OptimizedIntegrationPoint
from app.services.economics import economics

REF = json.loads((Path(__file__).parent / "fixtures" / "economics_reference.json").read_text(encoding="utf-8"))
OPT = HPIOptimizationResult(**REF["optimization"])


def close(a, b, path="") -> None:
    if isinstance(b, dict):
        for k in b:
            close(a[k], b[k], f"{path}.{k}")
    elif isinstance(b, list):
        assert len(a) == len(b), f"{path}: length {len(a)} != {len(b)}"
        for i, (x, y) in enumerate(zip(a, b)):
            close(x, y, f"{path}[{i}]")
    elif isinstance(b, float) or isinstance(a, float):
        if b is None:
            assert a is None or not math.isfinite(a), f"{path}: {a} != None"
        else:
            assert a == pytest.approx(b, rel=1e-9, abs=1e-9), f"{path}: {a} != {b}"
    else:
        assert a == b, f"{path}: {a!r} != {b!r}"


@pytest.mark.parametrize("n", range(len(REF["cases"])))
def test_matches_the_typescript(n):
    case = REF["cases"][n]
    exp = case["expect"]
    selected = [OptimizedIntegrationPoint(**p) for p in case["selected"]]
    out = economics(case["form"], case["refType"], selected, OPT, case["sensBase"])
    core = out["core"]

    close(asdict(core["refSys"]), exp["refSys"], "refSys")
    close(core["ref"], exp["ref"], "ref")
    close(core["specTotal"], exp["specTotal"], "specTotal")
    close([asdict(v) for v in core["variants"]], exp["variants"], "variants")
    close(core["results"], exp["results"], "results")
    close(core["breakEven"], exp["breakEven"], "breakEven")
    close(core["pump"].model_dump(), exp["pump"], "pump")

    s = out["sensitivity"]
    close(s["gasCt"], exp["sens"]["x"], "sens.x")
    close(s["elCt"], exp["sens"]["y"], "sens.y")
    close(s["z"], exp["sens"]["z"], "sens.z")
    close(s["beX"], exp["sens"]["beX"], "sens.beX")
    close(s["beY"], exp["sens"]["beY"], "sens.beY")

    # The size curve now leaves out source- and demand-limited pumps (see
    # size_curve); the page's old curve kept them, so it is checked on its own below.

    r = out["npv"]
    assert r["kMax"] + 1 == exp["npv"]["years"]
    close([run[: r["kMax"] + 1] for run in r["runs"]], exp["npv"]["runs"], "npv.runs")
    close([c for c in r["crossings"] if c is not None], exp["npv"]["crossings"], "npv.crossings")


# ---------------------------------------------------------------------------
# The formulas against the literature. Moved from the page's own unit tests
# (utils/economics.test.ts) together with the formulas themselves.
# ---------------------------------------------------------------------------

from dataclasses import replace as _r  # noqa: E402

from app.services.economics.formulas import (  # noqa: E402
    EconInputs,
    EconReference,
    EconVariant,
    allocation_factor,
    annuity_factor,
    break_even_el_price,
    evaluate,
    reference_cost,
    residual_value,
    vdi_specific_cost,
)


def near(a, b, digits):
    """Jest's toBeCloseTo: |a − b| < 10^−digits / 2."""
    assert abs(a - b) < 10 ** -digits / 2, f"{a} != {b} to {digits} digits"


# Checks against the Hipp presentation (slide 22/24), whose numbers the
# formulas reproduce to the euro. One hour at efficiency 1 turns the "power"
# inputs into the slide's annual kWh directly; the extras the slides do not
# have (CO₂ cost, cooling, capacity charge, reinvestment, residual value) are off.
INP = EconInputs(
    hours=1, eta=1, hsHi=1, pFuel=0.07, rFuel=0.03, co2Fuel=0.201, co2Priced=False,
    co2Price=0, rCo2=0, pEl=0.13, rEl=0.03, co2El=0.352, co2ElPriced=False, i=0.06,
    T=15, fMaint=0.05, opHours=0, wage=0, funding=0, pDemand=0, coolShare=0, eer=4,
    reinvestShare=0, reinvestYear=10, life=0, rInv=0, boilerInvest=0, fMaintRef=0,
    opFunding=0, opFundingYears=10,
)
E_IST = 12_778_072
REF_IST = EconReference(Q=E_IST, Qsrc=0)


def variant(el, capex):
    # The pump covers the whole demand at the COP that yields the slide's kWh_el.
    return EconVariant(Q=E_IST, Qsrc=0, cop=E_IST / el, capex=capex)


def jround(x):
    return math.floor(x + 0.5)


def test_reproduces_the_ist_situation():
    r = reference_cost(INP, REF_IST)
    assert jround(r["opex1"]) == 921_299
    assert jround(r["cumCost"]) == 17_135_161


def test_reproduces_status_quo():
    r = evaluate(INP, REF_IST, variant(6_546_800, 2_520_000))
    assert jround(r["opex1"]) == 1_002_617
    assert jround(r["energySaving"]) == 6_231_272
    assert jround(r["saving1"]) == -81_318
    assert jround(r["npv"]) == -3_222_575
    assert jround(r["cumCost"]) == 18_194_115
    assert len(r["npvCurve"]) == 16
    assert r["payback"] is None  # "nach 2067"


def test_reproduces_max_wrg():
    # Except the slide NPV, which is inconsistent.
    r = evaluate(INP, REF_IST, variant(4_923_200, 3_270_000))
    assert jround(r["opex1"]) == 822_716
    assert jround(r["saving1"]) == 98_583
    assert jround(r["cumCost"]) == 14_713_211
    assert jround(r["npv"]) == -1_801_069


def test_keeps_uncovered_demand_on_the_old_heater_and_applies_funding():
    half = evaluate(_r(INP, funding=0.35), EconReference(Q=100, Qsrc=0), EconVariant(Q=50, Qsrc=0, cop=2, capex=1000))
    assert half["fuel"] == 50
    assert half["el"] == 25
    assert half["npvCurve"][0] == -650
    # Every yearly cash flow is negative here (maintenance outweighs the
    # saving), so no discount rate makes the net present value zero.
    assert half["irr"] is None


def test_adds_co2_cooling_capacity_reinvestment_and_residual_value():
    base = _r(INP, hours=1000)
    r0 = EconReference(Q=100, Qsrc=60)
    v = EconVariant(Q=100, Qsrc=60, cop=2.5, capex=100_000)
    plain = evaluate(base, r0, v)
    # CO₂ on the fuel makes the reference dearer: 0,201 t/MWh × 100 €/t = 2,01 ct/kWh.
    near(evaluate(_r(base, co2Priced=True, co2Price=100), r0, v)["saving1"], plain["saving1"] + 100 * 1000 * 0.0201 * 1, 6)
    # Cooling 60 kW × 1000 h × 50 % / EER 4 = 7.500 kWh/a no longer bought.
    cool = evaluate(_r(base, coolShare=0.5), r0, v)
    near(cool["saving1"] - plain["saving1"], 7500 * 0.13 * 1.03, 6)
    assert cool["elCool"] == 0
    # Capacity charge on 40 kW electrical.
    near(plain["saving1"] - evaluate(_r(base, pDemand=100), r0, v)["saving1"], 4000, 6)
    # Reinvestment of 20 % in year 10, discounted.
    near(plain["npv"] - evaluate(_r(base, reinvestShare=0.2), r0, v)["npv"], 20_000 / 1.06 ** 10, 6)
    # 20-year life: a quarter of the investment is left after 15 years.
    rv = evaluate(_r(base, life=20), r0, v)
    assert rv["residual"] == 25_000
    near(rv["npv"] - plain["npv"], 25_000 / 1.06 ** 15, 6)
    # Operating funding: 20 €/MWh on 100.000 kWh of heat, for 10 years only.
    of = evaluate(_r(base, opFunding=0.02), r0, v)
    near(of["saving1"] - plain["saving1"], 2000, 6)
    near(of["npv"] - plain["npv"], sum(2000 / 1.06 ** (k + 1) for k in range(10)), 6)


def test_finds_the_electricity_price_where_the_kapitalwert_is_zero():
    v = variant(6_546_800, 2_520_000)
    p_el = break_even_el_price(INP, REF_IST, v, 0.07)
    assert abs(evaluate(_r(INP, pEl=p_el), REF_IST, v)["npv"]) < 1e-3
    assert p_el < 0.13  # Status Quo loses money at 13 ct


# The worked examples in VDI 2067, VDI 4646 and the Hitzköpfe lecture
# (data/economic_calculation/). Page and slide numbers in the rationale file.
NONE = _r(INP, hours=0, fMaint=0)  # no energy flows: only the capital side moves
ZERO = EconReference(Q=0, Qsrc=0)


def test_vdi_2067_replacement_and_residual_value_example():
    # VDI 2067 Annex B, p. 37. Burner: A0 = 2000 €, TN = 12 a, T = 30 a, r = 1,03, q = 1,07.
    vdi = _r(NONE, T=30, i=0.07, life=12, rInv=0.03)
    near(residual_value(vdi, 2000) / 1.07 ** 30, 267.04, 1)
    v = EconVariant(Q=0, Qsrc=0, cop=1, capex=2000)
    # −A0 − A1 − A2 + RW with A1 = 1266,11 €, A2 = 801,52 €.
    near(evaluate(vdi, ZERO, v)["npv"], -2000 - 1266.11 - 801.52 + 267.04, 1)
    # Without replacements the period ends with a quarter of a 20-year life left.
    assert residual_value(_r(NONE, T=15, life=20), 100_000) == 25_000


def test_lecture_lcoh_of_a_250_kw_heat_pump():
    # Slides 15–22.
    near(annuity_factor(0.06, 20), 0.087185, 6)
    near(vdi_specific_cost(250), 483.74, 2)
    # 125.000 €, 3000 h, COP 4, 17,5 ct/kWh, CO₂ 50 €/t × 0,35 t/MWh on the
    # electricity, f_k 2,5 %, 5 h × 100 €/h, i 6 %, N 20 → 6,75 ct/kWh.
    lec = _r(NONE, hours=3000, pEl=0.175, rEl=0, co2El=0.35, co2ElPriced=True, co2Price=50,
             fMaint=0.025, opHours=5, wage=100, T=20, life=20)
    r = evaluate(lec, EconReference(Q=250, Qsrc=0), EconVariant(Q=250, Qsrc=0, cop=4, capex=125_000))
    assert r["alpha"] == 1
    near(r["lcohHp"] * 750_000, 10_898.13 + 3_625 + 36_093.75, -1)
    near(100 * r["lcohHp"], 6.75, 2)


def test_vdi_4646_nomogram_equations():
    # Annex C (p. 90–91), §8.2 (p. 72): k_el/k_ng = 3, COP 3,2 → k_Bed,WP = 2,9
    # ct/kWh_th, 6000 h, 400 €/kW, f_k 2,5 %, η 0,87, N 20, constant prices. The
    # text reads PP ≈ 12 a and IRR ≈ 6 % off the chart; C5/C6 give 13,65 a and 3,95 %.
    nom = _r(NONE, hours=6000, eta=0.87, pFuel=0.03093, pEl=0.0928, rFuel=0, rEl=0, fMaint=0.025, T=20, i=0.12)
    one = EconReference(Q=1, Qsrc=0)
    r = evaluate(nom, one, EconVariant(Q=1, Qsrc=0, cop=3.2, capex=400))
    near(r["saving1"] + 0.025 * 400, 39.3, 1)  # Δk_Bed ≈ −40 €/(kW·a)
    near(r["paybackStatic"], 13.65, 1)
    near(r["irr"], 0.0395, 3)
    # Replacement case: a 131 €/kW boiler no longer bought (p. 74).
    rep = evaluate(_r(nom, boilerInvest=131, fMaintRef=0.03), one, EconVariant(Q=1, Qsrc=0, cop=3.2, capex=400))
    near(rep["paybackStatic"], (400 - 131) / (r["saving1"] + 0.03 * 131), 6)


def test_finnish_allocation():
    # VDI 4646 eq. 17–19, p. 55–57. COP 3,2, η 0,87, COP_KA,ref 15: the norm reads
    # COP_α = 3,35 off Bild 19.
    a = allocation_factor(_r(INP, eta=0.87, eer=15, coolShare=1), 3.2)
    near(3.2 / a, 3.33, 2)
    # Nothing cooled today: all the electricity is for heating.
    assert allocation_factor(_r(INP, coolShare=0), 3.2) == 1


def test_gas_on_hs_and_its_co2_on_hi():
    # VDI 4646 eq. 23, p. 57; p. 60.
    g = _r(INP, hours=1000, eta=0.87, hsHi=1.11, co2Priced=True, co2Price=100)
    r = reference_cost(g, EconReference(Q=100, Qsrc=0))
    fuel_hs = (100 * 1000) / 0.87
    near(r["fuel"], fuel_hs, 6)
    near(r["co2"], ((fuel_hs / 1.11) * 0.201) / 1000, 9)


def test_the_size_curve_keeps_to_the_profiles():
    case = REF["cases"][0]
    out = economics(case["form"], case["refType"], [], OPT, None)
    sizes = out["size"]["sizes"]
    assert sizes and not any(s["p"].source_limited or s["p"].demand_limited for s in sizes)
    # Every on-profile pump's size is there, each with its best net present value.
    on = [p for p in OPT.feasible_points if not p.theoretical and p.COP > 0
          and not p.source_limited and not p.demand_limited]
    assert {round(100 * p.Q_demand / out["core"]["refSys"].Q + 1e-9) for p in on} == {
        round(100 * s["p"].Q_demand / out["core"]["refSys"].Q + 1e-9) for s in sizes}
