/** API client for the COP training module. */

import client from './client';
import type {
  ColumnMapping,
  CopInspectResult,
  CopTrainResult,
  ModelKind,
} from '../types/copTraining';

export async function inspectCopData(file: File, sheet?: string): Promise<CopInspectResult> {
  const form = new FormData();
  form.append('file', file);
  if (sheet) form.append('sheet', sheet);
  const { data } = await client.post('/api/analysis/cop-model/inspect', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function trainCopModel(
  file: File,
  mapping: ColumnMapping,
  name: string,
  kind: ModelKind = 'nn',
  degree = 2,
  sheet: string | null = null
): Promise<CopTrainResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('mapping', JSON.stringify(mapping));
  form.append('name', name);
  form.append('model_type', kind);
  form.append('degree', String(degree));
  if (sheet) form.append('sheet', sheet);
  const { data } = await client.post('/api/analysis/cop-model/train', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
