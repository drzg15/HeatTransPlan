import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { useAnalysisStore } from '../../store/analysisStore';
import { useProjectStore } from '../../store/projectStore';
import MapViewer from '../map/MapViewer';
import './ScenarioComparison.css';

const ScenarioComparison: React.FC = () => {
  const scenarios = useAnalysisStore((s) => s.scenarios);
  const activeScenarioId = useAnalysisStore((s) => s.activeScenarioId);
  const projectState = useProjectStore((s) => s.state);
  const loadScenario = useAnalysisStore((s) => s.loadScenario);
  const deleteScenario = useAnalysisStore((s) => s.deleteScenario);

  // Group data for comparison charts
  const chartData = useMemo(() => {
    if (!scenarios || scenarios.length === 0) return null;

    const names = scenarios.map((sc) => sc.name);
    const hotUtilities = scenarios.map((sc) => sc.pinchResult?.hot_utility ?? 0);
    const coldUtilities = scenarios.map((sc) => sc.pinchResult?.cold_utility ?? 0);
    const heatingSavings = scenarios.map((sc) => sc.statusQuoResult?.heating_savings_pct ?? 0);
    const bestCOPs = scenarios.map((sc) => {
      const caps =
        sc.hpiResult?.heat_pumps?.filter((hp) => hp.available).map((hp) => hp.cop ?? 0) || [];
      return caps.length > 0 ? Math.max(...caps) : 0;
    });

    return { names, hotUtilities, coldUtilities, heatingSavings, bestCOPs };
  }, [scenarios]);

  if (scenarios.length < 2) return null;

  return (
    <div className="scenario-comparison">
      <div className="sc-header">
        <h2>📊 Scenario Comparison Dashboard</h2>
        <p className="sc-subtitle">Analyze and compare saved exploration states side-by-side</p>
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
                    title="Click to load this scenario"
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
                  <span style={{ color: '#64748b' }}>Pinch Temp.</span>
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
                  <span style={{ color: '#64748b' }}>Heat Savings</span>
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
                {isActive ? 'Scenario Selected' : 'Load Scenario'}
              </button>
            </div>
          );
        })}
      </div>

      {/* 2. Combined Comparison Table - Now in Middle */}
      <div className="sc-table-section pa-section">
        <h3>📊 Combined Status Quo vs. Proposal Comparison</h3>
        <p className="sc-subtitle" style={{ marginBottom: 16 }}>
          Aggregated performance data across all saved scenarios.
        </p>
        <div className="scroll-x">
          <table className="pa-table" style={{ width: '100%', minWidth: '800px' }}>
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  style={{ textAlign: 'left', background: '#f1f5f9', color: '#334155' }}
                >
                  Scenario
                </th>
                <th
                  colSpan={2}
                  style={{ textAlign: 'center', background: '#fecaca', color: '#991b1b' }}
                >
                  Heating (kW)
                </th>
                <th
                  colSpan={2}
                  style={{ textAlign: 'center', background: '#bfdbfe', color: '#1e40af' }}
                >
                  Cooling (kW)
                </th>
                <th
                  colSpan={2}
                  style={{ textAlign: 'center', background: '#a7f3d0', color: '#065f46' }}
                >
                  Heat Recovery Potential
                </th>
                <th
                  colSpan={2}
                  style={{ textAlign: 'center', background: '#ddd6fe', color: '#5b21b6' }}
                >
                  HP Integration
                </th>
              </tr>
              <tr>
                <th style={{ background: '#fee2e2', color: '#b91c1c' }}>Status Quo</th>
                <th style={{ background: '#fee2e2', color: '#b91c1c' }}>Pinch Min.</th>
                <th style={{ background: '#dbeafe', color: '#1d4ed8' }}>Status Quo</th>
                <th style={{ background: '#dbeafe', color: '#1d4ed8' }}>Pinch Min.</th>
                <th style={{ background: '#d1fae5', color: '#047857' }}>Savings (kW)</th>
                <th style={{ background: '#d1fae5', color: '#047857' }}>Savings (%)</th>
                <th style={{ background: '#ede9fe', color: '#6d28d9' }}>Best COP</th>
                <th style={{ background: '#ede9fe', color: '#6d28d9' }}>Coverage (%)</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((sc) => {
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
                        <span style={{ color: '#3b82f6', fontSize: '0.8em' }}>(Active)</span>
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
                  name: 'Heating Demand (kW)',
                  type: 'bar',
                  marker: { color: '#ef4444' },
                },
                {
                  x: chartData.names,
                  y: chartData.coldUtilities,
                  name: 'Cooling Demand (kW)',
                  type: 'bar',
                  marker: { color: '#3b82f6' },
                },
              ]}
              layout={{
                title: { text: 'Utilities Load Comparison', font: { size: 14 } },
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
                  y: chartData.heatingSavings,
                  name: 'Heating Savings (%)',
                  type: 'scatter',
                  mode: 'lines+markers',
                  line: { color: '#10b981', width: 3 },
                  marker: { size: 8 },
                },
                {
                  x: chartData.names,
                  y: chartData.bestCOPs,
                  name: 'Best HP COP',
                  type: 'scatter',
                  mode: 'lines+markers',
                  yaxis: 'y2',
                  line: { color: '#8b5cf6', width: 3, dash: 'dot' },
                  marker: { size: 8 },
                },
              ]}
              layout={{
                title: { text: 'Performance Metrics', font: { size: 14 } },
                height: 300,
                margin: { l: 40, r: 40, t: 40, b: 60 },
                legend: { orientation: 'h', y: -0.2 },
                yaxis: { title: 'Savings %', range: [0, 100], gridcolor: '#f1f5f9' },
                yaxis2: {
                  title: 'Best COP',
                  overlaying: 'y',
                  side: 'right',
                  range: [0, 10],
                  showgrid: false,
                },
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
