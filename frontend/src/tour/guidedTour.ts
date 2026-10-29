/** The guided tour: it points at the real controls of the pages, step by
 *  step, so it never shows an outdated picture. One list of steps; the texts
 *  are in the locale files (tour.<key>_title / _text). Each text appears next
 *  to what it explains; Back and Next sit in a bar that never moves. A step
 *  whose control the page does not show right now is skipped.
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
  /** Drawn only once the analysis has run: worth waiting a little longer for. */
  late?: boolean;
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
  { key: 'toolbar', page: DC, element: '.action-bar' },
  { key: 'processes', page: DC, element: '.dc-left' },
  { key: 'map', page: DC, element: '.dc-right .leaflet-container' },
  { key: 'table', page: DC, element: '.stream-data-table' },
  { key: 'integration', page: PA, part: 2 },
  { key: 'streams', page: PA, element: '.pa-col-streams' },
  { key: 'demands', page: PA, element: '.pa-col-demands' },
  { key: 'tmin', page: PA, element: '.pa-tmin-label' },
  // One chart, two plots (Plotly's subplots): left the composite curves, right the GCC.
  { key: 'composite', page: PA, element: '.pa-chart .subplot.xy', late: true },
  { key: 'gcc', page: PA, element: '.pa-chart .subplot.x2y', late: true },
  { key: 'heat_pump', page: PA, part: 3, late: true },
  { key: 'heat_pumps', page: PA, element: '.pa-opt-row', late: true },
  { key: 'costs', page: PA, part: 4, late: true },
  { key: 'econ_inputs', page: PA, element: '.econ-assumptions', late: true },
  { key: 'economics', page: PA, element: '.econ-results', late: true },
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

/** Wait until the page has drawn it; false if it does not in time (the
 *  control is not shown in this state, e.g. the search with the map locked). */
async function waitFor(step: TourStep): Promise<boolean> {
  const end = Date.now() + (step.late ? 15_000 : 2_000);
  while (!target(step)) {
    if (Date.now() > end) return false;
    await new Promise((r) => setTimeout(r, 150));
  }
  return true;
}

/** The fixed bar with Back, the step count, Next and Close. driver.js blocks
 *  clicks outside its popover while a tour runs; guidedTour.css lets this
 *  bar through. */
function makeBar(t: TFunction, onBack: () => void, onNext: () => void, onClose: () => void) {
  const bar = document.createElement('div');
  bar.className = 'htp-tour-bar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', t('tour.bar'));
  const button = (cls: string, label: string, onClick: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  };
  const back = button('htp-tour-back', `◀ ${t('tour.back')}`, onBack);
  const count = document.createElement('span');
  count.className = 'htp-tour-count';
  const next = button('htp-tour-next', '', onNext);
  const close = button('htp-tour-close', '✕', onClose);
  close.setAttribute('aria-label', t('tour.close'));
  close.title = t('tour.close');
  bar.append(back, count, next, close);
  document.body.append(bar);
  return {
    show(i: number, waiting: boolean) {
      back.disabled = i <= 0 || waiting;
      next.disabled = waiting;
      next.textContent = waiting
        ? '…'
        : i >= TOUR.length - 1
          ? t('tour.finish')
          : `${t('tour.next')} ▶`;
      count.textContent = t('tour.progress', { current: i + 1, total: TOUR.length });
    },
    remove: () => bar.remove(),
  };
}

let active: Driver | null = null;

/** Start the tour at a step; navigate goes to the step's page. */
export function startTour(navigate: (path: string) => void, t: TFunction, from = 0) {
  active?.destroy();
  let index = from;
  let moving = false;
  const tour = driver({
    // The popover carries only the text; the bar below has the buttons.
    showButtons: [],
    smoothScroll: true,
    allowClose: true,
    popoverClass: 'htp-tour',
    steps: TOUR.map((s) => ({
      // A part's banner is found by its number.
      element: s.part || s.element ? () => target(s) as Element : undefined,
      popover: {
        title: s.part ? `${s.part} · ${t(PARTS[s.part].title)}` : t(`tour.${s.key}_title`),
        description: t(`tour.${s.key}_text`),
      },
    })),
    // The arrow keys come here too.
    onNextClick: () => void go(index + 1, 1),
    onPrevClick: () => void go(index - 1, -1),
    onDestroyed: () => {
      bar.remove();
      if (active === tour) active = null;
    },
  });
  active = tour;
  const bar = makeBar(
    t,
    () => void go(index - 1, -1),
    () => void go(index + 1, 1),
    () => end()
  );

  /** However the tour ends, the bar goes with it (also before driver.js started). */
  function end() {
    if (tour.isActive()) tour.destroy();
    bar.remove();
    if (active === tour) active = null;
  }

  async function go(i: number, dir: 1 | -1) {
    if (moving || i < 0) return;
    if (i >= TOUR.length) return end();
    moving = true;
    bar.show(i, true);
    try {
      for (;;) {
        const step = TOUR[i];
        if (window.location.pathname !== step.page) navigate(step.page);
        if (!(step.element || step.part) || (await waitFor(step))) break;
        // Not on the page in this state: on to the next one.
        i += dir;
        if (i < 0 || i >= TOUR.length) return end();
      }
      if (active !== tour) return;
      index = i;
      if (tour.isActive()) tour.moveTo(i);
      else tour.drive(i);
    } finally {
      moving = false;
      if (active === tour) bar.show(index, false);
    }
  }

  void go(from, 1);
}
