/** Stream data model — mirrors backend StreamModel. */

export type StreamType = 'product' | 'steam' | 'air' | 'water';

export interface StreamProperties {
  prop1?: string;
  prop2?: string;
  prop3?: string;
  prop4?: string;
}

export interface StreamValues {
  val1?: string;
  val2?: string;
  val3?: string;
  val4?: string;
}

export interface Stream {
  name: string;
  type: StreamType;
  properties?: StreamProperties;
  values?: StreamValues;
  stream_values?: Record<string, string>;
  stream_units?: Record<string, string>;
  display_vars?: string[] | null;
  mdot?: string;
  temp_in?: string;
  temp_out?: string;
  cp?: string;
}
