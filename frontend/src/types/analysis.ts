/** Analysis types — mirrors backend analysis models. */

// ---------------------------------------------------------------------------
// Pinch Analysis
// ---------------------------------------------------------------------------

export interface PinchStream {
  name: string;
  CP: number;
  T_supply: number;
  T_target: number;
}

export interface PinchRequest {
  streams: PinchStream[];
  T_min: number;
}

export interface CompositeDiagramData {
  hot: { H: number[]; T: number[] };
  cold: { H: number[]; T: number[] };
}

export interface PinchResult {
  pinch_temperature: number;
  hot_utility: number;
  cold_utility: number;
  T_min: number;
  temperatures: number[];
  problem_table: Record<string, number>[];
  heat_cascade: Record<string, number>[];
  unfeasible_heat_cascade: Record<string, number>[];
  shifted_composite_diagram: CompositeDiagramData;
  composite_diagram: CompositeDiagramData;
  grand_composite_curve: { H: number[]; T: number[] };
  streams_data: Array<{
    type: string;
    cp: number;
    ts: number;
    tt: number;
    ss?: number;
    st?: number;
  }>;
}

// ---------------------------------------------------------------------------
// Heat Pump Integration
// ---------------------------------------------------------------------------

export interface HeatPumpEntry {
  name: string;
  cop?: number | null;
  t_source?: number | null;
  t_sink?: number | null;
  q_source?: number | null;
  q_sink?: number | null;
  coverage?: number | null;
  available: boolean;
  reason?: string;
}

export interface HPIntegrationResult {
  hp_type: string;
  COP?: number | null;
  Q_ko?: number | null;
  Q_ev?: number | null;
  T_source?: number | null;
  T_sink?: number | null;
  delta_T?: number | null;
  feasible: boolean;
  source_points: { H: number[]; T: number[] };
  sink_points: { H: number[]; T: number[] };
}

/**
 * How much internal heat recovery is credited before the heat pump is placed.
 *   net_load    pocket-free GCC split into source/sink (full recovery, default)
 *   composite   hot/cold composite curves, no recovery at all
 */
export type ProfileMode = 'net_load' | 'composite';

export interface HPIRequest {
  pinch_result: PinchResult;
  hp_types: string[];
  profile_mode?: ProfileMode;
}

export interface HPIResult {
  integrations: HPIntegrationResult[];
  heat_pumps: HeatPumpEntry[];
  excluded_heat_pumps: HeatPumpEntry[];
  gcc_data: { H: number[]; T: number[] };
  profile_mode: ProfileMode;
  source_profile: { H: number[]; T: number[] };
  sink_profile: { H: number[]; T: number[] };
}

// ---------------------------------------------------------------------------
// Status Quo Comparison
// ---------------------------------------------------------------------------

export interface EnergyDemandInput {
  stream_name: string;
  heating_kW: number;
  cooling_kW: number;
}

export interface StatusQuoRequest {
  current_demands: EnergyDemandInput[];
  pinch_hot_utility: number;
  pinch_cold_utility: number;
}

export interface StatusQuoResult {
  total_current_heating: number;
  total_current_cooling: number;
  pinch_hot_utility: number;
  pinch_cold_utility: number;
  heating_savings_kW: number;
  cooling_savings_kW: number;
  heating_savings_pct: number;
  cooling_savings_pct: number;
}

// ---------------------------------------------------------------------------
// HPI Optimization
// ---------------------------------------------------------------------------

export interface OptimizedIntegrationPoint {
  T_source: number;
  T_sink: number;
  Q_source: number;
  /** Duty actually delivered — capped by the available source heat when source_limited. */
  Q_demand: number;
  COP: number;
  refrigerant: string;
  medium_sink: string;
  refrigerant_type: string;
  hp_level: string;
  /** Full sink requirement above T_sink, i.e. what an unlimited source would allow. */
  Q_demand_total?: number | null;
  /** True when the available waste heat covers only part of Q_demand_total. */
  source_limited?: boolean;
  /** True when the sink demand caps the duty while source heat is still available,
   *  putting the point off the source profile. */
  demand_limited?: boolean;
}

/** Why the optimization found little or nothing. */
export interface HPIOptimizationDiagnostics {
  source_T_min?: number | null;
  source_T_max?: number | null;
  source_Q_max?: number | null;
  sink_T_min?: number | null;
  sink_T_max?: number | null;
  sink_Q_max?: number | null;
  model_T_source_min?: number | null;
  model_T_sink_min?: number | null;
  candidates_total: number;
  rejected_sink_range: number;
  rejected_source_range: number;
  rejected_no_demand: number;
  rejected_no_source_heat: number;
  accepted_full: number;
  accepted_source_limited: number;
  accepted_demand_limited?: number;
  messages: string[];
}

/** A COP correlation typed in by the user, evaluated safely on the backend. */
export interface CopFormulaSpec {
  name: string;
  expression: string;
  enabled: boolean;
  /** Validity envelope — outside it the pump is simply not offered. */
  T_source_min: number;
  T_source_max: number;
  T_sink_min: number;
  T_sink_max: number;
  cop_min: number;
  cop_max: number;
  medium_sink: string;
  hp_level: string;
}

export interface CopFormulaValidateResult {
  valid: boolean;
  cop?: number | null;
  error?: string | null;
  variables: Record<string, string>;
  functions: string[];
}

export interface HPIOptimizationRequest {
  pinch_result: PinchResult;
  profile_mode?: ProfileMode;
  cop_formula?: CopFormulaSpec | null;
}

export interface HPIOptimizationResult {
  feasible_points: OptimizedIntegrationPoint[];
  max_q_point: OptimizedIntegrationPoint | null;
  original_gcc: { H: number[]; T: number[] };
  /** Source/sink profiles the optimization ran on, for the selected profile_mode. */
  pocketless_source: { H: number[]; T: number[] };
  pocketless_sink: { H: number[]; T: number[] };
  profile_mode: ProfileMode;
  diagnostics?: HPIOptimizationDiagnostics;
}

// ---------------------------------------------------------------------------
// Local UI types (frontend-only)
// ---------------------------------------------------------------------------

export interface EnergyDemandLocal {
  heat_demand: number;
  cooling_demand: number;
  selected_heat_streams: string[];
  selected_cooling_streams: string[];
}

export interface StreamInfo {
  tin: number | null;
  tout: number | null;
  mdot: number | null;
  cp: number | null;
  CP: number | null;
  Q: number | null;
  type: 'Hot stream (Heat Source)' | 'Cold stream (Heat sink)' | null;
}
