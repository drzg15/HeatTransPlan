import client from './client';
import type { ProjectState } from '../types/project';

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
