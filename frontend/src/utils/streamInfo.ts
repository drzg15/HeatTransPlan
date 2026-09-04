/**
 * Extract stream info (Tin, Tout, mdot, cp, CP, Q) from a stream object,
 * checking multiple fallback sources in the same order as the original
 * Streamlit app:
 *   1. stream_values / product_values dict
 *   2. properties/values mapping (prop1→val1 …)  
 *   3. top-level temp_in / temp_out / mdot / cp
 * Applies unit conversions if stream_units is present.
 */
export interface StreamInfo {
  tin: number | null;
  tout: number | null;
  mdot: number | null;
  cp: number | null;
  CP: number | null;
  Q: number | null;
  type: 'hot' | 'cold' | null;
  density: string | null;
  pressure: string | null;
  water_in: string | null;
  water_out: string | null;
}

function tryFloat(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export function extractStreamInfo(stream: Record<string, any>): StreamInfo {
  const sv: Record<string, any> = stream.stream_values || stream.product_values || {};
  const properties: Record<string, string> = stream.properties || {};
  const values: Record<string, string> = stream.values || {};
  const units = stream.stream_units || {};

  let tin: number | null = null;
  let tout: number | null = null;
  let mdot: number | null = null;
  let cpVal: number | null = null;
  let cpDirect: number | null = null;

  const convertTemp = (val: number | null, unit: string | undefined): number | null => {
    if (val === null) return null;
    if (unit === '°F') return ((val - 32) * 5) / 9;
    if (unit === 'K') return val - 273.15;
    return val; // default °C
  };

  const convertMdot = (val: number | null, unit: string | undefined): number | null => {
    if (val === null) return null;
    if (unit === 'kg/min') return val / 60;
    if (unit === 'kg/h') return val / 3600;
    if (unit === 't/min') return (val * 1000) / 60;
    if (unit === 't/h') return (val * 1000) / 3600;
    if (unit === 't/d') return (val * 1000) / (24 * 3600);
    return val; // default kg/s
  };

  const convertCp = (val: number | null, unit: string | undefined): number | null => {
    if (val === null) return null;
    if (unit === 'J/(kg·K)') return val / 1000;
    return val; // default kJ/(kg·K)
  };

  const convertCPDirect = (val: number | null, unit: string | undefined): number | null => {
    if (val === null) return null;
    if (unit === 'W/K') return val / 1000;
    return val; // default kW/K
  };

  // 1. stream_values
  if (sv.Tin != null) tin = convertTemp(tryFloat(sv.Tin), units['Tin']);
  if (sv.Tout != null) tout = convertTemp(tryFloat(sv.Tout), units['Tout']);
  if (sv['ṁ'] != null) mdot = convertMdot(tryFloat(sv['ṁ']), units['ṁ']);
  if (sv.cp != null) cpVal = convertCp(tryFloat(sv.cp), units['cp']);
  if (sv.CP != null) cpDirect = convertCPDirect(tryFloat(sv.CP), units['CP']);

  // 2. properties / values mapping (prop1→val1, prop2→val2 …)
  for (const [pk, pname] of Object.entries(properties)) {
    const vk = pk.replace('prop', 'val');
    const v = values[vk];
    if (!v) continue;
    if (pname === 'Tin' && tin == null) tin = convertTemp(tryFloat(v), units['Tin']);
    else if (pname === 'Tout' && tout == null) tout = convertTemp(tryFloat(v), units['Tout']);
    else if (pname === 'ṁ' && mdot == null) mdot = convertMdot(tryFloat(v), units['ṁ']);
    else if (pname === 'cp' && cpVal == null) cpVal = convertCp(tryFloat(v), units['cp']);
    else if (pname === 'CP' && cpDirect == null)
      cpDirect = convertCPDirect(tryFloat(v), units['CP']);
  }

  // 3. top-level fallback
  if (tin == null) tin = convertTemp(tryFloat(stream.temp_in), units['Tin']);
  if (tout == null) tout = convertTemp(tryFloat(stream.temp_out), units['Tout']);
  if (mdot == null) mdot = convertMdot(tryFloat(stream.mdot), units['ṁ']);
  if (cpVal == null) cpVal = convertCp(tryFloat(stream.cp), units['cp']);

  const density = sv.Density || null;
  const pressure = sv.Pressure || null;
  const water_in = sv['Water Content In'] || null;
  const water_out = sv['Water Content Out'] || null;

  // Compute CP (heat capacity flow rate)
  let CP: number | null = cpDirect ?? (mdot != null && cpVal != null ? mdot * cpVal : null);

  // Compute Q
  const Q = CP != null && tin != null && tout != null ? Math.abs(CP * (tout - tin)) : null;

  // Stream type
  const type: 'hot' | 'cold' | null =
    tin != null && tout != null ? (tin > tout ? 'hot' : 'cold') : null;

  return { tin, tout, mdot, cp: cpVal, CP, Q, type, density, pressure, water_in, water_out };
}
