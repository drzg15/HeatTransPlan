/** API client for analysis endpoints. */

import client from './client';
import type {
  CopFormulaValidateResult,
  HPIOptimizationRequest,
  HPIOptimizationResult,
  HPIRequest,
  HPIResult,
  PinchRequest,
  PinchResult,
  StatusQuoRequest,
  StatusQuoResult,
  OptimizedIntegrationPoint,
} from '../types/analysis';
import type { EconNumbers } from '../types/economics';

export async function runPinch(req: PinchRequest): Promise<PinchResult> {
  const { data } = await client.post<PinchResult>('/api/analysis/pinch', req);
  return data;
}

export async function runHPI(req: HPIRequest): Promise<HPIResult> {
  const { data } = await client.post<HPIResult>('/api/analysis/hpi', req);
  return data;
}

export async function runHPIOptimization(
  req: HPIOptimizationRequest
): Promise<HPIOptimizationResult> {
  const { data } = await client.post<HPIOptimizationResult>('/api/analysis/hpi-optimization', req);
  return data;
}

/** Check a COP formula and preview its value. Called as the user types, so it
 *  deliberately does not touch the optimisation. */
export async function validateCopFormula(
  expression: string,
  T_source = 60,
  T_sink = 110
): Promise<CopFormulaValidateResult> {
  const { data } = await client.post<CopFormulaValidateResult>(
    '/api/analysis/cop-formula/validate',
    { expression, T_source, T_sink }
  );
  return data;
}

/** The economic analysis of the pump picked (or the default one). Only the
 *  real machines are sent: the reference size and the size curve come from
 *  them, and the archetypes would only make the request heavier. */
export async function runEconomics(
  form: Record<string, number>,
  refType: string,
  selected: OptimizedIntegrationPoint[],
  opt: HPIOptimizationResult | null | undefined,
  sensBase: { fuel: number; el: number } | null = null
): Promise<EconNumbers | null> {
  const optimization = opt && {
    feasible_points: opt.feasible_points.filter((p) => !p.theoretical),
    max_q_point: opt.max_q_point,
  };
  const { data } = await client.post<EconNumbers | null>('/api/analysis/economics', {
    form,
    ref_type: refType,
    selected_points: selected,
    optimization,
    sens_base: sensBase,
  });
  return data;
}

export async function runStatusQuo(req: StatusQuoRequest): Promise<StatusQuoResult> {
  const { data } = await client.post<StatusQuoResult>('/api/analysis/status-quo', req);
  return data;
}

export async function generateReport(payload: Record<string, unknown>): Promise<Blob> {
  const { data } = await client.post('/api/analysis/report', payload, {
    responseType: 'blob',
  });
  return data as Blob;
}

export async function getMapPreview(
  payload: Record<string, unknown>
): Promise<{ map_b64: string }> {
  const { data } = await client.post<{ map_b64: string }>('/api/analysis/map-preview', payload);
  return data;
}
