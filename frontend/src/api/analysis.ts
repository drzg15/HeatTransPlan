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
} from '../types/analysis';

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
