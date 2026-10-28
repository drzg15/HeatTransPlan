/** Pins the whole economic analysis — tables, key results, summaries and every
 *  chart spec — for real optimization output, each reference system, both
 *  themes and both languages. A refactoring that moves a number, a colour or a
 *  word fails here. */

import { describe, it, expect, beforeEach } from 'vitest';
import i18n from '../../i18n';
import type { HPIOptimizationResult, OptimizedIntegrationPoint } from '../../types/analysis';
import fixture from '../../test/fixtures/optimization.json';
import { buildEconomics, econCore, econReportData, pickPump } from './econModel';
import { DEFAULTS, type RefType } from './econConfig';
import { dump } from '../../test/dump';

const opt = fixture.optimization as unknown as HPIOptimizationResult;
const real = opt.feasible_points.filter((p) => !p.theoretical);
const picks: Record<string, OptimizedIntegrationPoint[]> = {
  none: [],
  one: [real[5]],
  several: [real[2], real[9], opt.feasible_points.find((p) => p.theoretical)!],
};
const REFS: RefType[] = ['gas', 'oil', 'eboiler'];

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('economic model', () => {
  for (const ref of REFS) {
    for (const [name, sel] of Object.entries(picks)) {
      it(`buildEconomics ${ref} ${name}`, () => {
        expect(dump(buildEconomics(i18n.t, DEFAULTS, ref, sel, opt))).toMatchSnapshot();
      });
    }
  }

  it('dark theme and a fixed sensitivity window', () => {
    expect(
      dump(buildEconomics(i18n.t, DEFAULTS, 'gas', picks.one, opt, true, { fuel: 6, el: 20 }))
    ).toMatchSnapshot();
  });

  it('changed inputs', () => {
    const form = { ...DEFAULTS, specCost: 1500, funding: 40, co2ElPriced: 1, T: 15 };
    expect(dump(buildEconomics(i18n.t, form, 'oil', picks.several, opt))).toMatchSnapshot();
  });

  it('German report data', async () => {
    await i18n.changeLanguage('de');
    expect(dump(econReportData(i18n.t, DEFAULTS, 'gas', picks.several, opt))).toMatchSnapshot();
  });

  it('report data, core and pump choice', () => {
    expect(dump(econReportData(i18n.t, DEFAULTS, 'eboiler', picks.one, opt))).toMatchSnapshot();
    expect(dump(econCore(DEFAULTS, 'gas', [], opt))).toMatchSnapshot();
    expect(dump(Object.values(picks).map((s) => pickPump(s, opt)))).toMatchSnapshot();
    expect(buildEconomics(i18n.t, DEFAULTS, 'gas', [], null)).toBeNull();
  });
});
