/** Economic evaluation of a heat pump against the system it replaces.
 *
 *  Kapitalwertmethode (net present value) with price-dynamic cash flows, the
 *  approach of VDI 2067 Blatt 1; the VDI 4646 results (LCOH, static payback,
 *  internal rate of return, Finnish allocation factor) are derived from the
 *  same cash flows. Both systems are costed in full each year:
 *
 *    reference = a fuel-fired heater supplying the demand + the cooling that
 *                today removes the heat source's waste heat
 *    heat pump = the pump + whatever heat and cooling it leaves to the old
 *                systems, plus maintenance, operation and capacity charge
 *
 *  Prices are given for the base year (today) and change from year 1. Gas is
 *  priced per kWh of gross calorific value (Hs, as tariffs are); its CO₂
 *  factor is per kWh of net calorific value (Hi), so the two are linked by
 *  the Hs/Hi ratio (VDI 4646 eq. 23). Every value, formula and check is
 *  documented in economic_calculation/economic_analysis_rationale.md. */

export interface EconInputs {
  hours: number; // full-load hours per year
  eta: number; // efficiency of the reference heater on Hs, 0..1
  hsHi: number; // ratio gross / net calorific value of the fuel (gas 1,11)
  pFuel: number; // €/kWh_Hs, base year, excluding CO₂
  rFuel: number; // price change rate per year, 0.03 = 3 %
  co2Fuel: number; // t CO₂ per MWh of fuel on Hi
  co2Priced: boolean; // false where the CO₂ cost is already in the price (electric heater)
  co2Price: number; // €/t, base year
  rCo2: number;
  pEl: number; // €/kWh, base year
  rEl: number;
  co2El: number; // t CO₂ per MWh of grid electricity
  co2ElPriced: boolean; // CO₂ cost added on electricity too (not already in its price)
  i: number; // Kalkulationszins
  T: number; // Betrachtungszeitraum, years
  fMaint: number; // maintenance per year (f_Inst + f_W+Insp) as share of the investment
  opHours: number; // hours of operation (Bedienen) per year …
  wage: number; // … at this hourly rate, €/h
  funding: number; // Förderquote, share of the investment
  pDemand: number; // Leistungspreis, € per kW electrical per year
  coolShare: number; // share of the source heat that is actively cooled today, 0..1
  eer: number; // efficiency of that cooling (kW cold per kW electrical)
  reinvestShare: number; // extra reinvestment as share of the investment …
  reinvestYear: number; // … in this year of operation
  life: number; // service life (TN), years: replacements and residual value, 0 = none
  rInv: number; // price change rate of the investment (replacements)
  boilerInvest: number; // € per kW of heat pump output: boiler investment avoided (replacement case)
  fMaintRef: number; // maintenance of that avoided boiler, share per year
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
  fuel: number; // kWh_Hs/a still burnt in the old heater
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
  payback: number | null; // dynamic: years until the Kapitalwert turns positive
  paybackStatic: number | null; // static: net investment / saving in year 1 (VDI 4646 C5)
  irr: number | null; // internal rate of return over T (VDI 4646 C6)
  lcohHp: number; // €/kWh of heat from the heat pump, annuity method (VDI 4646 eq. 21)
  lcohRef: number; // €/kWh of heat from the reference heater
  alpha: number; // Finnish allocation factor of the heat pump's electricity to heating
  cumCost: number; // nominal operating costs over T, undiscounted
}

/** Payback is searched past T up to this horizon ("nach 2067" on the slides). */
export const PAYBACK_HORIZON = 40;

/** Annuity factor a = (q − 1) / (1 − q^−T), VDI 2067 eq. (4). */
export const annuityFactor = (i: number, T: number) =>
  Math.abs(i) < 1e-12 ? 1 / T : i / (1 - (1 + i) ** -T);

const co2At = (inp: EconInputs, t: number) => inp.co2Price * (1 + inp.rCo2) ** t;

/** Fuel price incl. CO₂ cost in year t, € per kWh_Hs. The CO₂ factor is per
 *  kWh_Hi, so per kWh_Hs it is divided by Hs/Hi. */
export function fuelPrice(inp: EconInputs, t: number) {
  const co2 = inp.co2Priced ? (inp.co2Fuel / inp.hsHi / 1000) * co2At(inp, t) : 0;
  return inp.pFuel * (1 + inp.rFuel) ** t + co2;
}

/** Electricity price in year t, €/kWh, with its CO₂ cost when that is not
 *  already in the price. */
export const elPrice = (inp: EconInputs, t: number) =>
  inp.pEl * (1 + inp.rEl) ** t + (inp.co2ElPriced ? (inp.co2El / 1000) * co2At(inp, t) : 0);

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
  // Heat pump only: maintenance, operation, capacity charge; minus the
  // maintenance of a boiler that no longer has to be bought (replacement case).
  const fixed = v
    ? inp.fMaint * v.capex +
      inp.opHours * inp.wage +
      inp.pDemand * pElKw -
      inp.fMaintRef * inp.boilerInvest * v.Q
    : 0;
  return {
    fuel,
    el,
    elCool,
    co2: ((fuel / inp.hsHi) * inp.co2Fuel + (el + elCool) * inp.co2El) / 1000,
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

/** Replacement purchase in year t (VDI 2067 eq. 2): the machine is bought
 *  again at the end of each service life, at the then-current price. None at
 *  the end of the period itself. */
const replacement = (inp: EconInputs, capex: number, t: number) =>
  inp.life > 0 && t % inp.life === 0 && t !== inp.T ? capex * (1 + inp.rInv) ** t : 0;

/** Residual value after T years (VDI 2067 eq. 3, undiscounted): the last
 *  purchase depreciated linearly over its service life. */
export function residualValue(inp: EconInputs, capex: number) {
  if (inp.life <= 0) return 0;
  const n = Math.ceil(inp.T / inp.life) - 1; // replacements within T
  return (capex * (1 + inp.rInv) ** (n * inp.life) * ((n + 1) * inp.life - inp.T)) / inp.life;
}

/** NPV over T at discount rate i: the heart of evaluate, reused to solve for
 *  the internal rate of return. */
function npvAt(inp: EconInputs, ref: EconReference, v: EconVariant, i: number) {
  const r = flows(inp, ref, null);
  const h = flows(inp, ref, v);
  let npv = -((1 - inp.funding) * v.capex) + inp.boilerInvest * v.Q;
  for (let t = 1; t <= inp.T; t++) {
    const reinvest =
      (t === inp.reinvestYear ? inp.reinvestShare * v.capex : 0) + replacement(inp, v.capex, t);
    npv += (r.cost(t) - h.cost(t) - reinvest) / (1 + i) ** t;
  }
  return npv + residualValue(inp, v.capex) / (1 + i) ** inp.T;
}

/** Internal rate of return: the discount rate at which the NPV over T is 0,
 *  by bisection. null when the NPV has no root in −99 % … 1000 %. */
function internalRate(inp: EconInputs, ref: EconReference, v: EconVariant) {
  let lo = -0.99;
  let hi = 10;
  const fLo = npvAt(inp, ref, v, lo);
  if (fLo * npvAt(inp, ref, v, hi) > 0) return null;
  for (let k = 0; k < 200 && hi - lo > 1e-9; k++) {
    const mid = (lo + hi) / 2;
    if (npvAt(inp, ref, v, mid) * fLo > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Finnish allocation factor (VDI 4646 eq. 17/18): the share of the heat
 *  pump's electricity that is charged to heating when its cold side also
 *  replaces cooling. Only the actively cooled share of the source heat counts
 *  as useful cooling, so with nothing cooled today α = 1. */
export function allocationFactor(inp: EconInputs, cop: number) {
  const heat = cop / inp.eta;
  const cold = inp.eer > 0 ? (inp.coolShare * Math.max(cop - 1, 0)) / inp.eer : 0;
  return heat / (heat + cold);
}

export function evaluate(inp: EconInputs, ref: EconReference, v: EconVariant): EconResult {
  const r = flows(inp, ref, null);
  const h = flows(inp, ref, v);
  // A boiler that no longer has to be bought counts as income at t = 0.
  const netInvest = (1 - inp.funding) * v.capex - inp.boilerInvest * v.Q;
  const rate = (t: number) => (1 + inp.i) ** t;

  const npvCurve = [-netInvest];
  let npv = -netInvest;
  let payback: number | null = npv >= 0 ? 0 : null;
  let cumCost = 0;
  for (let t = 1; t <= Math.max(inp.T, PAYBACK_HORIZON); t++) {
    const cost = h.cost(t);
    const reinvest =
      (t === inp.reinvestYear ? inp.reinvestShare * v.capex : 0) + replacement(inp, v.capex, t);
    npv += (r.cost(t) - cost - reinvest) / rate(t);
    if (payback === null && npv >= 0) payback = t;
    if (t <= inp.T) {
      npvCurve.push(npv);
      cumCost += cost;
    }
  }

  // Counted in the Kapitalwert, not in the payback curve.
  const residual = residualValue(inp, v.capex);
  const npvT = npvCurve[npvCurve.length - 1] + residual / rate(inp.T);
  const saving1 = r.cost(1) - h.cost(1);

  // LCOH (VDI 4646 eq. 21–23): annuity of a heater's costs over the heat it
  // makes. The heat pump: capital (net of funding, with replacements, less
  // residual value) + maintenance and operation + its electricity, of which
  // only the share α is charged to heating. The reference heater: its fuel.
  const a = annuityFactor(inp.i, inp.T);
  const heat = v.Q * inp.hours;
  const alpha = allocationFactor(inp, v.cop);
  let pvHp = (1 - inp.funding) * v.capex - residual / rate(inp.T);
  let pvRef = inp.boilerInvest * v.Q;
  const pElKw = v.cop > 0 ? v.Q / v.cop : 0;
  for (let t = 1; t <= inp.T; t++) {
    const own =
      alpha * h.el * elPrice(inp, t) +
      inp.fMaint * v.capex +
      inp.opHours * inp.wage +
      inp.pDemand * pElKw -
      (t <= inp.opFundingYears ? inp.opFunding * heat : 0);
    pvHp += (own + replacement(inp, v.capex, t)) / rate(t);
    pvRef +=
      ((heat / inp.eta) * fuelPrice(inp, t) + inp.fMaintRef * inp.boilerInvest * v.Q) / rate(t);
  }

  return {
    fuel: h.fuel,
    el: h.el,
    elCool: h.elCool,
    co2: h.co2,
    opex1: h.cost(1),
    energySaving: r.fuel + r.elCool - (h.fuel + h.el + h.elCool),
    saving1,
    co2Saving: r.co2 - h.co2,
    npvCurve,
    residual,
    npv: npvT,
    payback,
    paybackStatic: netInvest <= 0 ? 0 : saving1 > 0 ? netInvest / saving1 : null,
    irr: internalRate(inp, ref, v),
    lcohHp: heat > 0 ? (a * pvHp) / heat : 0,
    lcohRef: heat > 0 ? (a * pvRef) / heat : 0,
    alpha,
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
  const at = (pEl: number) => npvAt({ ...inp, pFuel, pEl }, ref, v, inp.i);
  const npv0 = at(0);
  const slope = at(1) - npv0;
  return slope < 0 ? -npv0 / slope : null;
}

/** VDI 4646 cost function (eq. 25/26, Tabelle 6): specific investment of a
 *  large heat pump incl. planning, installation and integration, €/kW_th.
 *  Shown for reference only; the app's default comes from newer literature. */
export function vdiSpecificCost(Q: number) {
  if (Q <= 0) return 0;
  const [F, E] = Q <= 210 ? [1521, 0.637] : [349.5, 0.912];
  return (F * Q ** E * 1.25 * 1.8) / Q;
}
