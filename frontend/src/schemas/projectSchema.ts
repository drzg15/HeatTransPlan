import { z } from 'zod';
import type { ProcessNode } from '../types/process';

// --- Stream Schemas ---

export const streamTypeSchema = z.enum(['product', 'steam', 'air', 'water']);

export const streamPropertiesSchema = z.object({
  prop1: z.string().optional(),
  prop2: z.string().optional(),
  prop3: z.string().optional(),
  prop4: z.string().optional(),
});

export const streamValuesSchema = z.object({
  val1: z.string().optional(),
  val2: z.string().optional(),
  val3: z.string().optional(),
  val4: z.string().optional(),
});

export const streamSchema = z.object({
  name: z.string(),
  type: streamTypeSchema,
  properties: streamPropertiesSchema.optional(),
  values: streamValuesSchema.optional(),
  stream_values: z.record(z.string(), z.string()).optional(),
  stream_units: z.record(z.string(), z.string()).optional(),
  display_vars: z.array(z.string()).nullable().optional(),
  mdot: z.string().optional(),
  temp_in: z.string().optional(),
  temp_out: z.string().optional(),
  cp: z.string().optional(),
});

// --- Process Schemas ---

export const extraInfoSchema = z.object({
  air_tin: z.string().optional(),
  air_tout: z.string().optional(),
  air_mdot: z.string().optional(),
  air_cp: z.string().optional(),
  water_content_in: z.string().optional(),
  water_content_out: z.string().optional(),
  density: z.string().optional(),
  pressure: z.string().optional(),
  notes: z.string().optional(),
});

export const processModelSelectionSchema = z.object({
  level1: z.string().nullable().optional(),
  level2: z.string().nullable().optional(),
});

export const processParamsSchema = z.object({
  tin: z.string().optional(),
  tout: z.string().optional(),
  time: z.string().optional(),
  cp: z.string().optional(),
  mass_flow: z.union([z.string(), z.number(), z.null()]).optional(),
  thermal_power: z.union([z.string(), z.number(), z.null()]).optional(),
});

export const processNodeSchema: z.ZodType<ProcessNode, ProcessNode> = z.lazy(() =>
  z.object({
    name: z.string(),
    level: z.number().optional(),
    next: z.string().optional(),
    conntemp: z.string().optional(),
    product_tout: z.string().optional(),
    connm: z.string().optional(),
    conncp: z.string().optional(),
    streams: z.array(streamSchema).optional(),
    children: z.array(processNodeSchema).optional(),
    lat: z.union([z.string(), z.number(), z.null()]).optional(),
    lon: z.union([z.string(), z.number(), z.null()]).optional(),
    box_scale: z.union([z.string(), z.number()]).optional(),
    extra_info: extraInfoSchema.optional(),
    expanded: z.boolean().optional(),
    info_expanded: z.boolean().optional(),
    model: processModelSelectionSchema.optional(),
    params: processParamsSchema.optional(),
    params_requested: z.boolean().optional(),
    hours: z.string().optional(),
  })
);

// --- Project State Schemas ---

export const groupCoordinatesSchema = z.object({
  lat: z.union([z.string(), z.number(), z.null()]).optional(),
  lon: z.union([z.string(), z.number(), z.null()]).optional(),
  box_scale: z.union([z.string(), z.number()]).optional(),
  hours: z.string().optional(),
});

export const projectStateSchema = z.object({
  timestamp: z.string().nullable().optional(),
  map_locked: z.boolean().optional(),
  map_center: z.array(z.number()).optional(),
  map_zoom: z.number().optional(),
  current_base: z.string().optional(),
  processes: z.array(processNodeSchema),
  proc_groups: z.array(z.array(z.number())),
  proc_group_names: z.array(z.string()),
  proc_group_expanded: z.array(z.boolean()).optional(),
  proc_group_coordinates: z.record(z.string(), groupCoordinatesSchema),
  proc_group_info_expanded: z.array(z.boolean()).optional(),
  project_notes: z.string().optional(),
  pinch_notes: z.string().optional(),
  map_snapshots_encoded: z.record(z.string(), z.string()).optional(),
  selected_streams: z.record(z.string(), z.boolean()).optional(),
  energy_demands: z.array(z.any()).optional(),
  t_min: z.number().optional(),
});
