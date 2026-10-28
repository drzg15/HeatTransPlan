import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Plot from 'react-plotly.js';
import { useAnalysisStore } from '../../store/analysisStore';
import { useProjectStore } from '../../store/projectStore';
import MapViewer from '../map/MapViewer';
import { econCore } from './econModel';
import { GREEN, RED } from './econConfig';
import { formatDe } from '../../utils/numberFormat';
import './ScenarioComparison.css';

const ScenarioComparison: React.FC = () => {
  const { t } = useTranslation();
  const scenarios = useAnalysisStore((s) => s.scenarios);
  const activeScenarioId = useAnalysisStore((s) => s.activeScenarioId);
  const projectState = useProjectStore((s) => s.state);
  const loadScenario = useAnalysisStore((s) => s.loadScenario);
  const deleteScenario = useAnalysisStore((s) => s.deleteScenario);
  const econForm = useAnalysisStore((s) => s.econForm);
  const econRefType = useAnalysisStore((s) => s.econRefType);

  // Economics of each scenario's pump, all under the same inputs (prices,
  // investment per kW, …) from the Economic analysis section.
  const econ = useMemo(
    () =>
      scenarios.map((sc) =>
        econCore(econForm, econRefType, sc.selectedHPPoints ?? [], sc.hpiOptimizationResult)
      ),
    [scenarios, econForm, econRefType]
  );

  // Group data for comparison charts
  const chartData = useMemo(() => {
    if (!scenarios || scenarios.length === 0) return null;

    const names = scenarios.map((sc) => sc.name);
    const hotUtilities = scenarios.map((sc) => sc.pinchResult?.hot_utility ?? 0);
    const coldUtilities = scenarios.map((sc) => sc.pinchResult?.cold_utility ?? 0);
    const bestCOPs = scenarios.map((sc) => {
      const caps =
        sc.hpiResult?.heat_pumps?.filter((hp) => hp.available).map((hp) => hp.cop ?? 0) || [];
      return caps.length > 0 ? Math.max(...caps) : 0;
    });

    return { names, hotUtilities, coldUtilities, bestCOPs };
  }, [scenarios]);

  if (scenarios.length < 2) return null;

  return (
    <div className="scenario-comparison">
      <div className="sc-header">
        <h2>{t('scenario_cmp.title')}</h2>
        <p className="sc-subtitle">{t('scenario_cmp.subtitle')}</p>
      </div>

      {/* 1. Scenario Cards - Now at Top */}
      <div className="sc-grid" style={{ marginBottom: '40px' }}>
        {scenarios.map((scen, idx) => {
          const isActive = scen.id === activeScenarioId;

          return (
            <div key={scen.id} className={`sc-card ${isActive ? 'active' : ''}`}>
              <div className="sc-card-header">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '100%',
                  }}
                >
                  <h3
                    onClick={() => loadScenario(idx)}
                    style={{ cursor: 'pointer', margin: 0 }}
                    title={t('scenario_cmp.load_hint')}
                  >
                    {scen.name}
                    {isActive && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: '0.7em',
                          background: '#34d399',
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        ACTIVE
                      </span>
                    )}
                  </h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteScenario(idx);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '18px',
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="sc-tmin-tag">ΔTmin: {scen.tMin}K</div>
              </div>

              {/* Map Preview */}
              <div className="sc-map-preview">
                <MapViewer
                  key={`map-${scen.id}`}
                  height="200px"
                  center={
                    projectState.map_center?.length === 2
                      ? (projectState.map_center as [number, number])
                      : [51.707937580921694, 8.772205607882668]
                  }
                  zoom={Math.max(1, (projectState.map_zoom || 17) - 2)}
                  locked={true}
                  processes={projectState.processes}
                  groups={projectState.proc_groups || []}
                  groupNames={projectState.proc_group_names || []}
                  groupCoordinates={projectState.proc_group_coordinates || {}}
                  baseTile={projectState.current_base || 'OpenStreetMap'}
                  onClick={() => {}}
                  onMoveEnd={() => {}}
                  subprocessMapExpanded={{}}
                  childMapExpanded={{}}
                  selectionActive={false}
                  selectedStreams={scen.selectedStreams}
                  onProcessesSelect={() => {}}
                  onSelectionToggle={() => {}}
                />
              </div>

              <div className="sc-results" style={{ padding: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.85rem',
                    marginBottom: 8,
                  }}
                >
                  <span style={{ color: '#64748b' }}>{t('scenario_cmp.pinch_temp')}</span>
                  <span style={{ fontWeight: 600 }}>
                    {scen.pinchResult?.pinch_temperature.toFixed(1)} °C
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.85rem',
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: '#64748b' }}>{t('scenario_cmp.heat_savings')}</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>
                    {scen.statusQuoResult?.heating_savings_pct.toFixed(1)}%
                  </span>
                </div>
              </div>

              <button
                className="sc-load-btn"
                onClick={() => loadScenario(idx)}
                style={{ background: isActive ? '#3b82f6' : '', color: isActive ? 'white' : '' }}
              >
                {isActive ? t('scenario_cmp.selected') : t('scenario_cmp.load')}
              </button>
            </div>
          );
        })}
      </div>

      {/* 2. Combined Comparison Table - Now in Middle */}
      <div className="sc-table-section pa-section">
        <h3>{t('scenario_cmp.combined')}</h3>
        <p className="sc-subtitle" style={{ marginBottom: 16 }}>
          Aggregated performance data across all saved scenarios.{' '}
          {t('economics.compare_note', { T: Math.round(econForm.T) })}
        </p>
        <div className="scroll-x">
          <table className="pa-table" style={{ width: '100%', minWidth: '800px' }}>
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  style={{ textAlign: 'left', background: '#f1f5f9', color: '#334155' }}
                >
                  {t('scenario_cmp.scenario')}
                </th>
                <th
                  colSpan={2}
                  style={{ textAlign: 'center', background: '#fecaca', color: '#991b1b' }}
                >
                  {t('scenario_cmp.heating')}
                </th>
                <th
                  colSpan={2}
                  style={{ textAlign: 'center', background: '#bfdbfe', color: '#1e40af' }}
                >
                  {t('scenario_cmp.cooling')}
                </th>
                <th
                  colSpan={2}
                  style={{ textAlign: 'center', background: '#a7f3d0', color: '#065f46' }}
                >
                  {t('scenario_cmp.recovery')}
                </th>
                <th
                  colSpan={2}
                  style={{ textAlign: 'center', background: '#ddd6fe', color: '#5b21b6' }}
                >
                  {t('scenario_cmp.hpi')}
                </th>
                <th
                  colSpan={4}
                  style={{ textAlign: 'center', background: '#fde68a', color: '#78350f' }}
                >
                  {t('economics.title')}
                </th>
              </tr>
              <tr>
                <th style={{ background: '#fee2e2', color: '#b91c1c' }}>
                  {t('scenario_cmp.status_quo')}
                </th>
                <th style={{ background: '#fee2e2', color: '#b91c1c' }}>
                  {t('scenario_cmp.pinch_min')}
                </th>
                <th style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                  {t('scenario_cmp.status_quo')}
                </th>
                <th style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                  {t('scenario_cmp.pinch_min')}
                </th>
                <th style={{ background: '#d1fae5', color: '#047857' }}>
                  {t('scenario_cmp.savings_kw')}
                </th>
                <th style={{ background: '#d1fae5', color: '#047857' }}>
                  {t('scenario_cmp.savings_pct')}
                </th>
                <th style={{ background: '#ede9fe', color: '#6d28d9' }}>
                  {t('scenario_cmp.best_cop')}
                </th>
                <th style={{ background: '#ede9fe', color: '#6d28d9' }}>
                  {t('scenario_cmp.coverage')}
                </th>
                <th style={{ background: '#fef3c7', color: '#92400e' }}>
                  {t('economics.rows.capex')} (€)
                </th>
                <th style={{ background: '#fef3c7', color: '#92400e' }}>
                  {t('economics.rows.npv')} (€)
                </th>
                <th style={{ background: '#fef3c7', color: '#92400e' }}>
                  {t('economics.rows.payback')}
                </th>
                <th style={{ background: '#fef3c7', color: '#92400e' }}>
                  {t('economics.rows.saving1')} (€/{t('economics.year')})
                </th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((sc, idx) => {
                const ec = econ[idx];
                const npv = ec?.results[0].npv;
                const payback = ec?.results[0].payback;
                const sq = sc.statusQuoResult;
                const pr = sc.pinchResult;
                const hpi = sc.hpiResult;
                const bestHP = hpi?.heat_pumps
                  ?.filter((hp) => hp.available)
                  .sort((a, b) => (b.cop ?? 0) - (a.cop ?? 0))[0];

                const hCov =
                  bestHP && pr && pr.hot_utility > 0
                    ? Math.min(100, ((bestHP.q_sink ?? 0) / pr.hot_utility) * 100)
                    : 0;

                return (
                  <tr
                    key={sc.id}
                    style={{
                      borderBottom: '1px solid #edf2f7',
                      background: sc.id === activeScenarioId ? '#f0f9ff' : 'transparent',
                    }}
                  >
                    <td style={{ fontWeight: 600 }}>
                      {sc.name}{' '}
                      {sc.id === activeScenarioId && (
                        <span style={{ color: '#3b82f6', fontSize: '0.8em' }}>
                          {t('scenario_cmp.active')}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {(sq?.total_current_heating ?? 0).toFixed(1)}
                    </td>
                    <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>
                      {(pr?.hot_utility ?? 0).toFixed(1)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {(sq?.total_current_cooling ?? 0).toFixed(1)}
                    </td>
                    <td style={{ textAlign: 'right', color: '#2563eb', fontWeight: 600 }}>
                      {(pr?.cold_utility ?? 0).toFixed(1)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {(sq?.heating_savings_kW ?? 0).toFixed(1)}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        background: '#d1fae5',
                        color: '#059669',
                        fontWeight: 700,
                      }}
                    >
                      {(sq?.heating_savings_pct ?? 0).toFixed(1)}%
                    </td>
                    <td style={{ textAlign: 'right' }}>{bestHP?.cop?.toFixed(2) || '—'}</td>
                    <td
                      style={{
                        textAlign: 'right',
                        background: '#ede9fe',
                        color: '#7c3aed',
                        fontWeight: 700,
                      }}
                    >
                      {hCov.toFixed(1)}%
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {ec ? formatDe(ec.variants[0].capex) : '—'}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: npv === undefined ? undefined : npv < 0 ? RED : GREEN,
                      }}
                    >
                      {npv === undefined ? '—' : formatDe(npv)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {!ec
                        ? '—'
                        : payback === null
                          ? t('economics.payback_never_short')
                          : `${payback} ${t('economics.years')}`}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {ec ? formatDe(ec.results[0].saving1) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Comparison Plots - Now at Bottom */}
      {chartData && (
        <div className="sc-charts-grid" style={{ marginBottom: '20px' }}>
          <div className="sc-chart-card">
            <Plot
              data={[
                {
                  x: chartData.names,
                  y: chartData.hotUtilities,
                  name: t('analysis.charts.heating_demand'),
                  type: 'bar',
                  marker: { color: '#ef4444' },
                },
                {
                  x: chartData.names,
                  y: chartData.coldUtilities,
                  name: t('analysis.charts.cooling_demand'),
                  type: 'bar',
                  marker: { color: '#3b82f6' },
                },
              ]}
              layout={{
                title: { text: t('analysis.charts.util_load_comp'), font: { size: 14 } },
                barmode: 'group',
                height: 300,
                margin: { l: 40, r: 20, t: 40, b: 60 },
                legend: { orientation: 'h', y: -0.2 },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
              }}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: '100%' }}
            />
          </div>
          <div className="sc-chart-card">
            <Plot
              data={[
                {
                  x: chartData.names,
                  y: chartData.bestCOPs,
                  name: t('analysis.charts.best_hp_cop'),
                  type: 'scatter',
                  mode: 'lines+markers',
                  line: { color: '#8b5cf6', width: 3, dash: 'dot' },
                  marker: { size: 8 },
                },
              ]}
              layout={{
                title: { text: t('analysis.charts.perf_metrics'), font: { size: 14 } },
                height: 300,
                margin: { l: 40, r: 40, t: 40, b: 60 },
                legend: { orientation: 'h', y: -0.2 },
                yaxis: {
                  title: t('scenario_cmp.best_cop'),
                  autorange: true,
                  rangemode: 'tozero',
                  gridcolor: '#f1f5f9',
                },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
              }}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: '100%' }}
            />
          </div>
          <div className="sc-chart-card">
            <Plot
              data={[
                {
                  x: chartData.names,
                  y: econ.map((ec) => ec?.results[0].npv ?? null),
                  name: t('economics.rows.npv'),
                  type: 'bar',
                  marker: {
                    color: econ.map((ec) => ((ec?.results[0].npv ?? 0) < 0 ? RED : GREEN)),
                  },
                  hovertemplate: '%{x}: %{y:,.0f} €<extra></extra>',
                },
              ]}
              layout={{
                title: {
                  text: t('economics.compare_npv_title', { T: Math.round(econForm.T) }),
                  font: { size: 14 },
                },
                height: 300,
                separators: ',.',
                margin: { l: 70, r: 20, t: 40, b: 60 },
                yaxis: { title: { text: '€' }, tickformat: ',.0f', zeroline: true },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
              }}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ScenarioComparison;
