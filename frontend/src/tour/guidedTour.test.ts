/** The tour points at real controls: if a page drops one, or a step has no
 *  text, this fails and names the step, instead of the tour going quiet. */

import { describe, it, expect } from 'vitest';
import { TOUR, CHAPTERS, PART } from './guidedTour';
import en from '../locales/en.json';
import de from '../locales/de.json';

const sources = Object.entries(
  import.meta.glob('../**/*.tsx', { query: '?raw', import: 'default', eager: true })
)
  .filter(([path]) => !path.includes('/tour/'))
  .map(([, text]) => String(text))
  .join('\n');

describe('guided tour', () => {
  it('points only at classes the pages still have', () => {
    const missing = TOUR.flatMap((step) =>
      [...(step.element ?? '').matchAll(/\.([\w-]+)/g)]
        .map((m) => m[1])
        // Drawn by the map and chart libraries, not by our pages.
        .filter((cls) => !cls.startsWith('leaflet-') && !['subplot', 'xy', 'x2y'].includes(cls))
        .filter((cls) => !sources.includes(cls))
        .map((cls) => `${step.key}: .${cls}`)
    );
    expect(missing).toEqual([]);
  });

  it('has a title and a text for every step, in English and German', () => {
    const tours: Record<string, string>[] = [en.tour, de.tour];
    for (const texts of tours) {
      for (const step of TOUR) {
        // A part's title is the page's own (analysis.parts.*).
        if (!step.part) expect(texts[`${step.key}_title`], step.key).toBeTruthy();
        expect(texts[`${step.key}_text`], step.key).toBeTruthy();
      }
    }
  });

  it('finds the parts by the banners the page draws', () => {
    for (const cls of [PART.banner, PART.num]) expect(sources).toContain(cls.slice(1));
  });

  it('starts every chapter of the home page at a step', () => {
    for (const i of Object.values(CHAPTERS)) expect(i).toBeGreaterThanOrEqual(0);
  });
});

describe('guided tour in German', () => {
  it('counts steps in German', async () => {
    const { default: i18n } = await import('../i18n');
    expect(i18n.t('tour.progress', { lng: 'de', current: 3, total: 18 })).toBe('3 von 18');
    // ΔTmin is the same symbol in both languages.
    for (const step of TOUR.filter((s) => !s.part && s.key !== 'tmin'))
      expect(i18n.t(`tour.${step.key}_title`, { lng: 'de' })).not.toBe(
        i18n.t(`tour.${step.key}_title`, { lng: 'en' })
      );
  });
});
