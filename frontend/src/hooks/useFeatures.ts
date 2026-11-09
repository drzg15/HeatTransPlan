/** The optional modules the backend runs (GET /api/features). Asked once;
 *  until the answer arrives, or if it fails, every module counts as off. */

import { useEffect, useState } from 'react';
import client from '../api/client';

export interface Features {
  cop_training: boolean;
  /** AI access: Connect AI and its setup. */
  ai: boolean;
  /** The server wants an API key. */
  api_key: boolean;
}

const OFF: Features = { cop_training: false, ai: false, api_key: false };
let pending: Promise<Features> | null = null;

export function useFeatures(): Features {
  const [features, setFeatures] = useState<Features>(OFF);
  useEffect(() => {
    pending ??= client
      .get<Features>('/api/features')
      .then((r) => ({ ...OFF, ...r.data }))
      .catch(() => OFF);
    let live = true;
    pending.then((f) => live && setFeatures(f));
    return () => {
      live = false;
    };
  }, []);
  return features;
}
