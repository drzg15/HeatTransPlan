import { act, render, screen } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import i18n from '../../i18n';
import EnergyDemands from './EnergyDemands';
import { useProjectStore } from '../../store/projectStore';
import { useAnalysisStore } from '../../store/analysisStore';
import type { Process } from '../../types/project';

// One unnamed hot stream (100 → 40 °C) and one named cold one.
const processes = [
  {
    name: 'Dryer',
    streams: [
      { stream_values: { Tin: 100, Tout: 40, CP: 2 } },
      { name: 'Feed', stream_values: { Tin: 20, Tout: 80, CP: 2 } },
    ],
  },
] as unknown as Process[];

const demand = (cooling: string[]) => ({
  heat_demand: 0,
  cooling_demand: 0,
  selected_heat_streams: ['Feed'],
  selected_cooling_streams: cooling,
});

beforeEach(async () => {
  await i18n.changeLanguage('en');
  useProjectStore.getState().resetState();
  useProjectStore.getState().setProcesses(processes);
});

const hotBox = () => screen.getByTitle(/in Dryer$/).querySelector('input')!;

it('an unnamed stream stays ticked when the language changes', async () => {
  useAnalysisStore.setState({ energyDemands: [demand([])] });
  render(<EnergyDemands />);
  expect(hotBox().checked).toBe(true);

  await act(() => i18n.changeLanguage('de'));
  expect(screen.getByTitle('Ströme 1 in Dryer')).toBeTruthy();
  expect(hotBox().checked).toBe(true);
  expect(useAnalysisStore.getState().energyDemands[0].selected_cooling_streams).toEqual(['#0:0']);
});

it('a tick saved under the old German label is carried over', () => {
  useAnalysisStore.setState({ energyDemands: [demand(['Ströme 1 in Dryer'])] });
  render(<EnergyDemands />);
  expect(hotBox().checked).toBe(true);
  expect(useAnalysisStore.getState().energyDemands[0].selected_cooling_streams).toEqual(['#0:0']);
});
