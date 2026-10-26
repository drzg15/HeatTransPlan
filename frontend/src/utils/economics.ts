/** Economic evaluation of a heat pump against the system it replaces.
 *
 *  Kapitalwertmethode (net present value) with price-dynamic cash flows, the
 *  approach of VDI 2067-1. Both systems are costed in full each year:
 *
 *    reference = a fuel-fired heater supplying the demand + the cooling that
 *                today removes the heat source's waste heat
 *    heat pump = the pump + whatever heat and cooling it leaves to the old
 *                systems, plus maintenance and the electrical capacity charge
 *
 *  Prices are given for the base year and escalate from year 1; the fuel
 *  carries a CO₂ cost with its own price path. Derivation and the check
 *  against the Hipp presentation: economic_calculation/economic_analysis_spec.md. */

export interface EconInputs {
  hours: number; // full-load hours per year
  eta: number; // efficiency of the reference heater, 0..1
  pFuel: number; // €/kWh, base year, excluding CO₂
  rFuel: number; // price change rate per year, 0.03 = 3 %
  co2Fuel: number; // t CO₂ per MWh of fuel
  co2Priced: boolean; // false where the CO₂ cost is already in the price (electric heater)
  co2Price: number; // €/t, base year
  rCo2: number;
  pEl: number; // €/kWh, base year
  rEl: number;
  co2El: number; // t CO₂ per MWh of grid electricity (emissions only, its cost is in pEl)
  i: number; // Kalkulationszins
  T: number; // Betrachtungszeitraum, years
  fMaint: number; // maintenance per year as share of the investment
  funding: number; // Förderquote, share of the investment
  pDemand: number; // Leistungspreis, € per kW electrical per year
  coolShare: number; // share of the source heat that is actively cooled today, 0..1
  eer: number; // efficiency of that cooling (kW cold per kW electrical)
  reinvestShare: number; // reinvestment as share of the investment …
  reinvestYear: number; // … in this year of operation
  life: number; // service life for the residual value (linear), years
  opFunding: number; // operating funding, € per kWh of heat from the heat pump …
  opFundingYears: number; // … paid in the first this many years
}

/** What the reference system has to supply: the largest demand of the pumps compared. */
export interface EconReference {
  Q: number; // heat, kW
  Qsrc: number; // waste heat at the source, kW
}

export interface EconVariant {
  Q: number; // heat the pump delivers, kW
  Qsrc: number; // heat it draws from the source, kW
  cop: number;
  capex: number; // €
}

export interface EconResult {
  fuel: number; // kWh/a still burnt in the old heater
  el: number; // kWh/a drawn by the heat pump
  elCool: number; // kWh/a still drawn by the old cooling
  co2: number; // t/a
  opex1: number; // Betriebskosten im 1. Jahr, €/a
  energySaving: number; // kWh/a final energy saved against the reference
  saving1: number; // Kosteneinsparung im 1. Jahr, €/a
  co2Saving: number; // t/a
  npvCurve: number[]; // Kapitalwert after k years without residual value, k = 0..T
  residual: number; // Restwert after T years, € (undiscounted)
  npv: number; // Kapitalwert incl. discounted residual value
  payback: number | null; // years until the Kapitalwert turns positive
  roi: number | null; // Kapitalwert / net investment (assumed definition)
  cumCost: number; // nominal operating costs over T, undiscounted
}

/** Payback is searched past T up to this horizon ("nach 2067" on the slides). */
export const PAYBACK_HORIZON = 40;

/** Fuel price incl. CO₂ cost in year t, €/kWh. */
export function fuelPrice(inp: EconInputs, t: number) {
  const co2 = inp.co2Priced ? (inp.co2Fuel / 1000) * inp.co2Price * (1 + inp.rCo2) ** t : 0;
  return inp.pFuel * (1 + inp.rFuel) ** t + co2;
}

export const elPrice = (inp: EconInputs, t: number) => inp.pEl * (1 + inp.rEl) ** t;

/** Energy flows and fixed costs of a system: the reference alone (v = null)
 *  or a heat pump with the reference covering what the pump leaves. */
function flows(inp: EconInputs, ref: EconReference, v: EconVariant | null) {
  const fuel = (Math.max(ref.Q - (v?.Q ?? 0), 0) * inp.hours) / inp.eta;
  const el = v && v.cop > 0 ? (v.Q * inp.hours) / v.cop : 0;
  const elCool =
    inp.eer > 0
      ? (Math.max(ref.Qsrc - (v?.Qsrc ?? 0), 0) * inp.hours * inp.coolShare) / inp.eer
      : 0;
  const pElKw = v && v.cop > 0 ? v.Q / v.cop : 0;
  const fixed = v ? inp.fMaint * v.capex + inp.pDemand * pElKw : 0;
  return {
    fuel,
    el,
    elCool,
    co2: (fuel * inp.co2Fuel + (el + elCool) * inp.co2El) / 1000,
    // Operating funding lowers the heat pump's cost while it is paid.
    cost: (t: number) =>
      fuel * fuelPrice(inp, t) +
      (el + elCool) * elPrice(inp, t) +
      fixed -
      (v && t <= inp.opFundingYears ? inp.opFunding * v.Q * inp.hours : 0),
  };
}

export function referenceCost(inp: EconInputs, ref: EconReference) {
  const f = flows(inp, ref, null);
  let cum = 0;
  for (let t = 1; t <= inp.T; t++) cum += f.cost(t);
  return { fuel: f.fuel, elCool: f.elCool, co2: f.co2, opex1: f.cost(1), cumCost: cum };
}

export function evaluate(inp: EconInputs, ref: EconReference, v: EconVariant): EconResult {
  const r = flows(inp, ref, null);
  const h = flows(inp, ref, v);
  const netInvest = (1 - inp.funding) * v.capex;

  const npvCurve = [-netInvest];
  let npv = -netInvest;
  let payback: number | null = npv >= 0 ? 0 : null;
  let cumCost = 0;
  for (let t = 1; t <= Math.max(inp.T, PAYBACK_HORIZON); t++) {
    const cost = h.cost(t);
    const reinvest = t === inp.reinvestYear ? inp.reinvestShare * v.capex : 0;
    npv += (r.cost(t) - cost - reinvest) / (1 + inp.i) ** t;
    if (payback === null && npv >= 0) payback = t;
    if (t <= inp.T) {
      npvCurve.push(npv);
      cumCost += cost;
    }
  }

  // Linear depreciation; counted in the Kapitalwert, not in the payback curve.
  const residual = inp.life > 0 ? v.capex * Math.max(0, 1 - inp.T / inp.life) : 0;
  const npvT = npvCurve[npvCurve.length - 1] + residual / (1 + inp.i) ** inp.T;

  return {
    fuel: h.fuel,
    el: h.el,
    elCool: h.elCool,
    co2: h.co2,
    opex1: h.cost(1),
    energySaving: r.fuel + r.elCool - (h.fuel + h.el + h.elCool),
    saving1: r.cost(1) - h.cost(1),
    co2Saving: r.co2 - h.co2,
    npvCurve,
    residual,
    npv: npvT,
    payback,
    roi: netInvest > 0 ? npvT / netInvest : null,
    cumCost,
  };
}

/** Electricity price [€/kWh] at which the Kapitalwert is exactly 0 for a given
 *  fuel price: below it the heat pump beats the reference. The Kapitalwert is
 *  linear in the electricity price, so two evaluations pin the root exactly.
 *  null when the electricity price has no effect. */
export function breakEvenElPrice(
  inp: EconInputs,
  ref: EconReference,
  v: EconVariant,
  pFuel: number
): number | null {
  const at = (pEl: number) => evaluate({ ...inp, pFuel, pEl }, ref, v).npv;
  const npv0 = at(0);
  const slope = at(1) - npv0;
  return slope < 0 ? -npv0 / slope : null;
}
