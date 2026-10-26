/** Checks the formulas against the Hipp presentation (slide 22/24), whose
 *  numbers they reproduce to the euro. One hour at efficiency 1 turns the
 *  "power" inputs into the slide's annual kWh directly; the extras the slides
 *  do not have (CO₂ cost, cooling, capacity charge, reinvestment, residual
 *  value) are switched off. */

import { describe, it, expect } from 'vitest';
import { breakEvenElPrice, evaluate, referenceCost, type EconInputs } from './economics';

const inp: EconInputs = {
  hours: 1,
  eta: 1,
  pFuel: 0.07,
  rFuel: 0.03,
  co2Fuel: 0.201,
  co2Priced: false,
  co2Price: 0,
  rCo2: 0,
  pEl: 0.13,
  rEl: 0.03,
  co2El: 0.352,
  i: 0.06,
  T: 15,
  fMaint: 0.05,
  funding: 0,
  pDemand: 0,
  coolShare: 0,
  eer: 4,
  reinvestShare: 0,
  reinvestYear: 10,
  life: 0,
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
    expect(half.roi).toBeCloseTo(half.npv / 650);
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
    const tenYears = Array.from({ length: 10 }, (_, k) => 2000 / 1.06 ** (k + 1)).reduce((a, b) => a + b);
    expect(of.npv - plain.npv).toBeCloseTo(tenYears, 6);
  });

  it('finds the electricity price where the Kapitalwert is zero', () => {
    const v = variant(6_546_800, 2_520_000);
    const pEl = breakEvenElPrice(inp, ref, v, 0.07)!;
    expect(Math.abs(evaluate({ ...inp, pEl }, ref, v).npv)).toBeLessThan(1e-3);
    expect(pEl).toBeLessThan(0.13); // Status Quo loses money at 13 ct
  });
});
