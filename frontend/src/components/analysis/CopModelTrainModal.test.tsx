/** The COP training module on the page: hidden when the server does not run
 *  it; otherwise upload, map, train, use, and switch the model off again. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import i18n from '../../i18n';
import { useAnalysisStore } from '../../store/analysisStore';
import fixture from '../../test/fixtures/optimization.json';
import type { CopTrainResult } from '../../types/copTraining';

const features = { cop_training: true };
vi.mock('../../hooks/useFeatures', () => ({ useFeatures: () => features }));
vi.mock('./HPIOptimizationChart', () => ({ default: () => <div /> }));
vi.mock('react-plotly.js', () => ({ default: () => <div data-testid="parity" /> }));

const trained: CopTrainResult = {
  spec: {
    name: 'Plant data',
    enabled: true,
    kind: 'poly',
    formula: 'COP = 7.6 + 0.08·T_src,out − 0.078·T_snk,out',
    temps: ['T_source_out', 'T_sink_out'],
    cats: ['refrigerant'],
    mean: [50, 100],
    scale: [10, 20],
    categories: { refrigerant: ['R600'] },
    layers: [{ W: [[1], [1], [1]], b: [0] }],
    envelope: {
      T_source_min: 20,
      T_source_max: 80,
      T_sink_min: 60,
      T_sink_max: 140,
      cop_min: 1.5,
      cop_max: 6,
    },
    data_envelope: {
      T_source_min: 20,
      T_source_max: 80,
      T_sink_min: 60,
      T_sink_max: 140,
      cop_min: 1.5,
      cop_max: 6,
    },
    combos: [{ refrigerant: 'R600' }],
    metrics: { r2: 0.981, mae: 0.084, rmse: 0.11, mape: 2.3, n_test: 300, n_train: 1200 },
  },
  rows_used: 1500,
  rows_dropped: 12,
  sampled_from: null,
  parity: { actual: [3, 4], predicted: [3.1, 3.9] },
};
const inspect = vi.fn();
const train = vi.fn();
vi.mock('../../api/copTraining', () => ({
  inspectCopData: (f: File, sheet?: string) => inspect(f, sheet),
  trainCopModel: (...a: unknown[]) => train(...a),
}));

import HPIOptimizationPanel from './HPIOptimizationPanel';

beforeEach(async () => {
  cleanup();
  await i18n.changeLanguage('en');
  features.cop_training = true;
  inspect.mockResolvedValue({
    sheets: [],
    sheet: null,
    columns: ['T src', 'T sink', 'COP', 'Refrigerant'],
    numeric_columns: ['T src', 'T sink', 'COP'],
    rows: 1512,
    max_rows: 10000,
    min_rows: 30,
    preview: [{ 'T src': '30', 'T sink': '80', COP: '3,2', Refrigerant: 'R600' }],
    guess: { T_source_out: 'T src', T_sink_out: 'T sink', COP: 'COP', refrigerant: 'Refrigerant' },
  });
  train.mockResolvedValue(trained);
  useAnalysisStore.setState({
    pinchResult: fixture.pinch as never,
    hpiOptimizationResult: fixture.optimization as never,
    customCopModel: null,
  });
});

describe('COP training module', () => {
  it('is hidden when the server does not run it', () => {
    features.cop_training = false;
    const view = render(<HPIOptimizationPanel />);
    expect(view.queryByText(/Train from my data/)).toBeNull();
  });

  it('trains on uploaded data, then the model can be used and switched off', async () => {
    const view = render(<HPIOptimizationPanel />);
    fireEvent.click(view.getByText(/Train from my data/));
    const dialog = view.getByRole('dialog');
    const input = dialog.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'plant.csv')] } });
    await waitFor(() => expect(within(dialog).getByText(/1512 rows, 4 columns/)).toBeTruthy());
    // The guess fills the mapping: required columns set, so training can start.
    const selects = dialog.querySelectorAll('select');
    expect((selects[0] as HTMLSelectElement).value).toBe('T src');
    // Polynomial of degree 3: the formula is shown after training.
    fireEvent.change(within(dialog).getByDisplayValue('Neural network'), {
      target: { value: 'poly' },
    });
    fireEvent.change(within(dialog).getByDisplayValue('2'), { target: { value: '3' } });
    fireEvent.click(within(dialog).getByText('Train'));
    await waitFor(() => expect(within(dialog).getByText('0,981')).toBeTruthy());
    expect(train.mock.calls[0].slice(3)).toEqual(['poly', 3, null]);
    expect(train.mock.calls[0][1]).toEqual({
      T_source_out: 'T src',
      T_sink_out: 'T sink',
      COP: 'COP',
      refrigerant: 'Refrigerant',
    });
    expect(within(dialog).getByTestId('parity')).toBeTruthy();
    expect(within(dialog).getByText(/COP = 7.6/)).toBeTruthy();
    // The preview shows the file's first rows.
    expect(within(dialog).getByText('R600')).toBeTruthy();

    // Own range: beyond the data warns, an inverted range blocks "use".
    fireEvent.click(within(dialog).getByLabelText('Set my own range'));
    const sinkMax = within(dialog).getByDisplayValue('140');
    fireEvent.change(sinkMax, { target: { value: '170' } });
    expect(within(dialog).getByText(/goes beyond the data/)).toBeTruthy();
    fireEvent.change(sinkMax, { target: { value: '50' } });
    expect((within(dialog).getByText('Use this model') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(sinkMax, { target: { value: '120' } });
    fireEvent.click(within(dialog).getByText('Use this model'));
    const used = useAnalysisStore.getState().customCopModel!;
    expect(used.name).toBe('Plant data');
    expect(used.envelope.T_sink_max).toBe(120);

    // The trigger now names the model; the checkbox switches it off and on.
    expect(view.getByText('Plant data')).toBeTruthy();
    fireEvent.click(view.getByLabelText('Use the trained model'));
    expect(useAnalysisStore.getState().customCopModel?.enabled).toBe(false);
  });

  it('reads another sheet of an Excel file', async () => {
    inspect.mockResolvedValueOnce({
      sheets: ['Input_Data', 'Results'],
      sheet: 'Results',
      columns: ['T src', 'T sink', 'COP'],
      numeric_columns: ['T src', 'T sink', 'COP'],
      rows: 100,
      max_rows: 10000,
      min_rows: 30,
      preview: [],
      guess: { T_source_out: 'T src', T_sink_out: 'T sink', COP: 'COP' },
    });
    const view = render(<HPIOptimizationPanel />);
    fireEvent.click(view.getByText(/Train from my data/));
    const dialog = view.getByRole('dialog');
    fireEvent.change(dialog.querySelector('input[type=file]')!, {
      target: { files: [new File(['x'], 'study.xlsx')] },
    });
    await waitFor(() => within(dialog).getByDisplayValue('Results'));
    fireEvent.change(within(dialog).getByDisplayValue('Results'), {
      target: { value: 'Input_Data' },
    });
    await waitFor(() => expect(inspect).toHaveBeenLastCalledWith(expect.any(File), 'Input_Data'));
  });

  it('explains a bad mapping', async () => {
    const view = render(<HPIOptimizationPanel />);
    fireEvent.click(view.getByText(/Train from my data/));
    const dialog = view.getByRole('dialog');
    fireEvent.change(dialog.querySelector('input[type=file]')!, {
      target: { files: [new File(['x'], 'plant.csv')] },
    });
    await waitFor(() => within(dialog).getByText(/1512 rows/));
    const selects = dialog.querySelectorAll('select');
    fireEvent.change(selects[3], { target: { value: 'T src' } }); // only one inlet
    expect((within(dialog).getByText('Train') as HTMLButtonElement).disabled).toBe(true);
  });
});
