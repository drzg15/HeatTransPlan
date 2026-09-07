import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProcessNode } from '../../types/process';
import { extractStreamInfo } from '../../utils/streamInfo';
import {
  exportProjectToCsv,
  exportDistanceMatrixToCsv,
  exportLiveMapSnapshot,
} from '../../utils/csvExport';
import { useAnalysisStore } from '../../store/analysisStore';

interface Props {
  processes: ProcessNode[];
  groups: number[][];
  groupNames: string[];
  groupCoordinates?: Record<string, { lat?: any; lon?: any; hours?: any }>;
}

type SortKey =
  | 'group'
  | 'subprocess'
  | 'streamName'
  | 'type'
  | 'tin'
  | 'tout'
  | 'mdot'
  | 'cp'
  | 'CP'
  | 'Q'
  | 'lat'
  | 'lon'
  | 'hours'
  | 'water_in'
  | 'water_out'
  | 'density'
  | 'pressure'
  | 'notes';

export default function StreamDataTable({
  processes,
  groups = [],
  groupNames = [],
  groupCoordinates = {},
}: Props) {
  const { t } = useTranslation();
  const tMin = useAnalysisStore((s) => s.tMin);
  const [sortKey, setSortKey] = useState<SortKey>('Q');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Flatten streams
  const allRows = useMemo(() => {
    const res: any[] = [];
    groups.forEach((subIdxs, gIdx) => {
      const gName = groupNames[gIdx] || `Process ${gIdx + 1}`;
      const gCoord = groupCoordinates[gIdx] || {};
      subIdxs.forEach((si) => {
        const sub = processes[si];
        if (!sub) return;
        const baseInfo = {
          group: gName,
          subprocess: sub.name,
          lat: sub.lat || gCoord.lat || '',
          lon: sub.lon || gCoord.lon || '',
          hours: sub.hours || gCoord.hours || '',
          water_in: sub.extra_info?.water_content_in || '',
          water_out: sub.extra_info?.water_content_out || '',
          density: sub.extra_info?.density || '',
          pressure: sub.extra_info?.pressure || '',
          notes: sub.extra_info?.notes || '',
        };

        if (
          !(sub.streams || []).length &&
          !(sub.children || []).some((c) => (c.streams || []).length)
        ) {
          res.push({
            ...baseInfo,
            streamName: '',
            type: '',
            tin: null,
            tout: null,
            mdot: null,
            cp: null,
            CP: null,
            Q: null,
          });
        }

        (sub.streams || []).forEach((s) => {
          const si = extractStreamInfo(s as any);
          res.push({
            ...baseInfo,
            ...si,
            streamName: s.name,
            // Prioritize stream-specific metadata if extracted
            water_in: si.water_in || baseInfo.water_in,
            water_out: si.water_out || baseInfo.water_out,
            density: si.density || baseInfo.density,
            pressure: si.pressure || baseInfo.pressure,
          });
        });
        (sub.children || []).forEach((child) => {
          const childBase = {
            group: gName,
            subprocess: `${sub.name} › ${child.name}`,
            lat: child.lat || sub.lat || gCoord.lat || '',
            lon: child.lon || sub.lon || gCoord.lon || '',
            hours: child.hours || sub.hours || gCoord.hours || '',
            water_in: child.extra_info?.water_content_in || sub.extra_info?.water_content_in || '',
            water_out:
              child.extra_info?.water_content_out || sub.extra_info?.water_content_out || '',
            density: child.extra_info?.density || sub.extra_info?.density || '',
            pressure: child.extra_info?.pressure || sub.extra_info?.pressure || '',
            notes: child.extra_info?.notes || sub.extra_info?.notes || '',
          };
          (child.streams || []).forEach((s) => {
            const si = extractStreamInfo(s as any);
            res.push({
              ...childBase,
              ...si,
              streamName: s.name,
              water_in: si.water_in || childBase.water_in,
              water_out: si.water_out || childBase.water_out,
              density: si.density || childBase.density,
              pressure: si.pressure || childBase.pressure,
            });
          });
        });
      });
    });
    return res;
  }, [processes, groups, groupNames, groupCoordinates]);

  const sortedRows = useMemo(() => {
    return [...allRows].sort((a, b) => {
      const vA = a[sortKey];
      const vB = b[sortKey];
      if (vA === vB) return 0;
      if (vA == null) return 1;
      if (vB == null) return -1;
      let res = vA < vB ? -1 : 1;
      return sortDir === 'asc' ? res : -res;
    });
  }, [allRows, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const cellStyle: React.CSSProperties = {
    padding: '4px 8px',
    fontSize: '11.5px',
    verticalAlign: 'middle',
    color: 'var(--text-main)',
    lineHeight: '1.2',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '200px',
  };
  const headStyle = (key: SortKey): React.CSSProperties => ({
    padding: '6px 8px',
    fontSize: '10.5px',
    fontWeight: 700,
    textTransform: 'uppercase',
    textAlign: 'left',
    background: 'var(--surface)',
    color: sortKey === key ? 'var(--primary)' : 'var(--text-muted)',
    cursor: 'pointer',
    borderBottom: '2px solid var(--border)',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  });

  return (
    <div
      className="stream-data-table card mt-md"
      style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '500px' }}
    >
      <div
        className="flex justify-between items-center"
        style={{ padding: '10px 12px 6px', flexShrink: 0 }}
      >
        <h4
          style={{
            fontSize: '11px',
            margin: 0,
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          {t('stream_table.title')}{' '}
          <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: 8 }}>
            {t('stream_table.sort_hint')}
          </span>
        </h4>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="btn btn-sm btn-primary"
            onClick={() =>
              exportProjectToCsv({
                processes,
                proc_groups: groups,
                proc_group_names: groupNames,
                proc_group_coordinates: groupCoordinates as any,
              } as any)
            }
            style={{ fontSize: '10px', padding: '2px 8px' }}
          >
            {t('stream_table.export_csv')}
          </button>
          <div
            style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 4px' }}
          />
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-sm btn-primary"
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                background: 'var(--surface)',
                color: 'var(--text-main)',
                border: '1px solid var(--border)',
              }}
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
            >
              {t('stream_table.further_exports')}
            </button>
            {exportMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  zIndex: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: '180px',
                }}
              >
                <button
                  style={{
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    color: 'var(--text-main)',
                    padding: '6px 12px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => {
                    setExportMenuOpen(false);
                    exportDistanceMatrixToCsv(
                      {
                        processes,
                        proc_groups: groups,
                        proc_group_names: groupNames,
                        proc_group_coordinates: groupCoordinates as any,
                      } as any,
                      'manhattan'
                    );
                  }}
                >
                  {t('stream_table.export_manhattan')}
                </button>
                <button
                  style={{
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    color: 'var(--text-main)',
                    padding: '6px 12px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => {
                    setExportMenuOpen(false);
                    exportDistanceMatrixToCsv(
                      {
                        processes,
                        proc_groups: groups,
                        proc_group_names: groupNames,
                        proc_group_coordinates: groupCoordinates as any,
                      } as any,
                      'euclidean'
                    );
                  }}
                >
                  {t('stream_table.export_euclidean')}
                </button>
                <button
                  style={{
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    color: 'var(--text-main)',
                    padding: '6px 12px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    borderTop: '1px solid var(--border)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => {
                    setExportMenuOpen(false);
                    exportLiveMapSnapshot();
                  }}
                >
                  {t('stream_table.export_map_pic')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', borderTop: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
          <thead
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 1,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            {/* Top level grouped headers */}
            <tr>
              <th colSpan={4} style={{ ...headStyle('' as SortKey), textAlign: 'center', borderRight: '1px solid var(--border)' }}>
                Process & Stream Info
              </th>
              <th colSpan={2} style={{ ...headStyle('' as SortKey), textAlign: 'center', background: 'var(--surface-hover)', borderRight: '1px solid var(--border)' }}>
                Actual Temp. [°C]
              </th>
              <th colSpan={2} style={{ ...headStyle('' as SortKey), textAlign: 'center', background: 'var(--surface-hover)', borderRight: '1px solid var(--border)' }}>
                Shifted Temp. (±{tMin/2}K) [°C]
              </th>
              <th colSpan={10} style={{ ...headStyle('' as SortKey), textAlign: 'center' }}>
                Thermal & Physical Data
              </th>
            </tr>
            {/* Sub-headers for sorting */}
            <tr>
              {[
                { k: 'group', l: t('stream_table.headers.process') },
                { k: 'subprocess', l: t('stream_table.headers.subprocess') },
                { k: 'streamName', l: t('stream_table.headers.stream') },
                { k: 'type', l: t('stream_table.headers.type') },
                { k: 'tin', l: 'Tin' },
                { k: 'tout', l: 'Tout' },
                { k: 'tin_shifted', l: 'T*in' },
                { k: 'tout_shifted', l: 'T*out' },
                { k: 'mdot', l: 'ṁ [kg/s]' },
                { k: 'cp', l: 'cp [kJ/(kg·K)]' },
                { k: 'CP', l: 'CP [kW/K]' },
                { k: 'Q', l: 'Q [kW]' },
                { k: 'lat', l: 'Lat' },
                { k: 'lon', l: 'Lon' },
                { k: 'hours', l: t('stream_table.headers.hours') },
                { k: 'water_in', l: t('stream_table.headers.water_in') },
                { k: 'water_out', l: t('stream_table.headers.water_out') },
                { k: 'density', l: t('stream_table.headers.density') },
                { k: 'pressure', l: t('stream_table.headers.pressure') },
                { k: 'notes', l: t('stream_table.headers.notes') },
              ].map((h) => (
                <th
                  key={h.k}
                  style={headStyle(h.k as SortKey)}
                  onClick={() => h.k && !h.k.includes('shifted') && toggleSort(h.k as SortKey)}
                >
                  {h.l} {sortKey === h.k ? (sortDir === 'asc' ? '▴' : '▾') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={18}
                  style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}
                >
                  {t('stream_table.no_data')}
                </td>
              </tr>
            ) : (
              sortedRows.map((r, i) => (
                <tr
                  key={i}
                  style={{ background: i % 2 === 0 ? 'transparent' : 'var(--surface-hover)' }}
                >
                  <td style={cellStyle} title={r.group}>
                    {r.group}
                  </td>
                  <td style={cellStyle} title={r.subprocess}>
                    {r.subprocess}
                  </td>
                  <td style={cellStyle} title={r.streamName}>
                    {r.streamName}
                  </td>
                  <td style={cellStyle}>{r.type}</td>
                  <td style={cellStyle}>{r.tin?.toFixed(1) ?? '—'}</td>
                  <td style={{ ...cellStyle, borderRight: '1px solid var(--border)' }}>{r.tout?.toFixed(1) ?? '—'}</td>
                  <td style={{ ...cellStyle, color: 'var(--text-muted)' }}>
                    {r.tin != null ? (r.tin + (r.type === 'Hot' ? -tMin/2 : tMin/2)).toFixed(1) : '—'}
                  </td>
                  <td style={{ ...cellStyle, color: 'var(--text-muted)', borderRight: '1px solid var(--border)' }}>
                    {r.tout != null ? (r.tout + (r.type === 'Hot' ? -tMin/2 : tMin/2)).toFixed(1) : '—'}
                  </td>
                  <td style={cellStyle}>{r.mdot?.toFixed(2) ?? '—'}</td>
                  <td style={cellStyle}>{r.cp?.toFixed(2) ?? '—'}</td>
                  <td style={cellStyle}>{r.CP?.toFixed(2) ?? '—'}</td>
                  <td style={{ ...cellStyle, fontWeight: 700, color: 'var(--primary)' }}>
                    {r.Q?.toFixed(1) ?? '—'}
                  </td>
                  <td style={cellStyle}>{typeof r.lat === 'number' ? r.lat.toFixed(6) : r.lat}</td>
                  <td style={cellStyle}>{typeof r.lon === 'number' ? r.lon.toFixed(6) : r.lon}</td>
                  <td style={cellStyle}>{r.hours}</td>
                  <td style={cellStyle}>{r.water_in}</td>
                  <td style={cellStyle}>{r.water_out}</td>
                  <td style={cellStyle}>{r.density}</td>
                  <td style={cellStyle}>{r.pressure}</td>
                  <td
                    style={{ ...cellStyle, fontStyle: 'italic', fontSize: '10.5px' }}
                    title={r.notes}
                  >
                    {r.notes}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

