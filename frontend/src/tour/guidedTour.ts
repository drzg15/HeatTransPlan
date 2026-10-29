/** The guided tour: it points at the real controls of the pages, step by
 *  step, so it never shows an outdated picture. One list of steps; the texts
 *  are in the locale files (tour.<key>_title / _text). A step whose element
 *  is missing shows its text in the middle of the screen instead.
 *
 *  driver.js is pinned to 1.4.0, the last release from its author's own
 *  repository; it has no dependencies and runs nothing at install. */

import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import type { TFunction } from 'i18next';
import './guidedTour.css';

export interface TourStep {
  key: string;
  page: string;
  /** CSS selector of what to point at; none: a text in the middle. */
  element?: string;
  /** One of the app's numbered steps: its banner, titled as on the page. */
  part?: PartNumber;
}

const DC = '/data-collection';
const PA = '/potential-analysis';

/** The banners of the app's numbered steps (components/ui/Part.tsx). */
export const PART = { banner: '.pa-part-banner', num: '.pa-part-num' };

/** The app's steps as their banners show them: number, title, input. Each
 *  takes the result of the one before. The home page reads them too. */
export const PARTS = {
  1: { title: 'appshell.nav.data_collection', input: 'data_collection.part_in' },
  2: { title: 'analysis.parts.integration', input: 'analysis.parts.integration_in' },
  3: { title: 'analysis.parts.heat_pump', input: 'analysis.parts.heat_pump_in' },
  4: { title: 'analysis.parts.costs', input: 'analysis.parts.costs_in' },
} as const;
export type PartNumber = keyof typeof PARTS;

/** In the order of the app: Data Collection (step 1), the three parts of
 *  Potential Analysis (2–4), then the results. */
export const TOUR: TourStep[] = [
  { key: 'collect', page: DC, part: 1 },
  { key: 'search', page: DC, element: '.ab-search' },
  { key: 'buttons', page: DC, element: '.ab-group-primary' },
  { key: 'processes', page: DC, element: '.dc-left' },
  { key: 'map', page: DC, element: '.dc-right .leaflet-container' },
  { key: 'table', page: DC, element: '.stream-data-table' },
  { key: 'integration', page: PA, part: 2 },
  { key: 'streams', page: PA, element: '.pa-col-streams' },
  { key: 'demands', page: PA, element: '.pa-col-demands' },
  { key: 'tmin', page: PA, element: '.pa-tmin-label' },
  { key: 'pinch', page: PA, element: '.pa-chart' },
  { key: 'heat_pump', page: PA, part: 3 },
  { key: 'heat_pumps', page: PA, element: '.pa-opt-row' },
  { key: 'costs', page: PA, part: 4 },
  { key: 'econ_inputs', page: PA, element: '.econ-assumptions' },
  { key: 'economics', page: PA, element: '.econ-results' },
  { key: 'scenarios', page: PA, element: '.pa-scenario-bar' },
  { key: 'report', page: PA, element: '.pa-btn-report' },
  { key: 'done', page: PA },
];

/** Where each card of "How it works" on the home page starts the tour. */
export const CHAPTERS = {
  collect: TOUR.findIndex((s) => s.key === 'collect'),
  integration: TOUR.findIndex((s) => s.key === 'integration'),
  heat_pump: TOUR.findIndex((s) => s.key === 'heat_pump'),
  costs: TOUR.findIndex((s) => s.key === 'costs'),
  results: TOUR.findIndex((s) => s.key === 'scenarios'),
};

/** What a step points at, if the page shows it now. */
function target(step: TourStep): Element | undefined {
  if (step.part)
    return [...document.querySelectorAll(PART.banner)].find(
      (b) => b.querySelector(PART.num)?.textContent?.trim() === String(step.part)
    );
  return step.element ? (document.querySelector(step.element) ?? undefined) : undefined;
}

/** Wait until the page has drawn it (charts appear after the analysis runs). */
async function waitFor(step: TourStep, ms = 10_000): Promise<void> {
  const end = Date.now() + ms;
  while (!target(step) && Date.now() < end) await new Promise((r) => setTimeout(r, 150));
}

let active: Driver | null = null;

/** Start the tour at a step; navigate goes to the step's page. */
export function startTour(navigate: (path: string) => void, t: TFunction, from = 0) {
  active?.destroy();
  const tour = driver({
    showProgress: true,
    // driver.js fills in {{current}} and {{total}} itself.
    progressText: t('tour.progress', { current: '{{current}}', total: '{{total}}' }),
    nextBtnText: t('tour.next'),
    prevBtnText: t('tour.back'),
    doneBtnText: t('tour.finish'),
    smoothScroll: true,
    allowClose: true,
    popoverClass: 'htp-tour',
    steps: TOUR.map((s) => ({
      // A part's banner is found by its number; missing: the text in the middle.
      element: s.part || s.element ? () => target(s) as Element : undefined,
      popover: {
        title: s.part ? `${s.part} · ${t(PARTS[s.part].title)}` : t(`tour.${s.key}_title`),
        description: t(`tour.${s.key}_text`),
      },
    })),
    onNextClick: () => void go((tour.getActiveIndex() ?? -1) + 1),
    onPrevClick: () => void go((tour.getActiveIndex() ?? 1) - 1),
    onDestroyed: () => {
      if (active === tour) active = null;
    },
  });
  active = tour;

  async function go(i: number) {
    if (i < 0) return;
    if (i >= TOUR.length) return tour.destroy();
    const step = TOUR[i];
    if (window.location.pathname !== step.page) navigate(step.page);
    if (step.element || step.part) await waitFor(step);
    if (active !== tour) return;
    if (tour.isActive()) tour.moveTo(i);
    else tour.drive(i);
  }

  void go(from);
}
