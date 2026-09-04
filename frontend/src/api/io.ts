import client from './client';
import type { ProjectState } from '../types/project';

export async function importJsonFile(
  file: File
): Promise<{ project_id: string; state: ProjectState }> {
  const form = new FormData();
  form.append('file', file);
  const res = await client.post('/api/io/import-json', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function importJsonBody(
  state: ProjectState
): Promise<{ project_id: string; state: ProjectState }> {
  const res = await client.post('/api/io/import-json-body', state);
  return res.data;
}

export function exportJsonUrl(projectId: string): string {
  const base = import.meta.env.VITE_API_BASE || '';
  return `${base}/api/io/export-json/${projectId}`;
}

export function exportCsvUrl(projectId: string): string {
  const base = import.meta.env.VITE_API_BASE || '';
  return `${base}/api/io/export-csv/${projectId}`;
}

export function exportReportUrl(projectId: string): string {
  const base = import.meta.env.VITE_API_BASE || '';
  return `${base}/api/io/export-report/${projectId}`;
}

export async function importCsv(projectId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const res = await client.post(`/api/io/import-csv/${projectId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function getProcessModels(): Promise<Record<string, Record<string, string[]>>> {
  const res = await client.get('/api/assets/models');
  return res.data;
}

export async function listExamples(): Promise<string[]> {
  const res = await client.get('/api/assets/examples');
  return res.data.examples;
}

export async function getExample(filename: string): Promise<ProjectState> {
  const res = await client.get(`/api/assets/examples/${filename}`);
  return res.data;
}
