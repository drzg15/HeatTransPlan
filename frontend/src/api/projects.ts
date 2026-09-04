import client from './client';
import type { ProjectState } from '../types/project';

export async function listProjects(): Promise<Record<string, string>> {
  const res = await client.get('/api/projects');
  return res.data;
}

export async function createProject(
  state?: ProjectState
): Promise<{ project_id: string; state: ProjectState }> {
  const res = await client.post('/api/projects', state ?? null);
  return res.data;
}

export async function getProject(projectId: string): Promise<ProjectState> {
  const res = await client.get(`/api/projects/${projectId}`);
  return res.data;
}

export async function updateProject(projectId: string, state: ProjectState): Promise<ProjectState> {
  const res = await client.put(`/api/projects/${projectId}`, state);
  return res.data;
}

export async function deleteProject(projectId: string): Promise<void> {
  await client.delete(`/api/projects/${projectId}`);
}
