/** Checks the formulas against the Hipp presentation (slide 22/24), whose
 *  numbers they reproduce to the euro. One hour at efficiency 1 turns the
 *  "power" inputs into the slide's annual kWh directly; the extras the slides
 *  do not have (CO₂ cost, cooling, capacity charge, reinvestment, residual
 *  value) are switched off. */

import { describe, it, expect } from 'vitest';
import {
  allocationFactor,
  annuityFactor,
  breakEvenElPrice,
  evaluate,
  referenceCost,
  residualValue,
  vdiSpecificCost,
  type EconInputs,
} from './economics';

const inp: EconInputs = {
  hours: 1,
  eta: 1,
  hsHi: 1,
  pFuel: 0.07,
  rFuel: 0.03,
  co2Fuel: 0.201,
  co2Priced: false,
  co2Price: 0,
  rCo2: 0,
  pEl: 0.13,
  rEl: 0.03,
  co2El: 0.352,
  co2ElPriced: false,
  i: 0.06,
  T: 15,
  fMaint: 0.05,
  opHours: 0,
  wage: 0,
  funding: 0,
  pDemand: 0,
  coolShare: 0,
  eer: 4,
  reinvestShare: 0,
  reinvestYear: 10,
  life: 0,
  rInv: 0,
  boilerInvest: 0,
  fMaintRef: 0,
  opFunding: 0,
  opFundingYears: 10,
};
const E_IST = 12_778_072;
const ref = { Q: E_IST, Qsrc: 0 };
// The pump covers the whole demand at the COP that yields the slide's kWh_el.
const variant = (el: number, capex: number) => ({ Q: E_IST, Qsrc: 0, cop: E_IST / el, capex });

describe('economics', () => {
  it('reproduces the Ist-Situation', () => {
    const r = referenceCost(inp, ref);
    expect(Math.round(r.opex1)).toBe(921_299);
    expect(Math.round(r.cumCost)).toBe(17_135_161);
  });

  it('reproduces Status Quo', () => {
    const r = evaluate(inp, ref, variant(6_546_800, 2_520_000));
    expect(Math.round(r.opex1)).toBe(1_002_617);
    expect(Math.round(r.energySaving)).toBe(6_231_272);
    expect(Math.round(r.saving1)).toBe(-81_318);
    expect(Math.round(r.npv)).toBe(-3_222_575);
    expect(Math.round(r.cumCost)).toBe(18_194_115);
    expect(r.npvCurve).toHaveLength(16);
    expect(r.payback).toBeNull(); // "nach 2067"
  });

  it('reproduces Max. WRG (except the slide NPV, which is inconsistent)', () => {
    const r = evaluate(inp, ref, variant(4_923_200, 3_270_000));
    expect(Math.round(r.opex1)).toBe(822_716);
    expect(Math.round(r.saving1)).toBe(98_583);
    expect(Math.round(r.cumCost)).toBe(14_713_211);
    expect(Math.round(r.npv)).toBe(-1_801_069);
  });

  it('keeps uncovered demand on the old heater and applies funding', () => {
    const half = evaluate(
      { ...inp, funding: 0.35 },
      { Q: 100, Qsrc: 0 },
      { Q: 50, Qsrc: 0, cop: 2, capex: 1000 }
    );
    expect(half.fuel).toBe(50);
    expect(half.el).toBe(25);
    expect(half.npvCurve[0]).toBe(-650);
    // Every yearly cash flow is negative here (maintenance outweighs the
    // saving), so no discount rate makes the net present value zero.
    expect(half.irr).toBeNull();
  });

  it('adds CO₂ cost, cooling saving, capacity charge, reinvestment and residual value', () => {
    const base = { ...inp, hours: 1000 };
    const r0 = { Q: 100, Qsrc: 60 };
    const v = { Q: 100, Qsrc: 60, cop: 2.5, capex: 100_000 };
    const plain = evaluate(base, r0, v);
    // CO₂ on the fuel makes the reference dearer: 0,201 t/MWh × 100 €/t = 2,01 ct/kWh.
    expect(evaluate({ ...base, co2Priced: true, co2Price: 100 }, r0, v).saving1).toBeCloseTo(
      plain.saving1 + 100 * 1000 * 0.0201 * 1,
      6
    );
    // Cooling 60 kW × 1000 h × 50 % / EER 4 = 7.500 kWh/a no longer bought.
    const cool = evaluate({ ...base, coolShare: 0.5 }, r0, v);
    expect(cool.saving1 - plain.saving1).toBeCloseTo(7500 * 0.13 * 1.03, 6);
    expect(cool.elCool).toBe(0);
    // Capacity charge on 40 kW electrical.
    expect(plain.saving1 - evaluate({ ...base, pDemand: 100 }, r0, v).saving1).toBeCloseTo(4000, 6);
    // Reinvestment of 20 % in year 10, discounted.
    const re = evaluate({ ...base, reinvestShare: 0.2 }, r0, v);
    expect(plain.npv - re.npv).toBeCloseTo(20_000 / 1.06 ** 10, 6);
    // 20-year life: a quarter of the investment is left after 15 years.
    const rv = evaluate({ ...base, life: 20 }, r0, v);
    expect(rv.residual).toBe(25_000);
    expect(rv.npv - plain.npv).toBeCloseTo(25_000 / 1.06 ** 15, 6);
    // Operating funding: 20 €/MWh on 100.000 kWh of heat, for 10 years only.
    const of = evaluate({ ...base, opFunding: 0.02 }, r0, v);
    expect(of.saving1 - plain.saving1).toBeCloseTo(2000, 6);
    const tenYears = Array.from({ length: 10 }, (_, k) => 2000 / 1.06 ** (k + 1)).reduce(
      (a, b) => a + b
    );
    expect(of.npv - plain.npv).toBeCloseTo(tenYears, 6);
  });

  it('finds the electricity price where the Kapitalwert is zero', () => {
    const v = variant(6_546_800, 2_520_000);
    const pEl = breakEvenElPrice(inp, ref, v, 0.07)!;
    expect(Math.abs(evaluate({ ...inp, pEl }, ref, v).npv)).toBeLessThan(1e-3);
    expect(pEl).toBeLessThan(0.13); // Status Quo loses money at 13 ct
  });
});

/** The worked examples in VDI 2067, VDI 4646 and the Hitzköpfe lecture
 *  (economic_calculation/). Page and slide numbers in the rationale file. */
describe('VDI 2067 / VDI 4646', () => {
  // No energy flows, so only the capital side moves.
  const none = { ...inp, hours: 0, fMaint: 0 };
  const zero = { Q: 0, Qsrc: 0 };

  it('reproduces the replacement and residual value example (VDI 2067 Annex B, p. 37)', () => {
    // Burner: A0 = 2000 €, TN = 12 a, T = 30 a, r = 1,03, q = 1,07.
    const vdi = { ...none, T: 30, i: 0.07, life: 12, rInv: 0.03 };
    expect(residualValue(vdi, 2000) / 1.07 ** 30).toBeCloseTo(267.04, 1);
    const v = { Q: 0, Qsrc: 0, cop: 1, capex: 2000 };
    // −A0 − A1 − A2 + RW with A1 = 1266,11 €, A2 = 801,52 €.
    expect(evaluate(vdi, zero, v).npv).toBeCloseTo(-2000 - 1266.11 - 801.52 + 267.04, 1);
    // Without replacements the period ends with a quarter of a 20-year life left.
    expect(residualValue({ ...none, T: 15, life: 20 }, 100_000)).toBe(25_000);
  });

  it('reproduces the lecture LCOH of a 250 kW heat pump (slides 15–22)', () => {
    expect(annuityFactor(0.06, 20)).toBeCloseTo(0.087185, 6);
    expect(vdiSpecificCost(250)).toBeCloseTo(483.74, 2);
    // 125.000 €, 3000 h, COP 4, 17,5 ct/kWh, CO₂ 50 €/t × 0,35 t/MWh on the
    // electricity, f_k 2,5 %, 5 h × 100 €/h, i 6 %, N 20 → 6,75 ct/kWh.
    const lec = {
      ...none,
      hours: 3000,
      pEl: 0.175,
      rEl: 0,
      co2El: 0.35,
      co2ElPriced: true,
      co2Price: 50,
      fMaint: 0.025,
      opHours: 5,
      wage: 100,
      T: 20,
      life: 20,
    };
    const r = evaluate(lec, { Q: 250, Qsrc: 0 }, { Q: 250, Qsrc: 0, cop: 4, capex: 125_000 });
    expect(r.alpha).toBe(1);
    expect(r.lcohHp * 750_000).toBeCloseTo(10_898.13 + 3_625 + 36_093.75, -1);
    expect(100 * r.lcohHp).toBeCloseTo(6.75, 2);
  });

  it('follows the nomogram equations of VDI 4646 Annex C (p. 90–91)', () => {
    // §8.2 (p. 72): k_el/k_ng = 3, COP 3,2 → k_Bed,WP = 2,9 ct/kWh_th, 6000 h,
    // 400 €/kW, f_k 2,5 %, η 0,87, N 20, constant prices. The text reads
    // PP ≈ 12 a and IRR ≈ 6 % off the chart; C5/C6 give 13,65 a and 3,95 %.
    const nom = {
      ...none,
      hours: 6000,
      eta: 0.87,
      pFuel: 0.03093,
      pEl: 0.0928,
      rFuel: 0,
      rEl: 0,
      fMaint: 0.025,
      T: 20,
      i: 0.12,
    };
    const r = evaluate(nom, { Q: 1, Qsrc: 0 }, { Q: 1, Qsrc: 0, cop: 3.2, capex: 400 });
    expect(r.saving1 + 0.025 * 400).toBeCloseTo(39.3, 1); // Δk_Bed ≈ −40 €/(kW·a)
    expect(r.paybackStatic!).toBeCloseTo(13.65, 1);
    expect(r.irr!).toBeCloseTo(0.0395, 3);
    // Replacement case: a 131 €/kW boiler no longer bought (p. 74).
    const rep = evaluate(
      { ...nom, boilerInvest: 131, fMaintRef: 0.03 },
      { Q: 1, Qsrc: 0 },
      { Q: 1, Qsrc: 0, cop: 3.2, capex: 400 }
    );
    expect(rep.paybackStatic!).toBeCloseTo((400 - 131) / (r.saving1 + 0.03 * 131), 6);
  });

  it('allocates the electricity with the Finnish method (VDI 4646 eq. 17–19, p. 55–57)', () => {
    // COP 3,2, η 0,87, COP_KA,ref 15: the norm reads COP_α = 3,35 off Bild 19.
    const a = allocationFactor({ ...inp, eta: 0.87, eer: 15, coolShare: 1 }, 3.2);
    expect(3.2 / a).toBeCloseTo(3.33, 2);
    // Nothing cooled today: all the electricity is for heating.
    expect(allocationFactor({ ...inp, coolShare: 0 }, 3.2)).toBe(1);
  });

  it('prices gas on Hs and its CO₂ on Hi (VDI 4646 eq. 23, p. 57; p. 60)', () => {
    const g = { ...inp, hours: 1000, eta: 0.87, hsHi: 1.11, co2Priced: true, co2Price: 100 };
    const r = referenceCost(g, { Q: 100, Qsrc: 0 });
    const fuelHs = (100 * 1000) / 0.87;
    expect(r.fuel).toBeCloseTo(fuelHs, 6);
    expect(r.co2).toBeCloseTo(((fuelHs / 1.11) * 0.201) / 1000, 9);
  });
});
