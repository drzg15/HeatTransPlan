import type { extractStreamInfo } from '../../utils/streamInfo';

export interface GroupCoords {
  lat?: string | number | null;
  lon?: string | number | null;
  hours?: string;
  box_scale?: string | number;
}

export type ElementDoubleClick = (
  type: 'group' | 'sub' | 'child' | 'stream',
  id: number,
  subId?: number
) => void;

/** What extractStreamInfo accepts: a stream-shaped record. */
export type StreamLike = Parameters<typeof extractStreamInfo>[0];
