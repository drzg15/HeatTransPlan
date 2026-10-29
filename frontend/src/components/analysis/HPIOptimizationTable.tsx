/** The optimization panel's table: one row per refrigerant type plus the
 *  archetypes, sortable by every column. */

import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { OptimizedIntegrationPoint } from '../../types/analysis';
import ChartHelpButton from '../ui/ChartHelpButton';
import { refBaseName, type SortConfig, type SortKey } from './hpiOptimizationRows';

interface Props {
  rows: OptimizedIntegrationPoint[];
  selectedPoints: OptimizedIntegrationPoint[];
  sortConfigs: SortConfig[];
  onSort: (key: SortKey) => void;
  tMin: number;
  isDark: boolean;
  feasibleCount: number;
  diagnosticMessages: string[];
}

const thStyle = {
  cursor: 'pointer',
  userSelect: 'none' as const,
  position: 'sticky' as const,
  top: 0,
  zIndex: 1,
  // Headers carry a label plus a help bulb plus a sort arrow; letting them
  // wrap is what made rows two lines tall.
  whiteSpace: 'nowrap' as const,
};

// The type cell holds a badge and a technology name side by side, so it needs
// more room than the numeric columns or its content wraps onto a second line.
const typeThStyle = { ...thStyle, minWidth: '190px' };
// Holds only "Natural"/"Synthetic", so it needs far less room than its
// header once implied.
const narrowThStyle = { ...thStyle, width: '1%' };

function SortIcon({ sortConfigs, sortKey }: { sortConfigs: SortConfig[]; sortKey: SortKey }) {
  const idx = sortConfigs.findIndex((c) => c.key === sortKey);
  if (idx === -1) return null;
  const arrow = sortConfigs[idx].direction === 'asc' ? '↑' : '↓';
  return (
    <span
      style={{
        marginLeft: '4px',
        fontSize: idx === 0 ? '1em' : '0.8em',
        opacity: idx === 0 ? 1 : 0.6,
      }}
    >
      {arrow}
      {idx > 0 && <span style={{ fontSize: '0.7em' }}>({idx + 1})</span>}
    </span>
  );
}

/** A clickable column header with its help bulb and, optionally, the arrow
 *  showing where it sits in the sort order. */
function SortableHeader({
  label,
  helpTitle,
  helpText,
  sortKey,
  onSort,
  icon,
  style = thStyle,
}: {
  label: ReactNode;
  helpTitle: string;
  helpText: string;
  sortKey: SortKey;
  onSort: (key: SortKey) => void;
  icon: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <th style={style} onClick={() => onSort(sortKey)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        {label}
        <span onClick={(e) => e.stopPropagation()}>
          <ChartHelpButton title={helpTitle} description={helpText} inline={true} />
        </span>
        {icon}
      </div>
    </th>
  );
}

export default function HPIOptimizationTable({
  rows,
  selectedPoints,
  sortConfigs,
  onSort,
  tMin,
  isDark,
  feasibleCount,
  diagnosticMessages,
}: Props) {
  const { t } = useTranslation();

  // Tints matching the heat pump overlay in the chart, so a column can be read
  // back to the arrow it belongs to. Kept pale: these sit behind black text on
  // alternating row stripes, so anything saturated is hard on the eyes.
  const sinkCell = { backgroundColor: isDark ? 'rgba(59,130,246,0.14)' : 'rgba(143,174,224,0.20)' };
  const sourceCell = {
    backgroundColor: isDark ? 'rgba(248,113,113,0.14)' : 'rgba(232,139,139,0.20)',
  };
  const elCell = { backgroundColor: isDark ? 'rgba(110,231,183,0.13)' : 'rgba(95,174,140,0.18)' };
  // COP belongs to the heat pump itself, so it takes the box's lilac.
  const copCell = {
    backgroundColor: isDark ? 'rgba(167,139,250,0.16)' : 'rgba(124,58,237,0.13)',
    fontWeight: 600,
  };

  // Carnot is not a fitted correlation like the other archetypes — it is the
  // thermodynamic relation between the two temperatures — so it gets its own
  // explanation rather than the "published regressions" one.
  const entryHint = (pt: OptimizedIntegrationPoint) =>
    !pt.theoretical
      ? t('optimization.real_hint')
      : pt.refrigerant === 'Carnot'
        ? t('optimization.carnot_hint')
        : t('optimization.theoretical_hint');

  const icon = (key: SortKey) => <SortIcon sortConfigs={sortConfigs} sortKey={key} />;
  const header = (
    key: SortKey,
    label: ReactNode,
    helpTitle: string,
    helpText: string,
    opts: { style?: CSSProperties; noIcon?: boolean } = {}
  ) => (
    <SortableHeader
      label={label}
      helpTitle={helpTitle}
      helpText={helpText}
      sortKey={key}
      onSort={onSort}
      icon={opts.noIcon ? null : icon(key)}
      style={opts.style}
    />
  );

  return (
    <div className="pa-hp-table-wrap" style={{ maxHeight: '440px', overflowY: 'auto' }}>
      {rows.length > 0 ? (
        <>
          <table className="pa-table pa-hp-table">
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr>
                {header(
                  'theoretical',
                  t('optimization.panel.headers.entry_type'),
                  t('optimization.panel.headers.entry_type'),
                  t('optimization.entry_type_hint'),
                  { style: typeThStyle }
                )}
                {header(
                  'refrigerant_type',
                  t('optimization.panel.headers.refrigerant_type'),
                  t('optimization.title_refrigerant_type'),
                  t('optimization.tooltip_refrigerant_type'),
                  { style: narrowThStyle }
                )}
                {header(
                  'medium_sink',
                  t('optimization.panel.headers.medium_sink'),
                  t('optimization.title_medium_sink'),
                  t('optimization.desc_medium_sink')
                )}
                {header(
                  'COP',
                  <span className="notranslate">{t('optimization.panel.headers.cop')}</span>,
                  t('optimization.title_cop'),
                  t('optimization.tooltip_cop')
                )}
                {header(
                  'Q_demand',
                  t('optimization.panel.headers.q_sink'),
                  t('optimization.title_q_sink'),
                  t('optimization.tooltip_q_sink')
                )}
                {header(
                  'Q_source',
                  t('optimization.panel.headers.q_source'),
                  t('optimization.title_q_source'),
                  t('optimization.tooltip_q_source')
                )}
                {header(
                  'W_el',
                  t('optimization.panel.headers.w_el'),
                  t('optimization.title_w_el'),
                  t('optimization.tooltip_w_el')
                )}
                {header(
                  'T_sink',
                  'Actual Sink Temp [°C]',
                  t('optimization.title_actual_sink_temp'),
                  t('optimization.desc_actual_sink_temp')
                )}
                {header(
                  'T_sink',
                  <>Shifted Sink (T+{tMin / 2}K) [°C]</>,
                  t('optimization.title_shifted_sink_temp'),
                  t('optimization.desc_shifted_sink_temp'),
                  { noIcon: true }
                )}
                {header(
                  'T_source',
                  'Actual Source Temp [°C]',
                  t('optimization.title_actual_source_temp'),
                  t('optimization.desc_actual_source_temp')
                )}
                {header(
                  'T_source',
                  <>Shifted Source (T−{tMin / 2}K) [°C]</>,
                  t('optimization.title_shifted_source_temp'),
                  t('optimization.desc_shifted_source_temp'),
                  { noIcon: true }
                )}
                {header(
                  'refrigerant',
                  t('optimization.panel.headers.refrigerant'),
                  t('optimization.title_refrigerant'),
                  t('optimization.tooltip_refrigerant')
                )}
                {header(
                  'hp_level',
                  t('optimization.panel.headers.hp_stages'),
                  t('optimization.title_hp_stages'),
                  t('optimization.tooltip_hp_stages')
                )}
                <th style={thStyle}>{t('optimization.panel.headers.t_vorlauf_quelle')}</th>
                <th style={thStyle}>{t('optimization.panel.headers.t_ruecklauf_senke')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((pt, i) => {
                const isSelected = selectedPoints.some(
                  (sp) => sp.refrigerant === pt.refrigerant && sp.T_sink === pt.T_sink
                );
                const refName = refBaseName(pt.refrigerant);
                return (
                  <tr
                    key={i}
                    style={isSelected ? { backgroundColor: isDark ? '#334155' : '#E2E8F0' } : {}}
                  >
                    <td>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: pt.theoretical
                              ? isDark
                                ? '#065F46'
                                : '#D1FAE5'
                              : isDark
                                ? '#1E3A8A'
                                : '#DBEAFE',
                            color: pt.theoretical
                              ? isDark
                                ? '#A7F3D0'
                                : '#065F46'
                              : isDark
                                ? '#BFDBFE'
                                : '#1E3A8A',
                          }}
                          title={entryHint(pt)}
                        >
                          {pt.theoretical ? t('optimization.theoretical') : t('optimization.real')}
                        </span>
                        {/* The refrigerant column is blank for archetypes,
                          so the technology name rides here — otherwise
                          Carnot and VHTHP rows look identical. Kept on
                          the same line so every row is one line tall. */}
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: isDark ? '#94A3B8' : '#64748B',
                          }}
                        >
                          {/* The Carnot entry is 50 % of the ceiling, not
                            the ceiling, so it says so on the row. */}
                          {pt.theoretical
                            ? pt.refrigerant === 'Carnot'
                              ? t('optimization.carnot_50')
                              : pt.refrigerant
                            : ''}
                        </span>
                        {pt.calculation_details && (
                          <ChartHelpButton
                            inline
                            title={
                              pt.theoretical
                                ? `${pt.refrigerant} — ${t('optimization.calculation')}`
                                : t('optimization.calculation')
                            }
                            description={
                              <>
                                <p>{entryHint(pt)}</p>
                                <pre
                                  style={{
                                    margin: 0,
                                    whiteSpace: 'pre-wrap',
                                    fontFamily: 'monospace',
                                    fontSize: '0.9em',
                                  }}
                                >
                                  {pt.calculation_details}
                                </pre>
                              </>
                            }
                          />
                        )}
                      </div>
                    </td>
                    {/* Refrigerant type, medium and stage count describe a
                        trained machine; an archetype has none of them. */}
                    <td>{pt.theoretical ? '' : pt.refrigerant_type}</td>
                    <td>{pt.theoretical ? '' : pt.medium_sink}</td>
                    <td style={copCell}>{pt.COP.toFixed(2)}</td>
                    <td
                      style={sinkCell}
                      title={
                        pt.source_limited && pt.Q_demand_total
                          ? t('ui.source_limited', {
                              pct: ((100 * pt.Q_demand) / pt.Q_demand_total).toFixed(0),
                              kw: pt.Q_demand_total.toFixed(1),
                            })
                          : undefined
                      }
                    >
                      {pt.Q_demand.toFixed(1)}
                      {pt.source_limited && pt.Q_demand_total ? (
                        <span
                          style={{
                            color: isDark ? '#FBBF24' : '#B45309',
                            marginLeft: '0.25rem',
                          }}
                        >
                          * / {pt.Q_demand_total.toFixed(1)}
                        </span>
                      ) : null}
                    </td>
                    <td style={sourceCell}>{((pt.Q_demand * (pt.COP - 1)) / pt.COP).toFixed(1)}</td>
                    <td style={elCell}>{(pt.Q_demand / pt.COP).toFixed(1)}</td>
                    <td style={sinkCell}>{(pt.T_sink - tMin / 2).toFixed(1)}</td>
                    <td style={sinkCell}>{pt.T_sink.toFixed(1)}</td>
                    <td style={sourceCell}>{(pt.T_source + tMin / 2).toFixed(1)}</td>
                    <td style={sourceCell}>{pt.T_source.toFixed(1)}</td>
                    <td>{pt.theoretical ? '' : refName}</td>
                    <td>{pt.theoretical ? '' : pt.hp_level}</td>
                    <td style={sourceCell}>{pt.T_vorlauf_quelle?.toFixed(1) ?? '–'}</td>
                    <td style={sinkCell}>{pt.T_ruecklauf_senke?.toFixed(1) ?? '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      ) : (
        <div style={{ marginTop: '1rem', color: isDark ? '#94A3B8' : '#64748B' }}>
          <p>{feasibleCount === 0 ? t('ui.no_hp_possible') : t('ui.no_hp_filters')}</p>
          {feasibleCount === 0 &&
            diagnosticMessages.map((m, i) => (
              <p key={i} style={{ marginTop: '0.5rem' }}>
                {m}
              </p>
            ))}
        </div>
      )}
      {rows.some((p) => p.source_limited) && (
        <p
          style={{
            marginTop: '0.75rem',
            fontSize: '0.85rem',
            color: isDark ? '#FBBF24' : '#B45309',
          }}
        >
          * Source-limited: the available waste heat covers only part of the demand above T_sink.
          The second figure is the full requirement; the rest still has to come from a utility.
        </p>
      )}
      <p
        style={{
          marginTop: '1rem',
          fontSize: '0.85rem',
          color: isDark ? '#94A3B8' : '#64748B',
        }}
      >
        {t('optimization.panel.instruction')}
      </p>
    </div>
  );
}
