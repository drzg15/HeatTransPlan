import type { TFunction } from 'i18next';
import type { OptimizedIntegrationPoint } from '../../types/analysis';
import { boxPointOf } from './hpRules';
import type { PlotlyObject } from './plotlyTypes';

export interface HpBoxColors {
  source: string;
  sink: string;
  electricity: string;
  stroke: string;
  fill: string;
}

/** The heat pump schematic of the chart: the box, its labels and the legs that
 *  link it to the source and sink points. The legs are traces and go on the
 *  chart after everything else; the box and the labels are layout shapes and
 *  annotations. */
export function buildHpBox(
  activePoints: OptimizedIntegrationPoint[],
  srcSign: number,
  isDark: boolean,
  colors: HpBoxColors,
  t: TFunction
) {
  const { source: SOURCE_SOFT, sink: SINK_SOFT, electricity: EL_SOFT, stroke: HP_STROKE, fill: HP_FILL } = colors;
  const traces: PlotlyObject[] = [];
  // --- Heat pump schematic --------------------------------------------------
  // Source and sink can sit 3 kW apart or 1500 kW apart depending on profile
  // mode, so the box is sized in PIXELS and anchored to a data-space point.
  // That keeps it legible at any zoom without ever outgrowing the gap.
  const hpBoxShapes: PlotlyObject[] = [];
  const hpBoxAnnotations: PlotlyObject[] = [];

  // Only the most recently clicked pump gets a box. A click appends every
  // machine at that sink temperature to the end of the selection, so the last
  // entry's temperature is the one just clicked; the earlier selections stay
  // on the chart as enlarged markers and in the table.
  const boxPoint = boxPointOf(activePoints);
  const boxPoints = boxPoint ? [boxPoint] : [];

  for (const boxPoint of boxPoints) {
    const srcX = srcSign * ((boxPoint.Q_demand * (boxPoint.COP - 1)) / boxPoint.COP);
    const srcY = boxPoint.T_source;
    const snkX = boxPoint.Q_demand;
    const snkY = boxPoint.T_sink;

    // The box sits on the sink's x, halfway up the lift: the route is then a
    // clean rise-then-across, with no diagonal anywhere.
    const boxX = snkX;
    const boxY = (srcY + snkY) / 2;

    // The box holds two lines (HP + COP), so it needs the extra height.
    const halfW = 30;
    const halfH = 22;

    hpBoxShapes.push({
      type: 'rect',
      xref: 'x',
      yref: 'y',
      xsizemode: 'pixel',
      ysizemode: 'pixel',
      xanchor: boxX,
      yanchor: boxY,
      x0: -halfW,
      x1: halfW,
      y0: -halfH,
      y1: halfH,
      line: { color: HP_STROKE, width: 2 },
      fillcolor: HP_FILL,
      layer: 'above',
    });

    hpBoxAnnotations.push({
      x: boxX,
      y: boxY,
      xref: 'x',
      yref: 'y',
      // The primary box carries its COP, so the headline number is readable
      // without going to the table or hovering.
      text: `<b>HP</b><br>COP ${boxPoint.COP.toFixed(2)}`,
      showarrow: false,
      align: 'center' as const,
      font: { size: 10, color: HP_STROKE },
    });

    // Help marker beside the box. A DOM help button cannot be positioned at a
    // data coordinate, so this is an annotation carrying the explanation on
    // hover. It is an annotation rather than a trace because only annotations
    // support the pixel shift that keeps it clear of the box.
    hpBoxAnnotations.push({
      x: boxX,
      y: boxY,
      xref: 'x',
      yref: 'y',
      xshift: halfW + 12,
      yshift: halfH + 4,
      text: '💡',
      showarrow: false,
      font: { size: 13 },
      captureevents: true,
      hovertext: [
        `<b>${t('optimization.hp_box_title')}</b>`,
        '',
        t('optimization.hp_box_what'),
        '',
        `<b>${Math.abs(srcX).toFixed(1)} kW · ${srcY.toFixed(1)} °C</b> — ${t('optimization.hp_box_source')}`,
        `<b>P<sub>el</sub> ${(snkX - srcX).toFixed(1)} kW</b> — ${t('optimization.hp_box_el')}`,
        `<b>${snkX.toFixed(1)} kW · ${snkY.toFixed(1)} °C</b> — ${t('optimization.hp_box_sink')}`,
        `<b>COP ${boxPoint.COP.toFixed(2)}</b> — ${t('optimization.hp_box_cop')}`,
        '',
        t('optimization.hp_box_balance'),
      ].join('<br>'),
      hoverlabel: { align: 'left' as const, bgcolor: isDark ? '#1E293B' : '#FFF' },
    });

    // Endpoint readouts — duty and temperature at the source and the sink,
    // placed clear of the legs that meet there.
    hpBoxAnnotations.push({
      x: srcX,
      y: srcY,
      xref: 'x',
      yref: 'y',
      text: `${Math.abs(srcX).toFixed(1)} kW<br>${srcY.toFixed(1)} °C`,
      showarrow: false,
      xanchor: 'right' as const,
      yanchor: 'top' as const,
      align: 'right' as const,
      xshift: -8,
      yshift: -2,
      font: { size: 10, color: SOURCE_SOFT },
    });
    hpBoxAnnotations.push({
      x: snkX,
      y: snkY,
      xref: 'x',
      yref: 'y',
      text: `${snkX.toFixed(1)} kW<br>${snkY.toFixed(1)} °C`,
      showarrow: false,
      xanchor: 'left' as const,
      yanchor: 'bottom' as const,
      align: 'left' as const,
      xshift: 8,
      yshift: 2,
      font: { size: 10, color: SINK_SOFT },
    });

    // Source leg: across at the source temperature, then up into the box.
    traces.push({
    x: [srcX, boxX, boxX],
    y: [srcY, srcY, boxY],
    mode: 'lines' as const,
    line: { color: SOURCE_SOFT, width: 2 },
    showlegend: false,
    hoverinfo: 'skip' as const,
    });

    // Sink leg: straight up from the box to the sink point.
    traces.push({
    x: [boxX, snkX],
    y: [boxY, snkY],
    mode: 'lines' as const,
    line: { color: SINK_SOFT, width: 2 },
    showlegend: false,
    hoverinfo: 'skip' as const,
    });

    hpBoxAnnotations.push({
    x: boxX,
    y: snkY,
    ax: boxX,
    ay: snkY - (snkY - boxY) * 0.25,
    xref: 'x',
    yref: 'y',
    axref: 'x',
    ayref: 'y',
    showarrow: true,
    arrowhead: 3,
    arrowsize: 1.4,
    arrowwidth: 2,
    arrowcolor: SINK_SOFT,
    standoff: 8,
    text: '',
    });
    hpBoxAnnotations.push({
    x: boxX,
    y: boxY,
    ax: boxX,
    ay: boxY - (boxY - srcY) * 0.25,
    xref: 'x',
    yref: 'y',
    axref: 'x',
    ayref: 'y',
    showarrow: true,
    arrowhead: 3,
    arrowsize: 1.4,
    arrowwidth: 2,
    arrowcolor: SOURCE_SOFT,
    standoff: halfH + 1,
    text: '',
    });

    // Electrical input enters from the right, clear of the source leg. Only the
    // primary box is labelled — repeating it on every mini box is noise.
    hpBoxAnnotations.push({
      x: boxX,
      y: boxY,
      ax: 52,
      ay: 0,
      xref: 'x',
      yref: 'y',
      axref: 'pixel',
      ayref: 'pixel',
      showarrow: true,
      arrowhead: 3,
      arrowsize: 1.4,
      arrowwidth: 2,
      arrowcolor: EL_SOFT,
      standoff: halfW + 2,
      text: `<b>P<sub>el</sub> ${(snkX - srcX).toFixed(1)} kW</b>`,
      xanchor: 'left',
      font: { size: 10, color: EL_SOFT },
    });
  }

  return { traces, shapes: hpBoxShapes, annotations: hpBoxAnnotations };
}
