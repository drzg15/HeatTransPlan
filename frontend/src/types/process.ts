/** Process node data model — mirrors backend ProcessNode. */

import type { Stream } from './stream';

export interface ExtraInfo {
  air_tin?: string;
  air_tout?: string;
  air_mdot?: string;
  air_cp?: string;
  water_content_in?: string;
  water_content_out?: string;
  density?: string;
  pressure?: string;
  notes?: string;
}

export interface ProcessModelSelection {
  level1?: string | null;
  level2?: string | null;
}

export interface ProcessParams {
  tin?: string;
  tout?: string;
  time?: string;
  cp?: string;
  mass_flow?: string | number | null;
  thermal_power?: string | number | null;
}

export interface ProcessNode {
  name: string;
  level?: number;
  next?: string;
  conntemp?: string;
  product_tout?: string;
  connm?: string;
  conncp?: string;
  streams?: Stream[];
  children?: ProcessNode[];
  lat?: string | number | null;
  lon?: string | number | null;
  box_scale?: string | number;
  extra_info?: ExtraInfo;
  expanded?: boolean;
  info_expanded?: boolean;
  model?: ProcessModelSelection;
  params?: ProcessParams;
  params_requested?: boolean;
  hours?: string;
}
