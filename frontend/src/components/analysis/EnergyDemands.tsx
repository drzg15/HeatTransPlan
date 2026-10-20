/** EnergyDemands — current energy supply panel (heat/cooling kW + stream selection). */

import { useCallback, useMemo, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useAnalysisStore } from '../../store/analysisStore';
import { getStreamInfo } from '../../utils/streamUtils';
import ChartHelpButton from '../ui/ChartHelpButton';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

interface StreamOption {
  key: string;
  label: string;
}

export default function EnergyDemands() {
  const { t, i18n } = useTranslation();
  const processes = useProjectStore((s) => s.state.processes);
  const energyDemands = useAnalysisStore((s) => s.energyDemands);
  const updateEnergyDemand = useAnalysisStore((s) => s.updateEnergyDemand);
  const addEnergyDemand = useAnalysisStore((s) => s.addEnergyDemand);
  const removeEnergyDemand = useAnalysisStore((s) => s.removeEnergyDemand);

  // Each stream is ticked by a key: its name, or its position when it has
  // none. Unnamed streams are shown under a translated label, and keying them
  // by that label unticks them whenever the language changes.
  const { hotStreams, coldStreams, legacyKeys } = useMemo(() => {
    const hot: StreamOption[] = [];
    const cold: StreamOption[] = [];
    // Older saves ticked unnamed streams by their label, in whichever language
    // was active; map those labels in every language back to the key.
    const legacy = new Map<string, string>();
    const named = new Set<string>();
    const labelIn = (ft: TFunction, pi: number, si: number, procName?: string) =>
      `${ft('stream_selector.stream')} ${si + 1} in ${procName || `${ft('stream_selector.subprocess')} ${pi + 1}`}`;
    processes.forEach((proc, pi) => {
      (proc.streams ?? []).forEach((stream, si) => {
        const info = getStreamInfo(stream);
        const option = stream.name
          ? { key: stream.name, label: stream.name }
          : { key: `#${pi}:${si}`, label: labelIn(t, pi, si, proc.name) };
        if (stream.name) named.add(stream.name);
        else
          Object.keys(i18n.store.data).forEach((lng) =>
            legacy.set(labelIn(i18n.getFixedT(lng), pi, si, proc.name), option.key)
          );
        if (info.type?.includes('Hot')) hot.push(option);
        else if (info.type?.includes('Cold')) cold.push(option);
      });
    });
    named.forEach((n) => legacy.delete(n));
    return { hotStreams: hot, coldStreams: cold, legacyKeys: legacy };
  }, [processes, t, i18n]);
  const hotNames = useMemo(() => hotStreams.map((o) => o.key), [hotStreams]);
  const coldNames = useMemo(() => coldStreams.map((o) => o.key), [coldStreams]);

  // Auto-initialize empty selections with all available streams, and convert
  // ticks saved under an old label to their key.
  useEffect(() => {
    const migrate = (names: string[]) => names.map((n) => legacyKeys.get(n) ?? n);
    const same = (a: string[], b: string[]) =>
      a.length === b.length && a.every((x, i) => x === b[i]);
    energyDemands.forEach((demand, i) => {
      const heat =
        demand.selected_heat_streams.length === 0 && coldNames.length > 0
          ? [...coldNames]
          : migrate(demand.selected_heat_streams);
      const cool =
        demand.selected_cooling_streams.length === 0 && hotNames.length > 0
          ? [...hotNames]
          : migrate(demand.selected_cooling_streams);
      if (
        !same(heat, demand.selected_heat_streams) ||
        !same(cool, demand.selected_cooling_streams)
      ) {
        updateEnergyDemand(i, { selected_heat_streams: heat, selected_cooling_streams: cool });
      }
    });
  }, [hotNames, coldNames, legacyKeys, energyDemands, updateEnergyDemand]);

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
                {coldStreams.map(({ key, label }) => (
                  <label key={key} className="pa-multi-option" title={label}>
                    <input
                      type="checkbox"
                      checked={demand.selected_heat_streams.includes(key)}
                      onChange={() => handleHeatStreamToggle(i, key)}
                    />
                    {label}
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
                {hotStreams.map(({ key, label }) => (
                  <label key={key} className="pa-multi-option" title={label}>
                    <input
                      type="checkbox"
                      checked={demand.selected_cooling_streams.includes(key)}
                      onChange={() => handleCoolStreamToggle(i, key)}
                    />
                    {label}
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
