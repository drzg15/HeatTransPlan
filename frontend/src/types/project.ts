/** Project state model — mirrors backend ProjectState. */

import type { ProcessNode } from './process';

export interface GroupCoordinates {
  lat?: string | number | null;
  lon?: string | number | null;
  box_scale?: string | number;
  hours?: string;
}

/** The user's own site plan, shown instead of the map: image and where it sits. */
export interface SitePlan {
  url: string;
  bounds: [[number, number], [number, number]];
}

export interface ProjectState {
  timestamp?: string | null;
  map_locked?: boolean;
  map_center?: number[];
  map_zoom?: number;
  current_base?: string;
  processes: ProcessNode[];
  proc_groups: number[][];
  proc_group_names: string[];
  proc_group_expanded?: boolean[];
  proc_group_coordinates: Record<string, GroupCoordinates>;
  proc_group_info_expanded?: boolean[];
  project_notes?: string;
  pinch_notes?: string;
  map_snapshots_encoded?: Record<string, string>;
  site_plan?: SitePlan | null;
  /** Background image of each process diagram, by group index. */
  canvas_plans?: Record<string, string>;
  // Potential Analysis
  selected_streams?: Record<string, boolean>;
  energy_demands?: any[];
  t_min?: number;
}
