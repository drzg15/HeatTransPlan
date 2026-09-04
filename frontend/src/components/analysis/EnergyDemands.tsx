/** EnergyDemands — current energy supply panel (heat/cooling kW + stream selection). */

import { useCallback, useMemo, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useAnalysisStore } from '../../store/analysisStore';
import { getStreamInfo } from '../../utils/streamUtils';
import ChartHelpButton from '../ui/ChartHelpButton';
import { useTranslation } from 'react-i18next';

export default function EnergyDemands() {
  const { t } = useTranslation();
  const processes = useProjectStore((s) => s.state.processes);
  const energyDemands = useAnalysisStore((s) => s.energyDemands);
  const updateEnergyDemand = useAnalysisStore((s) => s.updateEnergyDemand);
  const addEnergyDemand = useAnalysisStore((s) => s.addEnergyDemand);
  const removeEnergyDemand = useAnalysisStore((s) => s.removeEnergyDemand);

  // Build hot/cold stream name lists
  const { hotNames, coldNames } = useMemo(() => {
    const hot: string[] = [];
    const cold: string[] = [];
    processes.forEach((proc, pi) => {
      (proc.streams ?? []).forEach((stream, si) => {
        const info = getStreamInfo(stream);
        const name =
          stream.name ||
          `${t('stream_selector.stream')} ${si + 1} in ${proc.name || `${t('stream_selector.subprocess')} ${pi + 1}`}`;
        if (info.type?.includes('Hot')) hot.push(name);
        else if (info.type?.includes('Cold')) cold.push(name);
      });
    });
    return { hotNames: hot, coldNames: cold };
  }, [processes]);

  // Auto-initialize empty selections with all available streams
  useEffect(() => {
    energyDemands.forEach((demand, i) => {
      const needsHeatSync = demand.selected_heat_streams.length === 0 && coldNames.length > 0;
      const needsColdSync = demand.selected_cooling_streams.length === 0 && hotNames.length > 0;

      if (needsHeatSync || needsColdSync) {
        updateEnergyDemand(i, {
          selected_heat_streams: needsHeatSync ? [...coldNames] : demand.selected_heat_streams,
          selected_cooling_streams: needsColdSync ? [...hotNames] : demand.selected_cooling_streams,
        });
      }
    });
  }, [hotNames, coldNames, energyDemands, updateEnergyDemand]);

  const handleAddSupply = useCallback(() => {
    addEnergyDemand({
      heat_demand: 0,
      cooling_demand: 0,
      selected_heat_streams: [...coldNames],
      selected_cooling_streams: [...hotNames],
    });
  }, [addEnergyDemand, hotNames, coldNames]);

  const handleHeatStreamToggle = useCallback(
    (demandIdx: number, streamName: string) => {
      const demand = energyDemands[demandIdx];
      const current = demand.selected_heat_streams;
      const next = current.includes(streamName)
        ? current.filter((n) => n !== streamName)
        : [...current, streamName];
      updateEnergyDemand(demandIdx, { selected_heat_streams: next });
    },
    [energyDemands, updateEnergyDemand]
  );

  const handleCoolStreamToggle = useCallback(
    (demandIdx: number, streamName: string) => {
      const demand = energyDemands[demandIdx];
      const current = demand.selected_cooling_streams;
      const next = current.includes(streamName)
        ? current.filter((n) => n !== streamName)
        : [...current, streamName];
      updateEnergyDemand(demandIdx, { selected_cooling_streams: next });
    },
    [energyDemands, updateEnergyDemand]
  );

  return (
    <div className="pa-panel">
      <h4
        className="pa-panel-title"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center' }}>
          {t('energy_demands.title')}
          <ChartHelpButton
            inline
            title={t('energy_demands.title')}
            description={t('energy_demands.help_desc')}
          />
        </span>
      </h4>

      <>
        {energyDemands.map((demand, i) => (
          <div key={i} className="pa-demand-card">
            <div className="pa-demand-header">
              <strong>
                {t('energy_demands.supply')} {i + 1}
              </strong>
              {i > 0 && (
                <button
                  className="pa-btn-icon"
                  onClick={() => removeEnergyDemand(i)}
                  title={t('energy_demands.remove')}
                >
                  🗑️
                </button>
              )}
            </div>

            {/* Heat supply */}
            <label className="pa-input-label">
              {t('energy_demands.heat_kw')}
              <input
                type="number"
                min={0}
                step={0.1}
                value={demand.heat_demand}
                onChange={(e) =>
                  updateEnergyDemand(i, { heat_demand: parseFloat(e.target.value) || 0 })
                }
                className="pa-number-input"
              />
            </label>
            <details className="pa-details" open>
              <summary>{t('energy_demands.cold_selection')}</summary>
              <div className="pa-multi-select">
                {coldNames.map((name) => (
                  <label key={name} className="pa-multi-option" title={name}>
                    <input
                      type="checkbox"
                      checked={demand.selected_heat_streams.includes(name)}
                      onChange={() => handleHeatStreamToggle(i, name)}
                    />
                    {name}
                  </label>
                ))}
                {coldNames.length === 0 && (
                  <span className="pa-muted">{t('energy_demands.no_cold')}</span>
                )}
              </div>
            </details>

            {/* Cooling supply */}
            <label className="pa-input-label">
              {t('energy_demands.cooling_kw')}
              <input
                type="number"
                min={0}
                step={0.1}
                value={demand.cooling_demand}
                onChange={(e) =>
                  updateEnergyDemand(i, { cooling_demand: parseFloat(e.target.value) || 0 })
                }
                className="pa-number-input"
              />
            </label>
            <details className="pa-details" open>
              <summary>{t('energy_demands.hot_selection')}</summary>
              <div className="pa-multi-select">
                {hotNames.map((name) => (
                  <label key={name} className="pa-multi-option" title={name}>
                    <input
                      type="checkbox"
                      checked={demand.selected_cooling_streams.includes(name)}
                      onChange={() => handleCoolStreamToggle(i, name)}
                    />
                    {name}
                  </label>
                ))}
                {hotNames.length === 0 && (
                  <span className="pa-muted">{t('energy_demands.no_hot')}</span>
                )}
              </div>
            </details>

            <hr className="pa-hr" />
          </div>
        ))}

        <button className="pa-btn" onClick={handleAddSupply}>
          ➕ {t('energy_demands.add_supply')}
        </button>
      </>
    </div>
  );
}
