import { useTranslation } from 'react-i18next';
import type { OptimizedIntegrationPoint } from '../../types/analysis';
import ChartHelpButton from '../ui/ChartHelpButton';
import type { SortConfig, SortKey } from './hpRules';

interface Props {
  isDark: boolean;
  tMin: number;
  /** The rows to show, already filtered and sorted. */
  rows: OptimizedIntegrationPoint[];
  selectedPoints: OptimizedIntegrationPoint[];
  sortConfigs: SortConfig[];
  onSort: (key: SortKey) => void;
  /** Raw result count, to tell "nothing feasible" from "nothing left after filtering". */
  feasibleCount: number;
  diagnosticMessages: string[];
}

/** The operating-point table left of the chart, with its help, sorting and footnotes. */
export default function HPIOperatingTable({
  isDark,
  tMin,
  rows,
  selectedPoints,
  sortConfigs,
  onSort,
  feasibleCount,
  diagnosticMessages,
}: Props) {
  const { t } = useTranslation();

  const renderSortIcon = (key: SortKey) => {
    const idx = sortConfigs.findIndex((c) => c.key === key);
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
  };

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

  return (
    <div className="pa-hp-table-wrap" style={{ maxHeight: '440px', overflowY: 'auto' }}>
      {rows.length > 0 ? (
        <>
          <div
            className="pa-hp-section-label"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              position: 'sticky',
              top: 0,
              background: isDark ? '#0F172A' : '#FFF',
              zIndex: 2,
              margin: 0,
              paddingBottom: '0.5rem',
              color: isDark ? '#60A5FA' : '#2563EB',
              fontWeight: 600,
            }}
          >
            {t('optimization.panel.title')}
            <span onClick={(e) => e.stopPropagation()}>
              <ChartHelpButton
                title={t('optimization.title_model_information')}
                description={t('optimization.desc_model_information')}
                inline={true}
              />
            </span>
          </div>
          <table className="pa-table pa-hp-table">
            <thead style={{ position: 'sticky', top: '30px', zIndex: 2 }}>
              <tr>
                <th style={typeThStyle} onClick={() => onSort('theoretical')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {t('optimization.panel.headers.entry_type')}
                    <span onClick={(e) => e.stopPropagation()}>
                      <ChartHelpButton
                        title={t('optimization.panel.headers.entry_type')}
                        description={t('optimization.entry_type_hint')}
                        inline={true}
                      />
                    </span>
                    {renderSortIcon('theoretical')}
                  </div>
                </th>
                <th style={narrowThStyle} onClick={() => onSort('refrigerant_type')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {t('optimization.panel.headers.refrigerant_type')}
                    <span onClick={(e) => e.stopPropagation()}>
                      <ChartHelpButton
                        title={t('optimization.title_refrigerant_type')}
                        description={t('optimization.tooltip_refrigerant_type')}
                        inline={true}
                      />
                    </span>
                    {renderSortIcon('refrigerant_type')}
                  </div>
                </th>
                <th style={thStyle} onClick={() => onSort('medium_sink')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {t('optimization.panel.headers.medium_sink')}
                    <span onClick={(e) => e.stopPropagation()}>
                      <ChartHelpButton
                        title={t('optimization.title_medium_sink')}
                        description={t('optimization.desc_medium_sink')}
                        inline={true}
                      />
                    </span>
                    {renderSortIcon('medium_sink')}
                  </div>
                </th>
                <th style={thStyle} onClick={() => onSort('COP')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span className="notranslate">{t('optimization.panel.headers.cop')}</span>
                    <span onClick={(e) => e.stopPropagation()}>
                      <ChartHelpButton
                        title={t('optimization.title_cop')}
                        description={t('optimization.tooltip_cop')}
                        inline={true}
                      />
                    </span>
                    {renderSortIcon('COP')}
                  </div>
                </th>
                <th style={thStyle} onClick={() => onSort('Q_demand')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {t('optimization.panel.headers.q_sink')}
                    <span onClick={(e) => e.stopPropagation()}>
                      <ChartHelpButton
                        title={t('optimization.title_q_sink')}
                        description={t('optimization.tooltip_q_sink')}
                        inline={true}
                      />
                    </span>
                    {renderSortIcon('Q_demand')}
                  </div>
                </th>
                <th style={thStyle} onClick={() => onSort('Q_source')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {t('optimization.panel.headers.q_source')}
                    <span onClick={(e) => e.stopPropagation()}>
                      <ChartHelpButton
                        title={t('optimization.title_q_source')}
                        description={t('optimization.tooltip_q_source')}
                        inline={true}
                      />
                    </span>
                    {renderSortIcon('Q_source')}
                  </div>
                </th>
                <th style={thStyle} onClick={() => onSort('W_el')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {t('optimization.panel.headers.w_el')}
                    <span onClick={(e) => e.stopPropagation()}>
                      <ChartHelpButton
                        title={t('optimization.title_w_el')}
                        description={t('optimization.tooltip_w_el')}
                        inline={true}
                      />
                    </span>
                    {renderSortIcon('W_el')}
                  </div>
                </th>
                <th style={thStyle} onClick={() => onSort('T_sink')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    Actual Sink Temp [°C]
                    <span onClick={(e) => e.stopPropagation()}>
                      <ChartHelpButton
                        title={t('optimization.title_actual_sink_temp')}
                        description={t('optimization.desc_actual_sink_temp')}
                        inline={true}
                      />
                    </span>
                    {renderSortIcon('T_sink')}
                  </div>
                </th>
                <th style={thStyle} onClick={() => onSort('T_sink')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    Shifted Sink (T+{tMin / 2}K) [°C]
                    <span onClick={(e) => e.stopPropagation()}>
                      <ChartHelpButton
                        title={t('optimization.title_shifted_sink_temp')}
                        description={t('optimization.desc_shifted_sink_temp')}
                        inline={true}
                      />
                    </span>
                  </div>
                </th>
                <th style={thStyle} onClick={() => onSort('T_source')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    Actual Source Temp [°C]
                    <span onClick={(e) => e.stopPropagation()}>
                      <ChartHelpButton
                        title={t('optimization.title_actual_source_temp')}
                        description={t('optimization.desc_actual_source_temp')}
                        inline={true}
                      />
                    </span>
                    {renderSortIcon('T_source')}
                  </div>
                </th>
                <th style={thStyle} onClick={() => onSort('T_source')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    Shifted Source (T-{tMin / 2}K) [°C]
                    <span onClick={(e) => e.stopPropagation()}>
                      <ChartHelpButton
                        title={t('optimization.title_shifted_source_temp')}
                        description={t('optimization.desc_shifted_source_temp')}
                        inline={true}
                      />
                    </span>
                  </div>
                </th>
                <th style={thStyle} onClick={() => onSort('refrigerant')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {t('optimization.panel.headers.refrigerant')}
                    <span onClick={(e) => e.stopPropagation()}>
                      <ChartHelpButton
                        title={t('optimization.title_refrigerant')}
                        description={t('optimization.tooltip_refrigerant')}
                        inline={true}
                      />
                    </span>
                    {renderSortIcon('refrigerant')}
                  </div>
                </th>
                <th style={thStyle} onClick={() => onSort('hp_level')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {t('optimization.panel.headers.hp_stages')}
                    <span onClick={(e) => e.stopPropagation()}>
                      <ChartHelpButton
                        title={t('optimization.title_hp_stages')}
                        description={t('optimization.tooltip_hp_stages')}
                        inline={true}
                      />
                    </span>
                    {renderSortIcon('hp_level')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((pt, i) => {
                const isSelected = selectedPoints.some(
                  (sp) => sp.refrigerant === pt.refrigerant && sp.T_sink === pt.T_sink
                );
                const refName = pt.refrigerant.includes('_')
                  ? pt.refrigerant.substring(0, pt.refrigerant.lastIndexOf('_'))
                  : pt.refrigerant;
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
                          ? `Source-limited: the available waste heat only covers ${((100 * pt.Q_demand) / pt.Q_demand_total).toFixed(0)} % of the ${pt.Q_demand_total.toFixed(1)} kW required above this sink temperature.`
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
                    {/* The point's temperatures are the Grand Composite Curve's
                              shifted ones, which the COP is computed at; the actual
                              ones sit ΔTmin/2 below the sink, above the source. */}
                    <td style={sinkCell}>{(pt.T_sink - tMin / 2).toFixed(1)}</td>
                    <td style={sinkCell}>{pt.T_sink.toFixed(1)}</td>
                    <td style={sourceCell}>{(pt.T_source + tMin / 2).toFixed(1)}</td>
                    <td style={sourceCell}>{pt.T_source.toFixed(1)}</td>
                    <td>{pt.theoretical ? '' : refName}</td>
                    <td>{pt.theoretical ? '' : pt.hp_level}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      ) : (
        <div style={{ marginTop: '1rem', color: isDark ? '#94A3B8' : '#64748B' }}>
          <p>
            {feasibleCount === 0
              ? 'No heat pump can be integrated with this stream selection.'
              : 'No feasible optimizations found for these filters.'}
          </p>
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
