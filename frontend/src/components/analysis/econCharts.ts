/** The economic analysis charts as Plotly specs (data + layout): investment,
 *  price paths, price sensitivity, economic pump size and net present value
 *  over time. Drawn from the backend's numbers (EconNumbers) by buildEconomics. */

import type { TFunction } from 'i18next';
import { formatDe } from '../../utils/numberFormat';
import type { OptimizedIntegrationPoint } from '../../types/analysis';
import type { EconInputs, EconNumbers } from '../../types/economics';
import { GREEN, RED, pointName, type Form } from './econConfig';

export type Fig = { data: any[]; layout: any };

/** What every chart is drawn from: the backend's numbers plus wording and theme. */
export type ChartCtx = Pick<
  EconNumbers,
  'refSys' | 'ref' | 'variants' | 'results' | 'breakEven' | 'points'
> & {
  n: EconNumbers;
  inp: EconInputs;
  t: TFunction;
  form: Form;
  isDark: boolean;
  fuel: string;
  refName: string;
  istName: string;
};

const COLORS = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#0891B2'];

/** Colours and the shared layout of every chart, light or dark. */
export function chartTheme(isDark: boolean) {
  const text = isDark ? '#F8FAFC' : '#1A1C1E';
  const surface = isDark ? '#1e293b' : '#ffffff';
  const axis = {
    automargin: true,
    gridcolor: isDark ? '#334155' : '#E2E8F0',
    tickfont: { color: isDark ? '#94A3B8' : '#5F6368' },
  };
  const layout = (title: string, extra: any = {}): any => ({
    title: { text: title, font: { size: 14, color: text } },
    height: 300,
    separators: ',.', // decimal ",", thousands "."
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { l: 64, r: 10, t: 32, b: 40 },
    legend: { orientation: 'h', y: -0.2, font: { color: text } },
    ...extra,
    xaxis: { ...axis, ...extra.xaxis },
    yaxis: { ...axis, ...extra.yaxis },
  });
  return { text, surface, layout };
}

/** Investment and cumulative cost, reference against the pump. */
export function investmentChart(c: ChartCtx): Fig {
  const { t, inp, ref, variants, results, points, isDark, istName } = c;
  const { surface, layout } = chartTheme(isDark);
  const names = [istName, ...points.map(pointName)];

  const bar: Fig = {
    data: [
      {
        type: 'bar',
        name: t('economics.charts.invest'),
        x: names,
        y: [0, ...variants.map((v) => v.capex)],
        // Gold / plum: hues no other chart here uses (blue and orange are the
        // electricity and gas lines next to it) that stay apart for colour-blind
        // readers. The surface-coloured outline leaves a gap between the parts.
        marker: { color: isDark ? '#C98500' : '#E0A100', line: { color: surface, width: 2 } },
      },
      {
        type: 'bar',
        name: t('economics.charts.cum_cost'),
        x: names,
        y: [ref.cumCost, ...results.map((r) => r.cumCost)],
        marker: { color: isDark ? '#B0558C' : '#8E3B6E', line: { color: surface, width: 2 } },
      },
      // Legend-only line: how much of the pump's total cost is the investment.
      ...variants.map((v, k) => ({
        type: 'scatter',
        mode: 'lines',
        x: [null],
        y: [null],
        line: { width: 0 },
        name: t('economics.charts.invest_share', {
          pct: formatDe((100 * v.capex) / Math.max(v.capex + results[k].cumCost, 1), 0),
          T: inp.T,
        }),
        hoverinfo: 'skip',
      })),
    ],
    layout: layout(t('economics.charts.bar_title', { T: inp.T }), {
      barmode: 'stack',
      yaxis: { title: { text: '€' }, tickformat: ',.0f' },
    }),
  };
  return bar;
}

/** Fuel and electricity price over the period. */
export function priceChart(c: ChartCtx): Fig {
  const { t, form, inp, fuel } = c;
  const { layout } = chartTheme(c.isDark);
  const years = Array.from({ length: inp.T + 1 }, (_, k) => form.year + k);

  const price: Fig = {
    data: (
      [
        [t('economics.charts.fuel_incl_co2', { fuel }), c.n.prices.fuel, '#D97706'],
        [t('economics.charts.el'), c.n.prices.el, '#2563EB'],
      ] as const
    ).map(([name, prices, color]) => ({
      type: 'scatter',
      mode: 'lines+markers',
      name,
      x: years,
      y: years.map((_, k) => prices[k] * 100),
      line: { color, width: 3 },
    })),
    layout: layout(t('economics.charts.price_title'), { yaxis: { title: { text: 'ct/kWh' } } }),
  };
  return price;
}

/** Net present value over fuel × electricity price, with the break-even line. */
export function sensitivityChart(c: ChartCtx): { sens: Fig; sensExplain: string } {
  const { t, form, breakEven, isDark, fuel, refName } = c;
  const { text, surface, layout } = chartTheme(isDark);
  // Sensitivity window: each price from 0 to twice today's (−100 % … +100 %),
  // so today's prices sit in the middle. The step is picked so each axis has at
  // most ~14 cells and every cell has room for its value.
  const idx = 0;
  // The backend lays out the window (sensBase or today's prices in the middle)
  // and computes every cell and the break-even line: the electricity price at
  // which KW = 0, per gas price. On its cheaper-electricity side the heat pump
  // beats the boiler.
  const { gasStep, gasCt, elStep, elCt, z, beX, beY } = c.n.sensitivity;
  const fuelAxis = t('economics.charts.fuel_price', { fuel });
  // The sentence above the heatmap, with today's numbers.
  const beNow = breakEven[idx];
  const sensExplain =
    beNow === null || beNow <= 0
      ? t('economics.sens_never', { fuel, pf: formatDe(form.pFuel, 2), ref: refName })
      : t('economics.sens_explain', {
          fuel,
          pf: formatDe(form.pFuel, 2),
          pe: formatDe(100 * beNow, 2),
        });
  // Cells coloured by Kapitalwert in soft tones (light red → near-white at 0 →
  // light green, deeper with the amount), split by the break-even line, today's
  // prices as a dot, the Kapitalwert written in every cell.
  const xLo = gasCt[0] - gasStep / 2;
  const xHi = gasCt[gasCt.length - 1] + gasStep / 2;
  const yLo = elCt[0] - elStep / 2; // cheapest electricity, top of the chart
  const yHi = elCt[elCt.length - 1] + elStep / 2;
  const mid = isDark ? '#2a2f3a' : '#FAFAF8';
  const sensTitle = t('economics.charts.sens_title', { funding: form.funding, fuel });
  const sens: Fig = {
    data: [
      {
        type: 'heatmap',
        x: gasCt,
        y: elCt,
        z,
        zmid: 0,
        colorscale: [
          [0, isDark ? '#c62828' : '#E57373'],
          [0.35, isDark ? '#6d2b2b' : '#FFCDD2'],
          [0.5, mid],
          [0.65, isDark ? '#2e5a31' : '#C8E6C9'],
          [1, isDark ? '#2e7d32' : '#66BB6A'],
        ],
        // Thin gaps in the surface colour draw the cell borders.
        xgap: 1,
        ygap: 1,
        texttemplate: '%{z:,.0f}',
        textfont: { size: 10, color: text },
        colorbar: { title: { text: '€' }, tickformat: ',.0f', thickness: 12 },
        hovertemplate: `${fuelAxis}: %{x} ct/kWh<br>${t('economics.charts.el')}: %{y} ct/kWh<br>${t('economics.rows.npv')}: %{z:,.0f} €<extra></extra>`,
        showlegend: false,
      },
      {
        type: 'scatter',
        mode: 'lines',
        x: beX,
        y: beY,
        name: t('economics.charts.breakeven'),
        line: { color: text, width: 3, dash: 'dash' },
        hovertemplate: `${t('economics.charts.breakeven')}<br>${fuelAxis}: %{x:,.1f} ct/kWh<br>${t('economics.charts.el')}: %{y:,.2f} ct/kWh<extra></extra>`,
      },
      {
        type: 'scatter',
        mode: 'markers',
        x: [form.pFuel],
        y: [form.pEl],
        name: t('economics.charts.today'),
        marker: { size: 14, color: text, line: { color: surface, width: 2 } },
        hovertemplate: `${t('economics.charts.today')}<br>${fuelAxis}: %{x:,.2f} ct/kWh<br>${t('economics.charts.el')}: %{y:,.2f} ct/kWh<extra></extra>`,
      },
      // Legend-only entries explaining the cell colours, in the map's order:
      // the reference wins on the left (cheap fuel), the heat pump on the right.
      ...(
        [
          [isDark ? '#c62828' : '#E57373', t('economics.charts.side_ref', { ref: refName })],
          [isDark ? '#2e7d32' : '#66BB6A', t('economics.charts.side_hp')],
        ] as const
      ).map(([color, name]) => ({
        type: 'scatter',
        mode: 'markers',
        x: [null],
        y: [null],
        name,
        marker: { symbol: 'square', size: 12, color },
        hoverinfo: 'skip',
      })),
    ],
    layout: layout(sensTitle, {
      // Taller when there are more rows, so written values stay readable.
      height: Math.max(460, 150 + 24 * elCt.length),
      // The top axis and its title need room below the chart title.
      margin: { l: 90, r: 20, t: 110, b: 30 },
      title: { text: sensTitle, font: { size: 14, color: text }, y: 0.98 },
      // Fixed ranges so the line is clipped to the price window.
      // Electricity runs top-down, as on the slides.
      xaxis: {
        title: { text: `${fuelAxis} [ct/kWh]`, standoff: 8 },
        side: 'top',
        dtick: gasStep,
        ticksuffix: ' ct',
        range: [xLo, xHi],
        fixedrange: true,
        showgrid: false,
      },
      yaxis: {
        title: { text: `${t('economics.charts.el')} [ct/kWh]` },
        dtick: elStep,
        ticksuffix: ' ct',
        range: [yHi, yLo],
        fixedrange: true,
        showgrid: false,
      },
      legend: { orientation: 'h', y: -0.04, font: { color: text } },
    }),
  };
  return { sens, sensExplain };
}

/** Net present value of every pump size on the optimization curve. */
export function sizeChart(c: ChartCtx): {
  size: Fig;
  sizeExplain: string;
  sizes: { p: OptimizedIntegrationPoint; npv: number }[];
} {
  const { t, refSys, results, points, isDark, refName } = c;
  const { text, surface, layout } = chartTheme(isDark);
  // Economic heat pump size: every working pump on the optimisation curve,
  // costed with the same inputs. A smaller pump costs less but leaves more of
  // the demand on the old heater; the Kapitalwert weighs both. Per size (1 %
  // of the demand) the backend keeps the best machine, so the line is the best
  // you can do at each size and its peak is the economic optimum.
  const sizes = c.n.size.sizes.map((s) => ({ p: s.point, npv: s.npv }));
  const optimum = c.n.size.optimum && { p: c.n.size.optimum.point, npv: c.n.size.optimum.npv };
  const analysed = points[0];
  const analysedNpv = results[0]?.npv;
  const sizeHover = (p: OptimizedIntegrationPoint) =>
    [
      pointName(p),
      `${t('economics.charts.size_hp')}: ${formatDe(p.Q_demand)} kW (${formatDe((100 * p.Q_demand) / refSys.Q, 0)} %)`,
      `${t('economics.charts.size_rest', { ref: refName })}: ${formatDe(Math.max(refSys.Q - p.Q_demand, 0))} kW`,
      `COP: ${formatDe(p.COP, 2)}`,
    ].join('<br>');
  const size: Fig = {
    data: [
      {
        type: 'scatter',
        mode: 'lines+markers',
        x: sizes.map((s) => s.p.Q_demand),
        y: sizes.map((s) => s.npv),
        name: t('economics.charts.size_curve'),
        line: { color: isDark ? '#94A3B8' : '#9AA0A6', width: 2 },
        marker: { size: 7, color: sizes.map((s) => (s.npv < 0 ? RED : GREEN)) },
        customdata: sizes.map((s) => sizeHover(s.p)),
        hovertemplate: `%{customdata}<br>${t('economics.rows.npv')}: %{y:,.0f} €<extra></extra>`,
      },
      ...(optimum
        ? [
            {
              type: 'scatter',
              mode: 'markers',
              x: [optimum.p.Q_demand],
              y: [optimum.npv],
              name: t('economics.charts.size_optimum'),
              marker: {
                symbol: 'diamond',
                size: 16,
                color: '#E0A100',
                line: { color: text, width: 1 },
              },
              customdata: [sizeHover(optimum.p)],
              hovertemplate: `<b>${t('economics.charts.size_optimum')}</b><br>%{customdata}<br>${t('economics.rows.npv')}: %{y:,.0f} €<extra></extra>`,
            },
          ]
        : []),
      ...(analysed && analysedNpv !== undefined
        ? [
            {
              type: 'scatter',
              mode: 'markers',
              x: [analysed.Q_demand],
              y: [analysedNpv],
              name: t('economics.charts.size_analysed'),
              marker: { size: 13, color: text, line: { color: surface, width: 2 } },
              customdata: [sizeHover(analysed)],
              hovertemplate: `<b>${t('economics.charts.size_analysed')}</b><br>%{customdata}<br>${t('economics.rows.npv')}: %{y:,.0f} €<extra></extra>`,
            },
          ]
        : []),
    ],
    layout: layout(t('economics.charts.size_title', { ref: refName }), {
      height: 360,
      xaxis: {
        title: { text: t('economics.charts.size_x', { q: formatDe(refSys.Q) }) },
        ticksuffix: ' kW',
        tickformat: ',.0f',
      },
      yaxis: {
        title: { text: `${t('economics.rows.npv')} [€]` },
        tickformat: ',.0f',
        zeroline: true,
        zerolinewidth: 2,
      },
    }),
  };
  const sizeExplain = optimum
    ? t('economics.size_explain', {
        q: formatDe(refSys.Q),
        ref: refName,
        qopt: formatDe(optimum.p.Q_demand),
        pct: formatDe((100 * optimum.p.Q_demand) / refSys.Q, 0),
        name: pointName(optimum.p),
        cop: formatDe(optimum.p.COP, 2),
        npv: formatDe(optimum.npv),
      })
    : t('economics.size_none');
  return { size, sizeExplain, sizes };
}

/** Net present value year by year, with the year each pump pays off. */
export function npvChart(c: ChartCtx): Fig {
  const { t, form, inp, points, fuel } = c;
  const { text, layout } = chartTheme(c.isDark);
  // Kapitalwert over time for every pump at the selected prices (clicking the
  // heatmap changes them). Run past T up to the payback horizon, so the year a
  // pump turns profitable shows even when that is after T.
  // Up to T the curve is the period's own, so its last point is the Kapitalwert:
  // the longer run would buy a replacement at the end of the service life
  // (year T when T = life), which the period does not.
  // Each run's zero crossing is interpolated between the two years around it.
  const { runs, crossings, kMax } = c.n.npv;
  const horizon = c.n.horizon;
  const tYears = Array.from({ length: kMax + 1 }, (_, j) => form.year + j);
  const crossingText = (c: number | null) =>
    c === null
      ? t('economics.charts.never', { years: horizon })
      : t('economics.charts.profitable_from', {
          year: formatDe(form.year + c, 1, false),
          years: formatDe(c, 1),
        });
  const npv: Fig = {
    data: runs
      .map((r, k) => {
        const y = r.slice(0, kMax + 1);
        return {
          type: 'scatter',
          mode: 'lines+markers',
          // The legend says when each pump pays off, so it reads without hovering.
          name: `${pointName(points[k])} – ${crossingText(crossings[k])}`,
          x: tYears,
          y,
          line: { color: COLORS[k % COLORS.length], width: 2 },
          // Red while the investment is not yet paid back, green from then on.
          marker: { size: 7, color: y.map((v) => (v < 0 ? RED : GREEN)) },
          hovertemplate: `${pointName(points[k])}<br>%{x}: %{y:,.0f} €<extra></extra>`,
        } as any;
      })
      .concat(
        // Legend-only entries for the marker colours and the period line.
        [
          {
            type: 'scatter',
            mode: 'markers',
            marker: { size: 9, color: RED },
            name: t('economics.charts.not_paid_back'),
          },
          {
            type: 'scatter',
            mode: 'markers',
            marker: { size: 9, color: GREEN },
            name: t('economics.charts.paid_back'),
          },
          {
            type: 'scatter',
            mode: 'lines',
            line: { color: text, width: 1, dash: 'dot' },
            name: t('economics.charts.period_line', { T: inp.T }),
          },
        ].map((tr) => ({ ...tr, x: [null], y: [null], hoverinfo: 'skip' }))
      ),
    layout: layout(
      t('economics.charts.time_title', {
        fuel,
        gas: formatDe(form.pFuel, 2),
        el: formatDe(form.pEl, 2),
      }),
      {
        showlegend: true,
        yaxis: { title: { text: '€' }, tickformat: ',.0f', zeroline: true, zerolinewidth: 2 },
        // Whole years, spaced by Plotly to fit the width (the report draws it narrower).
        xaxis: { tickformat: 'd' },
        shapes: [
          // End of the Betrachtungszeitraum, named in the legend. A text label
          // here would stretch the axis to fit it.
          {
            type: 'line',
            x0: form.year + inp.T,
            x1: form.year + inp.T,
            yref: 'paper',
            y0: 0,
            y1: 1,
            line: { color: text, width: 1, dash: 'dot' },
          },
        ],
        annotations: [
          // One arrow per pump at its break-even year, staggered so they don't stack.
          ...crossings.flatMap((c, k) =>
            c === null
              ? []
              : [
                  {
                    x: form.year + c,
                    y: 0,
                    text: formatDe(form.year + c, 1, false),
                    showarrow: true,
                    arrowhead: 2,
                    arrowcolor: COLORS[k % COLORS.length],
                    ay: -30 - 22 * k,
                    font: { color: text, size: 11 },
                  },
                ]
          ),
        ],
      }
    ),
  };
  return npv;
}
