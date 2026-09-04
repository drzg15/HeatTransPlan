import client from './client';
import type { ProcessNode } from '../types/process';

// Process groups
export async function addGroup(projectId: string, name: string) {
  const res = await client.post(`/api/projects/${projectId}/groups`, { name });
  return res.data;
}

export async function updateGroup(projectId: string, groupIdx: number, name: string) {
  const res = await client.put(`/api/projects/${projectId}/groups/${groupIdx}`, { name });
  return res.data;
}

export async function deleteGroup(projectId: string, groupIdx: number) {
  const res = await client.delete(`/api/projects/${projectId}/groups/${groupIdx}`);
  return res.data;
}

// Subprocesses
export async function addSubprocess(projectId: string, groupIdx: number, node?: ProcessNode) {
  const res = await client.post(
    `/api/projects/${projectId}/groups/${groupIdx}/procs`,
    node ?? null
  );
  return res.data;
}

export async function updateSubprocess(projectId: string, procIdx: number, node: ProcessNode) {
  const res = await client.put(`/api/procs/${projectId}/${procIdx}`, node);
  return res.data;
}

export async function deleteSubprocess(projectId: string, procIdx: number) {
  const res = await client.delete(`/api/procs/${projectId}/${procIdx}`);
  return res.data;
}

// Children
export async function addChild(projectId: string, procIdx: number, node?: ProcessNode) {
  const res = await client.post(`/api/procs/${projectId}/${procIdx}/children`, node ?? null);
  return res.data;
}

export async function deleteChild(projectId: string, procIdx: number, childIdx: number) {
  const res = await client.delete(`/api/procs/${projectId}/${procIdx}/children/${childIdx}`);
  return res.data;
}

// Geocoding
export async function geoSearch(query: string) {
  const res = await client.post('/api/geo/search', { query });
  return res.data.results as Array<{ display_name: string; lat: number; lon: number }>;
}
