/**
 * Utility to export the current project state to a CSV file.
 * Synchronized with the StreamDataTable and ActionBar.
 */

import type { ProjectState } from '../types/project';
import html2canvas from 'html2canvas';
import { extractStreamInfo } from './streamInfo';
import { haversineDistance, manhattanSphericalDistance } from './geoUtils';

export function exportProjectToCsv(state: ProjectState) {
  const rows: string[][] = [];
  const header = [
    'Name',
    'Heat Capacity',
    'Mass Flow',
    'CP-Value [kW/K]',
    'Input Temperature [°C]',
    'Output Temperature [°C]',
    'Stream Type',
    'Process',
    'Subprocess',
    'Q (kW)',
    'Lat',
    'Lon',
    'Hours',
    'Water In',
    'Water Out',
    'Density',
    'Pressure',
    'Notes',
  ];
  rows.push(header);

  (state.proc_groups || []).forEach((subIdxs, gIdx) => {
    const gName = state.proc_group_names?.[gIdx] || `Process ${gIdx + 1}`;
    const gCoord = state.proc_group_coordinates?.[gIdx] || {};

    subIdxs.forEach((si) => {
      const sub = state.processes[si];
      if (!sub) return;

      const notes = sub.extra_info?.notes || '';
      const lat = String(sub.lat || gCoord.lat || '');
      const lon = String(sub.lon || gCoord.lon || '');
      const hours = sub.hours || gCoord.hours || '';
      const water_in = sub.extra_info?.water_content_in || '';
      const water_out = sub.extra_info?.water_content_out || '';
      const density = sub.extra_info?.density || '';
      const pressure = sub.extra_info?.pressure || '';

      // Add streams for this subprocess
      if (!sub.streams?.length && !sub.children?.length) {
        rows.push([
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          gName,
          sub.name,
          '',
          lat,
          lon,
          hours,
          water_in,
          water_out,
          density,
          pressure,
          notes,
        ]);
      } else {
        (sub.streams || []).forEach((s) => {
          const si = extractStreamInfo(s as any);
          rows.push([
            s.name,
            String(si.cp ?? ''),
            String(si.mdot ?? ''),
            String(si.CP ?? ''),
            String(si.tin ?? ''),
            String(si.tout ?? ''),
            si.type || '',
            gName,
            sub.name,
            si.Q ? si.Q.toFixed(1) : '',
            lat,
            lon,
            hours,
            String(si.water_in || water_in),
            String(si.water_out || water_out),
            String(si.density || density),
            String(si.pressure || pressure),
            notes,
          ]);
        });

        // Also add streams for sub-subprocesses (children)
        (sub.children || []).forEach((child) => {
          const c_notes = child.extra_info?.notes || notes || '';
          const c_lat = String(child.lat || sub.lat || gCoord.lat || '');
          const c_lon = String(child.lon || sub.lon || gCoord.lon || '');
          const c_hours = child.hours || hours || '';
          const c_water_in = child.extra_info?.water_content_in || water_in || '';
          const c_water_out = child.extra_info?.water_content_out || water_out || '';
          const c_density = child.extra_info?.density || density || '';
          const c_pressure = child.extra_info?.pressure || pressure || '';
          const c_name = `${sub.name} › ${child.name}`;

          if (!(child.streams || []).length) {
            rows.push([
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              gName,
              c_name,
              '',
              c_lat,
              c_lon,
              c_hours,
              c_water_in,
              c_water_out,
              c_density,
              c_pressure,
              c_notes,
            ]);
          } else {
            (child.streams || []).forEach((s) => {
              const si = extractStreamInfo(s as any);
              rows.push([
                s.name,
                String(si.cp ?? ''),
                String(si.mdot ?? ''),
                String(si.CP ?? ''),
                String(si.tin ?? ''),
                String(si.tout ?? ''),
                si.type || '',
                gName,
                c_name,
                si.Q ? si.Q.toFixed(1) : '',
                c_lat,
                c_lon,
                c_hours,
                String(si.water_in || c_water_in),
                String(si.water_out || c_water_out),
                String(si.density || c_density),
                String(si.pressure || c_pressure),
                c_notes,
              ]);
            });
          }
        });
      }
    });
  });

  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `heattransplan_export_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportDistanceMatrixToCsv(state: ProjectState, metric: 'manhattan' | 'euclidean') {
  const nodes: { name: string; lat: number | null; lon: number | null }[] = [];

  (state.proc_groups || []).forEach((subIdxs, gIdx) => {
    const gName = state.proc_group_names?.[gIdx] || `Process ${gIdx + 1}`;
    const gCoord = state.proc_group_coordinates?.[gIdx] || {};

    subIdxs.forEach((si) => {
      const sub = state.processes[si];
      if (!sub) return;

      const lat = Number(sub.lat || gCoord.lat);
      const lon = Number(sub.lon || gCoord.lon);

      nodes.push({
        name: `${gName} › ${sub.name}`,
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null,
      });

      (sub.children || []).forEach((child) => {
        const c_lat = Number(child.lat || sub.lat || gCoord.lat);
        const c_lon = Number(child.lon || sub.lon || gCoord.lon);
        nodes.push({
          name: `${gName} › ${sub.name} › ${child.name}`,
          lat: Number.isFinite(c_lat) ? c_lat : null,
          lon: Number.isFinite(c_lon) ? c_lon : null,
        });
      });
    });
  });

  const rows: string[][] = [];
  const header = ['Process Name', ...nodes.map((n) => n.name)];
  rows.push(header);

  nodes.forEach((rowNode) => {
    const rowData: string[] = [rowNode.name];
    nodes.forEach((colNode) => {
      if (
        rowNode.lat === null ||
        rowNode.lon === null ||
        colNode.lat === null ||
        colNode.lon === null
      ) {
        rowData.push('N/A');
      } else if (rowNode === colNode) {
        rowData.push('0');
      } else {
        const dist =
          metric === 'euclidean'
            ? haversineDistance(rowNode.lat, rowNode.lon, colNode.lat, colNode.lon)
            : manhattanSphericalDistance(rowNode.lat, rowNode.lon, colNode.lat, colNode.lon);
        rowData.push(Math.round(dist).toString());
      }
    });
    rows.push(rowData);
  });

  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `heattransplan_distances_${metric}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportLiveMapSnapshot() {
  const mapEl = document.querySelector('.leaflet-container');
  if (!mapEl) {
    alert('Map not found on screen. Please open the map view first.');
    return;
  }
  try {
    // Fix SVGs missing xmlns for html2canvas
    const svgs = mapEl.querySelectorAll('svg');
    svgs.forEach((svg) => {
      if (!svg.getAttribute('xmlns')) {
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }
    });

    const canvas = await html2canvas(mapEl as HTMLElement, {
      useCORS: true,
      allowTaint: false,
    });
    const imgData = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = imgData;
    a.download = `heattransplan_map_full_${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  } catch (err) {
    console.error('Error capturing map:', err);
    alert('Could not capture map image.');
  }
}
