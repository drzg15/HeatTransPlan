/** The COP training module (backend app/services/cop_training). */

export type CopRole =
  | 'T_source_out'
  | 'T_sink_out'
  | 'COP'
  | 'T_source_in'
  | 'T_sink_in'
  | 'medium'
  | 'refrigerant'
  | 'stages';

export type ModelKind = 'nn' | 'poly' | 'linear';

export type ColumnMapping = Partial<Record<CopRole, string | null>>;

/** A trained network as plain numbers; sent with the optimization request. */
export interface CustomCopModelSpec {
  name: string;
  enabled: boolean;
  kind: ModelKind;
  temps: string[];
  cats: string[];
  mean: number[];
  scale: number[];
  categories: Record<string, string[]>;
  layers: Array<{ W: number[][]; b: number[] }>;
  terms?: Array<{ coef: number; powers: Record<string, number> }>;
  offsets?: Record<string, Record<string, number>>;
  // A regression written out; empty for a neural network.
  formula?: string;
  envelope: Record<string, number>;
  // The training data's range; envelope is what the optimization uses.
  data_envelope?: Record<string, number>;
  combos: Array<Record<string, string>>;
  metrics: Record<string, number>;
}

export interface CopInspectResult {
  sheets: string[];
  sheet: string | null;
  columns: string[];
  numeric_columns: string[];
  rows: number;
  max_rows: number;
  min_rows: number;
  preview: Array<Record<string, string>>;
  guess: ColumnMapping;
}

export interface CopTrainResult {
  spec: CustomCopModelSpec;
  rows_used: number;
  rows_dropped: number;
  sampled_from: number | null;
  parity: { actual: number[]; predicted: number[] };
}
