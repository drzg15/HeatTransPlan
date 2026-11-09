/** Inputs of the economic analysis: defaults, presets, the input form's
 *  fields, and which results go where. */

import type { OptimizedIntegrationPoint } from '../../types/analysis';

// Display units: prices in ct/kWh, rates and shares in %.
// Defaults follow VDI 4646 (2026) and VDI 2067 Blatt 1 (2012), except the
// specific investment of the heat pump. Each value, its source page and why
// it may differ: data/economic_calculation/economic_analysis_rationale.md.
export const DEFAULTS = {
  year: new Date().getFullYear() + 1,
  hours: 6000, // VDI 4646 Tabelle 8: three-shift operation
  i: 8, // VDI 4646 p. 58: companies use 8–12 %; user decision 2026-11-09
  T: 20, // VDI 4646 p. 58 / VDI 2067 Tabelle 1: heating 20 years
  // Reference heater (gas condensing boiler, VDI 4646 Tabelle 8: η = 0,87 on
  // Hs). The fuel price is per kWh Hs and excludes CO₂, which is costed on Hi.
  eta: 87,
  hsHi: 1.11, // natural gas H: Hs/Hi ≈ 1,11
  pFuel: 6,
  // ⚠ Not VDI 4646 (p. 57: constant prices): 3 %/a, user decision 2026-10-27.
  rFuel: 3,
  co2Fuel: 0.201, // t/MWh on Hi (UBA); VDI 4646 p. 64 uses 202 g/kWh
  co2Price: 55, // BEHG fixed price 2025
  rCo2: 0,
  boilerInvest: 0, // efficiency case: the boiler exists (VDI 4646 Tabelle 8)
  fMaintRef: 3, // VDI 4646 Tabelle 8: f_k gas boiler 3 %
  // Electricity and heat pump.
  pEl: 13,
  rEl: 3, // ⚠ as rFuel
  co2El: 0.352, // UBA 2025, location-based
  co2ElPriced: 0, // 1 = add CO₂ cost on electricity; VDI: check if in the price
  // CO₂ balance in CO₂-equivalents incl. upstream chain (GEG 2024, Anlage 9)
  // instead of pure CO₂. The CO₂ costs always stay on pure CO₂.
  co2e: 1,
  co2eFuel: 0.24,
  co2eEl: 0.56,
  pDemand: 0, // only if not already in the electricity price
  // Price of the heat pump itself per kW (machine only): SPH offers for large
  // industrial high-temperature heat pumps up to ~150 °C (≈ 1.000–1.200 €/kW);
  // 175 °C steam ≈ 2.000 €/kW. See data/economic_calculation rationale D1.
  specCost: 1000,
  fPI: 1.25, // VDI 4646 Tabelle 6, p. 59: planning and installation
  // System integration (periphery). VDI 4646 Tabelle 6 (p. 59) has 1,8, fitted to
  // cheap machines; 1,35 (user decision 2026-11-09): with a 1.000 €/kW machine
  // ≈ 1.690 €/kW installed. Rationale D1.
  fPer: 1.35,
  fMaint: 2.5, // VDI 2067 Tabelle A2: f_Inst 1 % + f_W+Insp 1,5 %
  opHours: 5, // VDI 2067 Tabelle A2: 5 h/a operation
  wage: 100, // €/h; VDI 4646 and VDI 2067 give no value
  reinvestShare: 0,
  reinvestYear: 10,
  life: 20, // VDI 2067 Tabelle A2: water/water heat pump 20 years
  rInv: 0, // constant prices, as the energy prices
  funding: 0,
  // Operating funding (e.g. BEW Modul 4): none by default.
  opFunding: 0,
  opFundingYears: 10,
  // Cooling the pump takes over. 0 % = the source is not actively cooled today
  // (e.g. exhaust air going up the stack), so there is nothing to save.
  coolShare: 0,
  eer: 4,
};
export type Form = typeof DEFAULTS;

// Reference heaters: picking one loads its efficiency, price and CO₂ factor,
// all editable afterwards. The electric boiler's CO₂ is in its electricity
// price, so no CO₂ cost is added on top.
export type RefType = 'gas' | 'oil' | 'eboiler';
// Efficiencies and prices on Hs, CO₂ factors on Hi (see the rationale file).
export const PRESETS: Record<RefType, Pick<Form, 'eta' | 'hsHi' | 'pFuel' | 'co2Fuel' | 'co2eFuel'>> = {
  gas: { eta: 87, hsHi: 1.11, pFuel: 6, co2Fuel: 0.201, co2eFuel: 0.24 },
  oil: { eta: 85, hsHi: 1.06, pFuel: 8, co2Fuel: 0.266, co2eFuel: 0.31 },
  eboiler: { eta: 99, hsHi: 1, pFuel: 13, co2Fuel: 0.352, co2eFuel: 0.56 },
};

export type Group =
  'general' | 'reference' | 'electricity' | 'hp' | 'funding' | 'cooling' | 'replace';
export const GROUPS: Group[] = [
  'general',
  'reference',
  'electricity',
  'hp',
  'funding',
  'cooling',
  'replace',
];
// Yes/no inputs, shown as a checkbox and stored as 0 / 1.
export const BOOL_FIELDS: Array<keyof Form> = ['co2ElPriced', 'co2e'];

// Options that are off by default (value 0). A checkbox switches one on, which
// fills in a typical value, taken from its help text; off sets 0 again.
export const SWITCHES: Partial<Record<keyof Form, number>> = {
  pDemand: 100, // industrial capacity charges: often 50–150 €/kW per year
  reinvestShare: 20, // e.g. a compressor overhaul; an assumption, no source
  opFunding: 92, // BEW Modul 4: up to about 92 €/MWh
  coolShare: 100, // a chiller or cooling tower removes all of it today
  boilerInvest: 200, // user decision 2026-11-09; VDI 4646:2026 (p. 74) has 131
};
// Inputs that only count while an option is on: greyed out while it is off.
export const SWITCHED_BY: Partial<Record<keyof Form, keyof Form>> = {
  reinvestYear: 'reinvestShare',
  opFundingYears: 'opFunding',
  eer: 'coolShare',
  fMaintRef: 'boilerInvest',
  co2eFuel: 'co2e',
  co2eEl: 'co2e',
};

export type Range = { step: number; min: number; max: number; open?: boolean };

// Inputs: key, unit, the block it sits in, and the step and range of the −/+
// buttons and slider.
// "open" ranges have no natural upper bound: releasing the slider at its end
// doubles the range, so dragging again goes further. Typed values beyond the
// range stretch it too. Physical limits (efficiency, hours, shares) stay closed.
export const FIELDS: Array<[keyof Form, string, Group, Range]> = [
  ['year', 'a', 'general', { step: 1, min: 2025, max: 2045 }],
  ['hours', 'h/a', 'general', { step: 100, min: 0, max: 8760 }],
  ['i', '%', 'general', { step: 0.5, min: 0, max: 15, open: true }],
  ['T', 'a', 'general', { step: 1, min: 1, max: 40, open: true }],
  ['co2e', '-', 'general', { step: 1, min: 0, max: 1 }],
  ['eta', '%', 'reference', { step: 1, min: 50, max: 100 }],
  ['hsHi', '-', 'reference', { step: 0.01, min: 1, max: 1.2 }],
  ['pFuel', 'ct/kWh', 'reference', { step: 0.5, min: 0, max: 30, open: true }],
  ['rFuel', '%/a', 'reference', { step: 0.5, min: -5, max: 10, open: true }],
  ['co2Fuel', 't/MWh', 'reference', { step: 0.001, min: 0, max: 0.4 }],
  ['co2eFuel', 't/MWh', 'reference', { step: 0.01, min: 0, max: 1 }],
  ['co2Price', '€/t', 'reference', { step: 5, min: 0, max: 300, open: true }],
  ['rCo2', '%/a', 'reference', { step: 0.5, min: -5, max: 15, open: true }],
  ['pEl', 'ct/kWh', 'electricity', { step: 0.5, min: 0, max: 40, open: true }],
  ['rEl', '%/a', 'electricity', { step: 0.5, min: -5, max: 10, open: true }],
  ['co2El', 't/MWh', 'electricity', { step: 0.01, min: 0, max: 1 }],
  ['co2eEl', 't/MWh', 'electricity', { step: 0.01, min: 0, max: 1 }],
  ['co2ElPriced', '-', 'electricity', { step: 1, min: 0, max: 1 }],
  ['pDemand', '€/kW/a', 'hp', { step: 10, min: 0, max: 300, open: true }],
  ['specCost', '€/kW', 'hp', { step: 10, min: 0, max: 2500, open: true }],
  ['fPI', '-', 'hp', { step: 0.05, min: 1, max: 3, open: true }],
  ['fPer', '-', 'hp', { step: 0.05, min: 1, max: 3, open: true }],
  ['fMaint', '%/a', 'hp', { step: 0.5, min: 0, max: 10, open: true }],
  ['opHours', 'h/a', 'hp', { step: 1, min: 0, max: 100, open: true }],
  ['wage', '€/h', 'hp', { step: 5, min: 0, max: 200, open: true }],
  ['reinvestShare', '%', 'hp', { step: 5, min: 0, max: 100 }],
  ['reinvestYear', 'a', 'hp', { step: 1, min: 1, max: 40, open: true }],
  ['life', 'a', 'hp', { step: 1, min: 0, max: 50, open: true }],
  ['rInv', '%/a', 'hp', { step: 0.5, min: -5, max: 10, open: true }],
  ['funding', '%', 'hp', { step: 5, min: 0, max: 100 }],
  ['opFunding', '€/MWh', 'funding', { step: 5, min: 0, max: 100, open: true }],
  ['opFundingYears', 'a', 'funding', { step: 1, min: 0, max: 20, open: true }],
  ['coolShare', '%', 'cooling', { step: 5, min: 0, max: 100 }],
  ['eer', '-', 'cooling', { step: 0.5, min: 1, max: 40, open: true }],
  ['boilerInvest', '€/kW', 'replace', { step: 10, min: 0, max: 500, open: true }],
  ['fMaintRef', '%/a', 'replace', { step: 0.5, min: 0, max: 10, open: true }],
];

export const pointKey = (p: OptimizedIntegrationPoint) =>
  `${p.refrigerant}|${p.T_source}|${p.T_sink}`;
export const pointName = (p: OptimizedIntegrationPoint) =>
  `${p.refrigerant} ${p.T_sink.toFixed(0)} °C`;

// The results shown up front, one line per pump.
export const KPI_ROWS = ['payback', 'npv', 'lcoh_hp', 'co2_saving', 'breakeven'];
// One colour per key result, none of them the pinch cards' red, blue, violet
// or green, so the two rows of cards read as different things.
export const KPI_COLORS: Record<string, string> = {
  lcoh_hp: '#B45309', // amber
  payback: '#0F766E', // teal
  npv: '#A21CAF', // fuchsia
  co2_saving: '#475569', // slate
  breakeven: '#7C2D12', // brown
};

// Which result rows go in which of the two result tables.
export const RESULT_ROWS_ENERGY = [
  'q',
  'qsrc',
  'cop',
  'fuel',
  'el',
  'elCool',
  'energy_saving',
  'co2',
  'co2_saving',
  'alpha',
];
export const RESULT_ROWS_MONEY = [
  'opex1',
  'saving1',
  'payback',
  'payback_static',
  'residual',
  'npv',
  'irr',
  'lcoh_hp',
  'lcoh_ref',
  'breakeven',
  'spec_total',
  'capex_vdi',
];

// Loss / gain, used wherever a value's sign matters.
export const RED = '#C62828';
export const GREEN = '#2E7D32';
// Rows whose cells are coloured by sign.
export const SIGNED_ROWS = new Set(['saving1', 'energy_saving', 'co2_saving', 'npv', 'irr']);
