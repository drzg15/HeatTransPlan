import client from './client';
import type { Stream } from '../types/stream';

export async function addStream(projectId: string, procIdx: number, stream?: Stream) {
  const res = await client.post(`/api/procs/${projectId}/${procIdx}/streams`, stream ?? null);
  return res.data;
}

export async function updateStream(
  projectId: string,
  procIdx: number,
  streamIdx: number,
  stream: Stream
) {
  const res = await client.put(`/api/streams/${projectId}/${procIdx}/${streamIdx}`, stream);
  return res.data;
}

export async function deleteStream(projectId: string, procIdx: number, streamIdx: number) {
  const res = await client.delete(`/api/streams/${projectId}/${procIdx}/${streamIdx}`);
  return res.data;
}

export async function addChildStream(
  projectId: string,
  procIdx: number,
  childIdx: number,
  stream?: Stream
) {
  const res = await client.post(
    `/api/procs/${projectId}/${procIdx}/children/${childIdx}/streams`,
    stream ?? null
  );
  return res.data;
}
