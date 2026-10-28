/** The economic analysis as the backend computes it (POST /analysis/economics). */

import type { OptimizedIntegrationPoint } from './analysis';

export interface EconInputs {
  hours: number;
  eta: number;
  hsHi: number;
  pFuel: number;
  rFuel: number;
  co2Fuel: number;
  co2Priced: boolean;
  co2Price: number;
  rCo2: number;
  pEl: number;
  rEl: number;
  co2El: number;
  co2ElPriced: boolean;
  i: number;
  T: number;
  fMaint: number;
  opHours: number;
  wage: number;
  funding: number;
  pDemand: number;
  coolShare: number;
  eer: number;
  reinvestShare: number;
  reinvestYear: number;
  life: number;
  rInv: number;
  boilerInvest: number;
  fMaintRef: number;
  opFunding: number;
  opFundingYears: number;
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
  paybackStatic: number | null; // static: net investment / saving in year 1
  irr: number | null; // internal rate of return over T
  lcohHp: number; // €/kWh of heat from the heat pump
  lcohRef: number; // €/kWh of heat from the reference heater
  alpha: number; // Finnish allocation factor
  cumCost: number; // nominal operating costs over T, undiscounted
}

export interface EconSize {
  point: OptimizedIntegrationPoint;
  npv: number;
}

export interface EconNumbers {
  pump: OptimizedIntegrationPoint;
  points: OptimizedIntegrationPoint[];
  inputs: EconInputs;
  refSys: { Q: number; Qsrc: number };
  ref: { fuel: number; elCool: number; co2: number; opex1: number; cumCost: number };
  specTotal: number;
  variants: Array<{ Q: number; Qsrc: number; cop: number; capex: number }>;
  results: EconResult[];
  breakEven: Array<number | null>;
  vdiSpecificCost: number[];
  prices: { fuel: number[]; el: number[] };
  horizon: number;
  sensitivity: {
    gasStep: number;
    gasCt: number[];
    elStep: number;
    elCt: number[];
    z: number[][];
    beX: number[];
    beY: Array<number | null>;
  };
  size: { sizes: EconSize[]; optimum: EconSize | null };
  npv: { runs: number[][]; crossings: Array<number | null>; kMax: number };
}
