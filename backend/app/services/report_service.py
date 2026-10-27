"""
Report generation service — produces self-contained HTML report.
Includes detailed pages for every saved scenario and a comparison overview.
"""

from __future__ import annotations
from datetime import datetime
from html import escape
from typing import Any, Dict, List, Optional

import plotly.graph_objects as go
import plotly.io as pio
from app.models.report import ReportRequest, ScenarioReportData, ReportStream
from app.services.map_service import generate_process_map_b64


I18N = {
    "en": {
        "report_title": "Heat Integration Report",
        "generated": "Generated",
        "data_collection": "Data Collection",
        "process_maps": "Process Level Maps",
        "collected_data": "Collected Data",
        "notes": "Data Collection Notes",
        "no_notes": "No notes recorded.",
        "process": "Process",
        "subprocess": "Subprocess",
        "stream": "Stream",
        "type": "Type",
        "hot": "Hot",
        "cold": "Cold",
        "analysis": "Analysis",
        "not_enough_streams": "Not enough streams selected for pinch analysis in this scenario.",
        "min_heating": "Min. Heating Demand",
        "min_cooling": "Min. Cooling Demand",
        "pinch_temp": "Pinch Temperature",
        "heat_recovery": "Heat Recovery",
        "comparison": "Comparison",
        "status_quo": "Status Quo",
        "savings": "Savings",
        "hp_hdr": "HP Coverage",
        "hp_hdr_kw": "HP – {name} (kW)",
        "hp_integration": "Heat Pump Integration",
        "hp_table_hdr": "Heat Pump",
        "diagrams": "Diagrams",
        "scenario": "Scenario",
        "comparison_summary": "Scenario Comparison",
        "utilities_comparison": "Utilities Comparison",
        "composite_title": "Composite Curves",
        "gcc_title": "Grand Composite Curve",
        "hpi_title": "Heat Pump Integration",
        "selected_streams": "Selected Streams",
        "process_layout": "Process Layout",
        "all_streams": "All streams",
        "min_after_hr": "Min. after HR",
        "t_source": "T_source",
        "t_sink": "T_sink",
        "q_source": "Q_source",
        "q_sink": "Q_sink",
        "q_demand": "Q_demand",
        "opt_hp": "Optimization Heat Pump",
        "medium_sink": "Medium Sink",
        "refrigerant": "Refrigerant",
        "opt_hp_title": "Optimization - Feasible Heat Pump Solutions",
        "orig_gcc": "Original GCC",
        "heat_source_pocketless": "Heat Source (Pocketless)",
        "heat_sink_pocketless": "Heat Sink (Pocketless)",
        "active_sink": "Active Sink",
        "active_source": "Active Source",
        "shifted_t": "Shifted T (°C)",
        "net_delta_h": "Net ΔH (kW)",
        "heat_capacity_q": "Heat Capacity Q (kW)",
        "temperature": "Temperature (°C)",
        "source_profile": "Source profile",
        "sink_profile": "Sink profile",
        "net_enthalpy": "Net Enthalpy flow in kW",
        "q_source_sink": "Q̇  ← source | sink →  (kW)",
        "shifted_temp": "Shifted Temperature in °C",
        "pinch_label": "Pinch: ",
        "real": "Real",
        "theoretical": "Theoretical",
        "hp_table_title": "Integration with Heat Pump model and optimization",
        "hdr_type": "TYPE",
        "hdr_refrig": "REFRIG.",
        "hdr_medium_sink": "MEDIUM SINK",
        "hdr_q_sink": "Q_SINK (KW)",
        "hdr_q_source": "Q_SOURCE (KW)",
        "hdr_p_el": "P_EL (KW)",
        "hdr_actual_sink": "Actual Sink Temp [\u00b0C]",
        "hdr_shifted_sink": "Shifted Sink (T+{half}K) [\u00b0C]",
        "hdr_actual_source": "Actual Source Temp [\u00b0C]",
        "hdr_shifted_source": "Shifted Source (T-{half}K) [\u00b0C]",
        "hdr_refrigerant": "REFRIGERANT",
        "hdr_hp_stages": "HP STAGES",
        "carnot_50": "Carnot (50 %)",
        "map_not_avail": "Map not available",
        "econ_title": "Economic analysis",
        "econ_invest": "Investment (€)",
        "econ_npv": "Net present value (€)",
        "econ_payback": "Dynamic payback",
        "econ_saving1": "Cost saving year 1 (€/year)",
        "econ_years": "years",
        "econ_never": "not within 40 years",
        "econ_npv_title": "Net present value per scenario"
    },
    "de": {
        "report_title": "Wärmeintegrationsbericht",
        "generated": "Erstellt",
        "data_collection": "Datenerfassung",
        "process_maps": "Prozesskarten",
        "collected_data": "Erfasste Daten",
        "notes": "Notizen zur Datenerfassung",
        "no_notes": "Keine Notizen erfasst.",
        "process": "Prozess",
        "subprocess": "Teilprozess",
        "stream": "Strom",
        "type": "Typ",
        "hot": "Heiß",
        "cold": "Kalt",
        "analysis": "Analyse",
        "not_enough_streams": "Nicht genügend Ströme für die Pinch-Analyse in diesem Szenario ausgewählt.",
        "min_heating": "Min. Heizbedarf",
        "min_cooling": "Min. Kühlbedarf",
        "pinch_temp": "Pinch-Temperatur",
        "heat_recovery": "Wärmerückgewinnung",
        "comparison": "Vergleich",
        "status_quo": "Ist-Zustand",
        "savings": "Einsparung",
        "hp_hdr": "WP-Abdeckung",
        "hp_hdr_kw": "WP – {name} (kW)",
        "hp_integration": "Wärmepumpen-Integration",
        "hp_table_hdr": "Wärmepumpe",
        "diagrams": "Diagramme",
        "scenario": "Szenario",
        "comparison_summary": "Szenarienvergleich",
        "utilities_comparison": "Vergleich von Heiz- und Kühlbedarf",
        "composite_title": "Verbundkurven",
        "gcc_title": "Großverbundkurve",
        "hpi_title": "Wärmepumpen-Integration",
        "selected_streams": "Ausgewählte Ströme",
        "process_layout": "Prozess-Layout",
        "all_streams": "Alle Ströme",
        "min_after_hr": "Min. nach WRG",
        "t_source": "T_Quelle",
        "t_sink": "T_Senke",
        "q_source": "Q_Quelle",
        "q_sink": "Q_Senke",
        "q_demand": "Q_Bedarf",
        "opt_hp": "Optimierte Wärmepumpe",
        "medium_sink": "Senkenmedium",
        "refrigerant": "Kältemittel",
        "opt_hp_title": "Optimierung – Realisierbare Wärmepumpenlösungen",
        "orig_gcc": "Ursprüngliche Großverbundkurve",
        "heat_source_pocketless": "Wärmequelle (ohne Taschen)",
        "heat_sink_pocketless": "Wärmesenke (ohne Taschen)",
        "active_sink": "Aktive Senke",
        "active_source": "Aktive Quelle",
        "shifted_t": "Verschobene T (°C)",
        "net_delta_h": "Netto-Wärmestrom ΔH (kW)",
        "heat_capacity_q": "Wärmestrom Q (kW)",
        "temperature": "Temperatur (°C)",
        "source_profile": "Quellenprofil",
        "sink_profile": "Senkenprofil",
        "net_enthalpy": "Netto-Enthalpiestrom in kW",
        "q_source_sink": "Q̇  ← Quelle | Senke →  (kW)",
        "shifted_temp": "Verschobene Temperatur in °C",
        "pinch_label": "Pinch: ",
        "real": "Real",
        "theoretical": "Theoretisch",
        "hp_table_title": "Integration mit W\u00e4rmepumpenmodell und Optimierung",
        "hdr_type": "TYP",
        "hdr_refrig": "K\u00c4LTEM.",
        "hdr_medium_sink": "MEDIUM SENKE",
        "hdr_q_sink": "Q_SENKE (KW)",
        "hdr_q_source": "Q_QUELLE (KW)",
        "hdr_p_el": "P_EL (KW)",
        "hdr_actual_sink": "Senkentemperatur [\u00b0C]",
        "hdr_shifted_sink": "Verschobene Senke (T+{half}K) [\u00b0C]",
        "hdr_actual_source": "Quellentemperatur [\u00b0C]",
        "hdr_shifted_source": "Verschobene Quelle (T-{half}K) [\u00b0C]",
        "hdr_refrigerant": "K\u00c4LTEMITTEL",
        "hdr_hp_stages": "ANZ. VERDICHTER",
        "carnot_50": "Carnot (50 %)",
        "map_not_avail": "Karte nicht verfügbar",
        "econ_title": "Wirtschaftlichkeitsbetrachtung",
        "econ_invest": "Investition (€)",
        "econ_npv": "Kapitalwert (€)",
        "econ_payback": "Dynamische Amortisationszeit",
        "econ_saving1": "Kosteneinsparung Jahr 1 (€/Jahr)",
        "econ_years": "Jahre",
        "econ_never": "nicht innerhalb von 40 Jahren",
        "econ_npv_title": "Kapitalwert je Szenario"
    }
}

def _fmt(val: Any, decimals: int = 2) -> str:
    """Format a numeric value, return '' if None."""
    if val is None or val == '':
        return ''
    try:
        return f"{float(val):.{decimals}f}"
    except (ValueError, TypeError):
        return str(val)


# Colours of the optimization chart on the Potential Analysis page. The report
# renders the same chart, so the two have to agree.
_SOURCE = 'red'
_SINK = 'blue'
_SOURCE_BG = '#E9A8A8'
_SINK_BG = '#A8BFE4'
_GCC_BG = '#CBD5E1'
_EL = '#059669'
_HP_STROKE = '#7C3AED'
_HP_FILL = 'rgba(237,233,254,0.95)'

# Column tints from the page's table, matching the heat pump overlay in the
# chart so a column can be read back to the arrow it belongs to.
_SINK_CELL = 'background-color:rgba(143,174,224,0.20)'
_SOURCE_CELL = 'background-color:rgba(232,139,139,0.20)'
_EL_CELL = 'background-color:rgba(95,174,140,0.18)'
_COP_CELL = 'background-color:rgba(124,58,237,0.13);font-weight:600'
_BADGE = ('display:inline-block;padding:0.1rem 0.4rem;border-radius:4px;'
          'font-size:0.75rem;font-weight:600;')
_BADGE_REAL = _BADGE + 'background-color:#DBEAFE;color:#1E3A8A'
_BADGE_THEORETICAL = _BADGE + 'background-color:#D1FAE5;color:#065F46'


def _q_source(p: Any) -> float:
    """Source duty of an integration point: what the evaporator draws."""
    return p.Q_demand * (p.COP - 1) / p.COP if p.COP else 0.0


def _on_profile(points: List[Any]) -> List[Any]:
    """The points the page plots with both limit filters off, which is its default.

    Source-limited points deliver less than the demand above T_sink, so they miss
    the sink profile; demand-limited ones leave waste heat unused at T_source, so
    they miss the source profile. Either way they sit off the curves and turn the
    chart into a cloud. If nothing is on profile, show everything rather than an
    empty chart — the same fallback the page makes.
    """
    on = [p for p in points if not p.source_limited and not p.demand_limited]
    return on or points


def _best(points: List[Any]) -> Optional[Any]:
    """Most duty delivered, higher COP breaks a tie."""
    best = None
    for p in points:
        if best is None or p.Q_demand > best.Q_demand or (p.Q_demand == best.Q_demand and p.COP > best.COP):
            best = p
    return best


def _same_point(a: Any, b: Any) -> bool:
    return (a.refrigerant == b.refrigerant
            and abs(a.T_sink - b.T_sink) < 0.01
            and abs(a.T_source - b.T_source) < 0.01)


def _active_points(opt: Any, selected: List[Any]) -> List[Any]:
    """The pumps the chart highlights: the default one, plus whatever was clicked.

    The page keeps the default highlighted alongside the selection rather than
    replacing it, so the source-to-sink link never disappears from the chart.
    """
    points = _on_profile(getattr(opt, "feasible_points", None) or [])
    default = (_best([p for p in points if not p.theoretical])
               or _best(points)
               or getattr(opt, "max_q_point", None))
    active = [default] if default else []
    for p in selected:
        if not any(_same_point(p, a) for a in active):
            active.append(p)
    return active


def _headline_point(opt: Any, selected: List[Any]) -> Optional[Any]:
    """The pump that gets the box, the legs and the readouts.

    A click appends every machine at that sink temperature, so the last entry's
    temperature is the one just clicked; the best machine there represents it.
    """
    active = _active_points(opt, selected)
    if not active:
        return None
    last_temp = active[-1].T_sink
    return _best([p for p in active if abs(p.T_sink - last_temp) < 0.01])


def _table_points(opt: Any, selected: List[Any] = ()) -> List[Any]:
    """The heat pumps the page's optimization table lists.

    The best real machine per refrigerant type, plus the archetypes: Carnot as
    the thermodynamic ceiling, and the best of the rest. Listing every
    technology that fits at some sink temperature buries the table. A pump
    picked on the chart goes to the top, even when these rules would leave it
    out — it is the one being asked about.
    """
    points = _on_profile(getattr(opt, "feasible_points", None) or [])
    real = [p for p in points if not p.theoretical]
    rows = [_best([p for p in real if p.refrigerant_type == rt])
            for rt in dict.fromkeys(p.refrigerant_type for p in real)]

    theoretical = [p for p in points if p.theoretical]
    archetypes = [_best([p for p in theoretical if p.refrigerant == name])
                  for name in dict.fromkeys(p.refrigerant for p in theoretical)]
    carnot = next((p for p in archetypes if p and p.refrigerant == 'Carnot'), None)
    other = _best([p for p in archetypes if p and p.refrigerant != 'Carnot'])

    rows += [p for p in (carnot, other) if p]
    rows = [p for p in rows if p]
    rows.sort(key=lambda p: (p.Q_demand, p.COP), reverse=True)

    picked = [p for p in selected
              if not any(p.refrigerant == r.refrigerant and abs(p.T_sink - r.T_sink) < 0.01
                         for r in rows)]
    return picked + rows


def _thin_points(points: List[Any], keep: Optional[Any]) -> List[Any]:
    """Port of the chart's thinning on the Potential Analysis page.

    Dozens of candidates stack into a near-vertical line on a steep stretch of
    the sink profile, where tens of degrees of lift buy only a few kW. Keep the
    best COP per sink temperature, then one point per 2%-of-span duty bucket —
    the coolest sink temperature in each, i.e. the cheapest lift for that duty.
    """
    best: Dict[str, Any] = {}
    for p in points:
        key = f"{p.T_sink:.2f}_{p.refrigerant_type}" if not p.theoretical else f"{p.T_sink:.2f}_{p.refrigerant}"
        cur = best.get(key)
        if cur is None or p.COP > cur.COP:
            best[key] = p
    short_list = list(best.values())

    qs = [p.Q_demand for p in short_list]
    span = (max(qs) - min(qs)) if qs else 0
    if span <= 0:
        return short_list
    step = span * 0.02

    buckets: Dict[str, Any] = {}
    for p in short_list:
        key = f"{round(p.Q_demand / step)}_{p.refrigerant}"
        cur = buckets.get(key)
        if cur is None or p.T_sink < cur.T_sink or (p.T_sink == cur.T_sink and p.COP > cur.COP):
            buckets[key] = p
    thinned = list(buckets.values())

    # The active point is drawn on top regardless, so it must not be thinned
    # out of the cloud it belongs to and left standing alone.
    if keep is not None:
        k = f"{keep.refrigerant}_{keep.T_sink:.2f}"
        if all(f"{p.refrigerant}_{p.T_sink:.2f}" != k for p in thinned):
            match = [p for p in short_list if f"{p.refrigerant}_{p.T_sink:.2f}" == k]
            thinned += match
    return thinned


def _optimization_figure(opt: Any, pinch_temperature: float, texts: Dict[str, str],
                         selected: List[Any] = ()) -> go.Figure:
    """Rebuild the page's 'Feasible Heat Pump Solutions' chart for the report.

    Everything here mirrors frontend/src/components/analysis/HPIOptimizationChart.tsx,
    The pumps clicked on the page come in as `selected`; with none, it falls
    back to the best real machine, which is what the page highlights before
    anything is clicked.
    """
    mirrored = getattr(opt, "profile_mode", "net_load") != "net_load"
    sign = -1 if mirrored else 1
    fig = go.Figure()

    # Original GCC, faint behind the profiles. Below the pinch it mirrors onto
    # the negative axis so it follows the same source-left convention.
    gcc = getattr(opt, "original_gcc", None) or {"H": [], "T": []}
    if gcc.get("H"):
        fig.add_trace(go.Scatter(
            x=[(-h if (mirrored and t <= pinch_temperature) else h) for h, t in zip(gcc["H"], gcc["T"])],
            y=gcc["T"],
            mode='lines+markers',
            line=dict(color=_GCC_BG, width=1 if mirrored else 2, dash='dot' if mirrored else None),
            marker=dict(size=3, color=_GCC_BG),
            showlegend=False, hoverinfo='skip',
        ))

    psrc = getattr(opt, "pocketless_source", None) or {"H": [], "T": []}
    if psrc.get("H"):
        fig.add_trace(go.Scatter(
            x=[sign * h for h in psrc["H"]], y=psrc["T"], mode='lines',
            line=dict(color=_SOURCE_BG, width=3), name=texts['source_profile'], hoverinfo='skip',
        ))
    psnk = getattr(opt, "pocketless_sink", None) or {"H": [], "T": []}
    if psnk.get("H"):
        fig.add_trace(go.Scatter(
            x=psnk["H"], y=psnk["T"], mode='lines',
            line=dict(color=_SINK_BG, width=3), name=texts['sink_profile'], hoverinfo='skip',
        ))

    chart_points = _on_profile(getattr(opt, "feasible_points", None) or [])
    active_points = _active_points(opt, list(selected))
    active = _headline_point(opt, list(selected))

    # The solution cloud: refrigerants as dots, technology archetypes as diamonds.
    for pts, size, sym_sink, sym_source in (
        (_thin_points([p for p in chart_points if not p.theoretical], active), 5, 'circle', 'circle'),
        (_thin_points([p for p in chart_points if p.theoretical], active), 7, 'diamond', 'diamond-open'),
    ):
        if not pts:
            continue
        fig.add_trace(go.Scatter(
            x=[p.Q_demand for p in pts], y=[p.T_sink for p in pts], mode='markers',
            marker=dict(size=size, color=_SINK, symbol=sym_sink, line=dict(width=1.5, color=_SINK)),
            showlegend=False, hoverinfo='text',
            text=[f"<b>{p.refrigerant}</b><br>T_sink: {p.T_sink:.1f}°C<br>"
                  f"Q_sink: {p.Q_demand:.1f} kW<br>COP: {p.COP:.2f}" for p in pts],
        ))
        fig.add_trace(go.Scatter(
            x=[sign * _q_source(p) for p in pts], y=[p.T_source for p in pts], mode='markers',
            marker=dict(size=size, color=_SOURCE, symbol=sym_source, line=dict(width=1.5, color=_SOURCE)),
            showlegend=False, hoverinfo='text',
            text=[f"<b>{p.refrigerant}</b><br>T_source: {p.T_source:.1f}°C<br>"
                  f"Q_source: {_q_source(p):.1f} kW<br>COP: {p.COP:.2f}" for p in pts],
        ))

    shapes: List[Dict[str, Any]] = []
    annotations: List[Dict[str, Any]] = []

    for point in active_points:
        for x, y, colour in ((point.Q_demand, point.T_sink, _SINK),
                             (sign * _q_source(point), point.T_source, _SOURCE)):
            fig.add_trace(go.Scatter(
                x=[x], y=[y], mode='markers',
                marker=dict(size=9, color=colour, symbol='circle', line=dict(width=2, color='black')),
                showlegend=False, hoverinfo='text',
                text=[f"<b>{point.refrigerant}</b><br>T: {y:.1f}°C<br>"
                      f"Q: {abs(x):.1f} kW<br>COP: {point.COP:.2f}"],
            ))

    if active:
        src_x, src_y = sign * _q_source(active), active.T_source
        snk_x, snk_y = active.Q_demand, active.T_sink
        # The box sits on the sink's x, halfway up the lift, so the route from
        # source to sink is a clean rise-then-across with no diagonal.
        box_x, box_y = snk_x, (src_y + snk_y) / 2
        half_w, half_h = 30, 22

        # Source leg across then up into the box, sink leg straight up out of it.
        fig.add_trace(go.Scatter(x=[src_x, box_x, box_x], y=[src_y, src_y, box_y], mode='lines',
                                 line=dict(color=_SOURCE, width=2), showlegend=False, hoverinfo='skip'))
        fig.add_trace(go.Scatter(x=[box_x, snk_x], y=[box_y, snk_y], mode='lines',
                                 line=dict(color=_SINK, width=2), showlegend=False, hoverinfo='skip'))

        # Source and sink can sit 3 kW or 1500 kW apart, so the box is sized in
        # pixels and anchored to a data point rather than drawn in data space.
        shapes.append(dict(
            type='rect', xref='x', yref='y', xsizemode='pixel', ysizemode='pixel',
            xanchor=box_x, yanchor=box_y, x0=-half_w, x1=half_w, y0=-half_h, y1=half_h,
            line=dict(color=_HP_STROKE, width=2), fillcolor=_HP_FILL, layer='above',
        ))
        annotations += [
            dict(x=box_x, y=box_y, xref='x', yref='y', showarrow=False, align='center',
                 text=f"<b>HP</b><br>COP {active.COP:.2f}", font=dict(size=10, color=_HP_STROKE)),
            dict(x=src_x, y=src_y, xref='x', yref='y', showarrow=False,
                 text=f"{abs(src_x):.1f} kW<br>{src_y:.1f} °C",
                 xanchor='right', yanchor='top', align='right', xshift=-8, yshift=-2,
                 font=dict(size=10, color=_SOURCE)),
            dict(x=snk_x, y=snk_y, xref='x', yref='y', showarrow=False,
                 text=f"{snk_x:.1f} kW<br>{snk_y:.1f} °C",
                 xanchor='left', yanchor='bottom', align='left', xshift=8, yshift=2,
                 font=dict(size=10, color=_SINK)),
            # Arrowheads on both legs, and the electrical input entering from
            # the right, clear of the source leg.
            dict(x=box_x, y=snk_y, ax=box_x, ay=snk_y - (snk_y - box_y) * 0.25,
                 xref='x', yref='y', axref='x', ayref='y', text='',
                 showarrow=True, arrowhead=3, arrowsize=1.4, arrowwidth=2,
                 arrowcolor=_SINK, standoff=8),
            dict(x=box_x, y=box_y, ax=box_x, ay=box_y - (box_y - src_y) * 0.25,
                 xref='x', yref='y', axref='x', ayref='y', text='',
                 showarrow=True, arrowhead=3, arrowsize=1.4, arrowwidth=2,
                 arrowcolor=_SOURCE, standoff=half_h + 1),
            dict(x=box_x, y=box_y, ax=52, ay=0, xref='x', yref='y', axref='pixel', ayref='pixel',
                 showarrow=True, arrowhead=3, arrowsize=1.4, arrowwidth=2, arrowcolor=_EL,
                 standoff=half_w + 2, xanchor='left',
                 text=f"<b>P<sub>el</sub> {snk_x - src_x:.1f} kW</b>", font=dict(size=10, color=_EL)),
        ]

    # Only the fully cascaded profiles have a pinch.
    if not mirrored:
        shapes.append(dict(type='line', xref='paper', x0=0, x1=1, y0=pinch_temperature,
                           y1=pinch_temperature, line=dict(dash='dash', color='gray', width=1)))
        annotations.append(dict(x=1, xref='paper', xanchor='right', y=pinch_temperature,
                                showarrow=False, font=dict(size=11, color='gray'),
                                text=f"{texts['pinch_label']}{pinch_temperature:.1f}°C"))
    shapes.append(dict(type='line', yref='paper', x0=0, x1=0, y0=0, y1=1,
                       line=dict(color='black', width=1), opacity=0.3))

    fig.update_layout(
        title=dict(text=texts['opt_hp_title'], font=dict(size=14)),
        xaxis=dict(title=dict(text=texts['q_source_sink'] if mirrored else texts['net_enthalpy']), automargin=True),
        yaxis=dict(title=dict(text=texts['shifted_temp']), automargin=True, rangemode='tozero'),
        height=700, margin=dict(l=80, r=20, t=40, b=80),
        hovermode='closest', template='plotly_white',
        showlegend=True,
        legend=dict(orientation='h', x=1, y=1.02, xanchor='right', yanchor='bottom'),
        shapes=shapes, annotations=annotations,
    )
    return fig


def _de(val: float) -> str:
    """Whole number German-style, as the page shows it: 1.234.567."""
    return f"{val:,.0f}".replace(",", ".")


def _render_economics(econ: Optional[Dict[str, Any]]) -> str:
    """The Economic analysis section of a scenario page.

    The frontend sends it ready to draw (econReportData in econModel.ts):
    labels already translated, values formatted, charts as Plotly specs. So the
    report shows exactly what the page shows, from the same code.
    """
    if not econ:
        return ""
    lab = econ.get("labels", {})

    kpis = "".join(
        f"<div class='econ-kpi' style='border-left-color:{k['color']};background:{k['color']}0F'>"
        f"<div class='metric-label'>{escape(k['label'])}</div>"
        f"<div class='econ-kpi-value' style='color:{k['valueColor']}'>{escape(k['value'])} "
        f"<span class='econ-unit'>{escape(k['unit'])}</span></div>"
        + (f"<div class='econ-kpi-sub'>{escape(k['sub'])}</div>" if k.get('sub') else "")
        + "</div>"
        for k in econ.get("kpis", [])
    )

    inputs = "".join(
        f"<table class='data-table econ-table'><thead><tr><th colspan='3'>{escape(g['title'])}</th></tr></thead><tbody>"
        + "".join(f"<tr><td>{escape(str(a))}</td><td style='text-align:right'>{escape(str(b))}</td>"
                  f"<td>{escape(str(c))}</td></tr>" for a, b, c in g["rows"])
        + "</tbody></table>"
        for g in econ.get("inputs", [])
    )

    def result_table(tbl: Dict[str, Any]) -> str:
        head = "".join(f"<th>{escape(h)}</th>" for h in tbl["headers"])
        body = ""
        for r in tbl["rows"]:
            cells = r["cells"]
            style = f" style='color:{r['color']};font-weight:600'" if r.get("color") else ""
            body += (f"<tr><td>{escape(cells[0])}</td><td>{escape(cells[1])}</td>"
                     f"<td style='text-align:right'>{escape(cells[2])}</td>"
                     f"<td style='text-align:right'{style}>{escape(cells[3])}</td></tr>")
        return f"<table class='data-table econ-table'><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"

    results = "".join(result_table(tbl) for tbl in econ.get("results", []))

    # Specs come from plotly.js, so skip the Python-side validation.
    figs = [pio.to_html(f, full_html=False, include_plotlyjs=False, validate=False,
                        config={"responsive": True})
            for f in econ.get("figures", [])]
    bar, price, npv, sens, size = (figs + [""] * 5)[:5]

    summary = econ.get("summary") or {}
    border = "#2E7D32" if summary.get("good") else "#C62828"

    return f"""
    <h2>💶 {escape(econ.get('title', ''))} · {escape(econ.get('pump', ''))}</h2>
    <h3>{escape(lab.get('key', ''))}</h3>
    <div class="metrics-row">{kpis}</div>
    <h3>{escape(lab.get('inputs', ''))}</h3>
    <div class="econ-grid">{inputs}</div>
    <h3>{escape(lab.get('results', ''))}</h3>
    <div class="econ-grid">{results}</div>
    <h3>{escape(lab.get('charts', ''))}</h3>
    <div class="plots-container">
        <div class="plot-section">{bar}</div>
        <div class="plot-section">{price}</div>
    </div>
    <div class="plot-section" style="width:100%">{npv}</div>
    <h3>{escape(lab.get('sensitivity', ''))}</h3>
    <p>{escape(econ.get('sens_explain', ''))}</p>
    <div class="plot-section" style="width:100%">{sens}</div>
    <h3>{escape(lab.get('size', ''))}</h3>
    <p>{escape(econ.get('size_explain', ''))}</p>
    <div class="plot-section" style="width:100%">{size}</div>
    <h3>{escape(lab.get('summary', ''))}</h3>
    <p style="border-left:4px solid {border};padding-left:10px;line-height:1.5">
        <b>{escape(summary.get('name', ''))}:</b> {escape(summary.get('text', ''))}
    </p>
    """


def _render_pinch_content(
    name: str,
    id_slug: str,
    t_min: float,
    pinch_result: Any,
    selected_streams: List[ReportStream],
    hpi_optimization_result: Any,
    selected_hp_points: List[Any],
    energy_demands: List[Any],
    map_streams_img_html: str,
    lang: str = "en",
    include_plotly_js: bool = False,
    economics: Optional[Dict[str, Any]] = None,
) -> str:
    """Helper to render the detailed analysis content for a single scenario."""
    texts = I18N.get(lang, I18N["en"])
    display_name = texts['all_streams'] if name.lower() == 'all streams' else name
    
    if not pinch_result or len(selected_streams) < 2:
        return f"""
        <div id="{id_slug}" class="page-content">
            <h2>📊 {texts['analysis']}: {display_name}</h2>
            <p><em>{texts['not_enough_streams']}</em></p>
        </div>
        """

    pr = pinch_result
    total_hot_duty = sum(abs(s.Q) for s in selected_streams if s.Tin > s.Tout)
    # What the hot streams give off, less what still has to be cooled away.
    heat_recovery = total_hot_duty - pr.cold_utility

    # Streams table
    rows = ""
    for s in selected_streams:
        is_hot = s.Tin > s.Tout
        badge_cls = "hot" if is_hot else "cold"
        badge_lbl = texts['hot'] if is_hot else texts['cold']
        rows += (
            f"<tr><td>{s.name}</td><td>{s.Tin:.1f}</td><td>{s.Tout:.1f}</td>"
            f"<td>{s.CP:.2f}</td><td>{s.Q:.2f}</td>"
            f"<td><span class='badge {badge_cls}'>{badge_lbl}</span></td></tr>\n"
        )
    streams_table = (
        f"<table class='data-table'><thead><tr>"
        f"<th>{texts['stream']}</th><th>Tin (°C)</th><th>Tout (°C)</th><th>CP (kW/K)</th><th>Q (kW)</th><th>{texts['type']}</th>"
        f"</tr></thead><tbody>" + rows + "</tbody></table>"
    )

    # Metrics
    metrics_html = f"""
    <div class="metrics-row">
      <div class="metric-card hot"><div class="metric-label">{texts['min_heating']}</div><div class="metric-value">{pr.hot_utility:.2f} kW</div></div>
      <div class="metric-card cold"><div class="metric-label">{texts['min_cooling']}</div><div class="metric-value">{pr.cold_utility:.2f} kW</div></div>
      <div class="metric-card pinch"><div class="metric-label">{texts['pinch_temp']}</div><div class="metric-value">{pr.pinch_temperature:.1f} °C</div></div>
      <div class="metric-card recovery"><div class="metric-label">{texts['heat_recovery']}</div><div class="metric-value">{heat_recovery:.2f} kW</div></div>
    </div>"""

    # Comparison table (Status Quo vs Proposal)
    comparison_html = ""
    tot_heat = sum(d.heat_demand for d in energy_demands)
    tot_cool = sum(d.cooling_demand for d in energy_demands)
    if tot_heat > 0 or tot_cool > 0:
        sh = tot_heat - pr.hot_utility
        sc = tot_cool - pr.cold_utility
        sh_pct = f"{abs(sh)/tot_heat*100:.1f}%" if tot_heat > 0 else "N/A"
        sc_pct = f"{abs(sc)/tot_cool*100:.1f}%" if tot_cool > 0 else "N/A"

        # Coverage comes from the optimized heat pump, the same machine the
        # table and chart below report.
        best = _headline_point(hpi_optimization_result, selected_hp_points) if hpi_optimization_result else None
        if best:
            hc_heat = min(best.Q_demand, pr.hot_utility)
            hc_cool = min(_q_source(best), pr.cold_utility)
            hp_hdr = texts['hp_hdr_kw'].format(name=best.refrigerant)
            hc_h_s = f"{hc_heat:.1f}"
            hc_c_s = f"{hc_cool:.1f}"
            hc_h_p = f"{hc_heat/pr.hot_utility*100:.1f}%" if pr.hot_utility > 0 else "N/A"
            hc_c_p = f"{hc_cool/pr.cold_utility*100:.1f}%" if pr.cold_utility > 0 else "N/A"
        else:
            hp_hdr = f"{texts['hp_hdr']} (kW)"
            hc_h_s = hc_c_s = hc_h_p = hc_c_p = "N/A"

        comparison_html = f"""
        <h3>📊 {texts['comparison']}: {texts['status_quo']} vs {display_name}</h3>
        <table class='data-table'>
          <thead><tr><th>{texts['type']}</th><th>{texts['status_quo']} (kW)</th><th>{texts['min_after_hr']} (kW)</th><th>{texts['savings']} (kW)</th><th>{texts['savings']} (%)</th><th>{hp_hdr}</th><th>{texts['hp_hdr']} (%)</th></tr></thead>
          <tbody>
            <tr><td>{texts['hot']}</td><td>{tot_heat:.1f}</td><td>{pr.hot_utility:.1f}</td><td>{sh:.1f}</td><td>{sh_pct}</td><td>{hc_h_s}</td><td>{hc_h_p}</td></tr>
            <tr><td>{texts['cold']}</td><td>{tot_cool:.1f}</td><td>{pr.cold_utility:.1f}</td><td>{sc:.1f}</td><td>{sc_pct}</td><td>{hc_c_s}</td><td>{hc_c_p}</td></tr>
          </tbody>
        </table>"""

    # The same table the Potential Analysis page shows above its chart: same
    # columns, same column tints, same Real/Theoretical badge. Wide, so it gets
    # the full width and scrolls sideways rather than being squeezed beside the
    # chart.
    opt_table_html = ""
    opt_rows = _table_points(hpi_optimization_result, selected_hp_points) if hpi_optimization_result else []
    headline = _headline_point(hpi_optimization_result, selected_hp_points) if hpi_optimization_result else None
    if opt_rows:
        half = _fmt(t_min / 2, 1).rstrip('0').rstrip('.')
        headers = [
            (texts['hdr_type'], ''), (texts['hdr_refrig'], ''), (texts['hdr_medium_sink'], ''),
            ('COP', _COP_CELL), (texts['hdr_q_sink'], _SINK_CELL),
            (texts['hdr_q_source'], _SOURCE_CELL), (texts['hdr_p_el'], _EL_CELL),
            (texts['hdr_actual_sink'], _SINK_CELL),
            (texts['hdr_shifted_sink'].format(half=half), _SINK_CELL),
            (texts['hdr_actual_source'], _SOURCE_CELL),
            (texts['hdr_shifted_source'].format(half=half), _SOURCE_CELL),
            (texts['hdr_refrigerant'], ''), (texts['hdr_hp_stages'], ''),
        ]
        head = "".join(f"<th>{label}</th>" for label, _ in headers)

        rows = ""
        for p in opt_rows:
            # The refrigerant column is blank for archetypes, so the technology
            # name rides in the type cell — otherwise Carnot and VHTHP rows look
            # identical.
            badge = _BADGE_THEORETICAL if p.theoretical else _BADGE_REAL
            label = texts['theoretical'] if p.theoretical else texts['real']
            tech = (texts['carnot_50'] if p.refrigerant == 'Carnot' else p.refrigerant) if p.theoretical else ''
            ref_name = p.refrigerant.rsplit('_', 1)[0] if '_' in p.refrigerant else p.refrigerant
            cells = [
                (f"<span style=\"{badge}\">{label}</span>"
                 f"<span style='font-size:0.75rem;color:#64748B;margin-left:0.35rem'>{tech}</span>", ''),
                ('' if p.theoretical else p.refrigerant_type, ''),
                ('' if p.theoretical else p.medium_sink, ''),
                (_fmt(p.COP), _COP_CELL),
                (_fmt(p.Q_demand, 1), _SINK_CELL),
                (_fmt(_q_source(p), 1), _SOURCE_CELL),
                (_fmt(p.Q_demand / p.COP if p.COP else 0, 1), _EL_CELL),
                (_fmt(p.T_sink, 1), _SINK_CELL),
                (_fmt(p.T_sink + t_min / 2, 1), _SINK_CELL),
                (_fmt(p.T_source, 1), _SOURCE_CELL),
                (_fmt(p.T_source - t_min / 2, 1), _SOURCE_CELL),
                ('' if p.theoretical else ref_name, ''),
                ('' if p.theoretical else p.hp_level, ''),
            ]
            picked = any(_same_point(p, sp) for sp in selected_hp_points) or (
                headline is not None and _same_point(p, headline) and bool(selected_hp_points))
            rows += (f"<tr style='background-color:#E2E8F0'>" if picked else "<tr>") + "".join(
                f"<td style=\"{style}\">{value}</td>" if style else f"<td>{value}</td>"
                for value, style in cells
            ) + "</tr>"

        opt_table_html = f"""
        <h3>{texts['hp_table_title']} ({display_name})</h3>
        <div class="pa-hp-table-wrap">
          <table class="pa-hp-table">
            <thead><tr>{head}</tr></thead>
            <tbody>{rows}</tbody>
          </table>
        </div>"""

    # Charts
    chart_layout_base = dict(
        height=400, margin=dict(l=60, r=20, t=40, b=50),
        font=dict(size=11), hovermode='closest', template='plotly_white'
    )
    
    comp_html = gcc_html = ""
    include_js = 'cdn' if include_plotly_js else False

    # Composite
    if pr.composite_diagram.hot.get("H"):
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=pr.composite_diagram.hot["H"], y=pr.composite_diagram.hot["T"], mode='lines+markers', name=texts['hot'], line=dict(color='red')))
        fig.add_trace(go.Scatter(x=pr.composite_diagram.cold["H"], y=pr.composite_diagram.cold["T"], mode='lines+markers', name=texts['cold'], line=dict(color='blue')))
        fig.add_hline(y=pr.pinch_temperature, line_dash='dash', line_color='gray', annotation_text="Pinch")
        fig.update_layout(**chart_layout_base, title=texts['composite_title'], xaxis_title='H (kW)', yaxis_title='T (°C)')
        comp_html = fig.to_html(full_html=False, include_plotlyjs=include_js)

    # Optimization Chart — the same figure the Potential Analysis page draws.
    opt_chart_html = ""
    if hpi_optimization_result and getattr(hpi_optimization_result, "pocketless_sink", None):
        opt_fig = _optimization_figure(hpi_optimization_result, pr.pinch_temperature, texts,
                                       selected_hp_points)
        opt_chart_html = opt_fig.to_html(full_html=False, include_plotlyjs=False)

    # GCC
    if pr.grand_composite_curve.get("H"):
        gcc_H = pr.grand_composite_curve["H"]
        gcc_T = pr.grand_composite_curve["T"]
        hc = pr.heat_cascade
        fig = go.Figure()
        for i in range(len(gcc_H) - 1):
            seg_color = 'red' if i < len(hc) and hc[i].get('deltaH', 0) > 0 else ('blue' if i < len(hc) and hc[i].get('deltaH', 0) < 0 else 'gray')
            fig.add_trace(go.Scatter(
                x=[gcc_H[i], gcc_H[i+1]], 
                y=[gcc_T[i], gcc_T[i+1]], 
                mode='lines+markers', 
                line=dict(color=seg_color, width=2), 
                marker=dict(size=6, color=seg_color), 
                showlegend=False
            ))
        fig.add_hline(y=pr.pinch_temperature, line_dash='dash', annotation_text="Pinch")
        fig.add_vline(x=0, line_color='black', line_width=1, opacity=0.3)
        fig.update_layout(**chart_layout_base, title=texts['gcc_title'], xaxis_title=texts['net_delta_h'], yaxis_title=texts['shifted_t'])
        gcc_html = fig.to_html(full_html=False, include_plotlyjs=False)

    return f"""
    <div id="{id_slug}" class="page-content">
        <h2>📊 {texts['analysis']}: {display_name} (ΔTmin = {t_min}°C)</h2>
        
        <div class="stream-map-layout">
            <div class="stream-list-section"><h4>{texts['selected_streams']}</h4>{streams_table}</div>
            <div class="map-display-section"><h4>{texts['process_layout']}</h4>{map_streams_img_html}</div>
        </div>

        {metrics_html}
        {comparison_html}

        <h3>{texts['diagrams']}</h3>
        <div class="plots-container">
            <div class="plot-section">{comp_html}</div>
            <div class="plot-section">{gcc_html}</div>
        </div>
        {opt_table_html}
        <div class="plot-section" style="width:100%">{opt_chart_html}</div>
        {_render_economics(economics)}
    </div>
    """


def _streams_signature(selected_streams: List[ReportStream]) -> tuple:
    """Build a stable signature for selected streams to cache map renders."""
    return tuple(sorted(
        (
            s.name,
            float(s.Tin),
            float(s.Tout),
            float(s.CP),
            float(s.Q),
            s.type,
        )
        for s in selected_streams
    ))


def _map_b64_cached(req: ReportRequest, cache: Dict[tuple, str]) -> str:
    key = (req.current_base, _streams_signature(req.selected_streams))
    if key in cache:
        return cache[key]
    b64 = generate_process_map_b64(req)
    cache[key] = b64
    return b64



def generate_html_report(req: ReportRequest) -> str:
    """Generate a multi-page self-contained HTML report."""
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M')
    lang = req.language if req.language in I18N else "en"
    texts = I18N[lang]

    # 1. Map images (Project-wide - Data Collection)
    map_cache: Dict[tuple, str] = {}
    original_base = req.current_base
    
    req.current_base = 'OpenStreetMap'
    osm_overlaid_b64 = _map_b64_cached(req, map_cache)
    map_osm_html = f"<img src='data:image/png;base64,{osm_overlaid_b64}' alt='OSM'>" if osm_overlaid_b64 else f"<p>{texts['process_maps']} N/A</p>"
    
    req.current_base = 'Satellite'
    sat_overlaid_b64 = _map_b64_cached(req, map_cache)
    map_sat_html = f"<img src='data:image/png;base64,{sat_overlaid_b64}' alt='Satellite'>" if sat_overlaid_b64 else f"<p>{texts['process_maps']} N/A</p>"
    
    req.current_base = original_base

    # 2. Data collection table
    subprocess_to_process = {s_idx: g_idx for g_idx, g_subs in enumerate(req.proc_groups) for s_idx in g_subs}
    data_rows = []
    for sp_idx, sp in enumerate(req.processes):
        p_idx = subprocess_to_process.get(sp_idx)
        process_name = req.proc_group_names[p_idx] if p_idx is not None and p_idx < len(req.proc_group_names) else "Unknown"
        for s in (sp.streams or []):
            sv = s.get('stream_values', {})
            tin, tout = sv.get('Tin', s.get('temp_in', '')), sv.get('Tout', s.get('temp_out', ''))
            mdot, cp = sv.get('ṁ', s.get('mdot', '')), sv.get('cp', s.get('cp', ''))
            CP = sv.get('CP', '')
            Q = f"{(float(mdot)*float(cp)*abs(float(tout)-float(tin))):.2f}" if (tin and tout and mdot and cp) else ""
            
            s_type = s.get('type', '')
            localized_type = texts['hot'] if s_type == 'HOT' else (texts['cold'] if s_type == 'COLD' else s_type)
            
            data_rows.append(
                f"<tr><td>{process_name}</td><td>{sp.name}</td><td>{s.get('name')}</td>"
                f"<td>{localized_type}</td><td>{tin}</td><td>{tout}</td><td>{mdot}</td>"
                f"<td>{cp}</td><td>{CP}</td><td>{Q}</td></tr>"
            )
    data_rows_html = "".join(data_rows)

    # 3. Compile Individual Scenario Pages
    scenario_pages_html = ""
    nav_links_html = f'<li class="nav-tab active" onclick="showPage(\'data-collection\')">📍 {texts["data_collection"]}</li>'
    
    # Render each saved scenario
    for i, sc in enumerate(req.scenarios):
        sc_id = f"scenario-{i}"
        sc_disp_name = texts['all_streams'] if sc.name.lower() == 'all streams' else sc.name
        nav_links_html += f'<li class="nav-tab" onclick="showPage(\'{sc_id}\')">📑 {sc_disp_name}</li>'
        
        # Regenerate map for this specific scenario
        old_streams = req.selected_streams
        req.selected_streams = sc.selected_streams
        sc_map_b64 = _map_b64_cached(req, map_cache)
        sc_map_html = f"<img src='data:image/png;base64,{sc_map_b64}'>" if sc_map_b64 else f"<p>{texts['map_not_avail']}</p>"
        req.selected_streams = old_streams

        # The first scenario page must include Plotly.js to enable charts across all tabs
        scenario_pages_html += _render_pinch_content(
            sc.name, sc_id, sc.t_min, sc.pinch_result, sc.selected_streams, sc.hpi_optimization_result,
            sc.selected_hp_points, sc.energy_demands, sc_map_html,
            lang=lang,
            include_plotly_js=(i == 0),
            economics=sc.economics,
        )

    # 4. Comparison Summary Page
    comparison_html = ""
    if req.scenarios:
        nav_links_html += f'<li class="nav-tab" onclick="showPage(\'comparison-summary\')">⚖️ {texts["comparison"]}</li>'
        sc_rows = ""
        sc_names, sc_hot, sc_cold = [], [], []
        sc_best_cop, sc_tot_heat = [], []
        sc_npv: List[Optional[float]] = []
        
        for sc in req.scenarios:
            sc_disp_name = texts['all_streams'] if sc.name.lower() == 'all streams' else sc.name
            phu = sc.pinch_result.hot_utility if sc.pinch_result else 0
            pcu = sc.pinch_result.cold_utility if sc.pinch_result else 0
            
            # Additional detailed metrics
            tot_heat = sum(d.heat_demand for d in sc.energy_demands)
            tot_cool = sum(d.cooling_demand for d in sc.energy_demands)
            sh = tot_heat - phu
            sh_pct = (abs(sh)/tot_heat*100) if tot_heat > 0 else 0
            
            best = _headline_point(sc.hpi_optimization_result, sc.selected_hp_points) if sc.hpi_optimization_result else None

            hc_heat = min(best.Q_demand, phu) if best else 0
            coverage = (hc_heat / phu * 100) if phu > 0 else 0
            best_cop = best.COP if best else 0

            sc_names.append(sc_disp_name)
            sc_hot.append(phu)
            sc_cold.append(pcu)
            sc_best_cop.append(best_cop)
            sc_tot_heat.append(tot_heat)
            
            # Economics of the scenario's pump, as sent by the frontend.
            num = (sc.economics or {}).get("numbers")
            if num:
                npv = num["npv"]
                sc_npv.append(npv)
                payback = (texts['econ_never'] if num["payback"] is None
                           else f"{num['payback']} {texts['econ_years']}")
                npv_colour = '#C62828' if npv < 0 else '#2E7D32'
                econ_cells = (
                    f"<td style='background:#fef3c7'>{_de(num['capex'])}</td>"
                    f"<td style='background:#fef3c7;font-weight:700;color:{npv_colour}'>{_de(npv)}</td>"
                    f"<td style='background:#fef3c7'>{payback}</td>"
                    f"<td style='background:#fef3c7'>{_de(num['saving1'])}</td>"
                )
            else:
                sc_npv.append(None)
                econ_cells = "<td style='background:#fef3c7'>—</td>" * 4

            sc_rows += f"<tr><td><strong>{sc_disp_name}</strong></td><td>{sc.t_min}K</td><td>{tot_heat:.1f}</td><td>{phu:.1f}</td><td>{tot_cool:.1f}</td><td>{pcu:.1f}</td><td style='background:#e8f5e9'>{sh:.1f}</td><td style='background:#e8f5e9'>{sh_pct:.1f}%</td><td style='background:#f3e5f5'>{_fmt(best_cop)}</td><td style='background:#f3e5f5'>{coverage:.1f}%</td>{econ_cells}</tr>"
        
        fig = go.Figure([go.Bar(x=sc_names, y=sc_tot_heat, name='Status Quo (Hot)', marker_color='#ef4444', opacity=0.3, showlegend=False), 
                         go.Bar(x=sc_names, y=sc_hot, name=texts['hot'], marker_color='#ef4444'), 
                         go.Bar(x=sc_names, y=sc_cold, name=texts['cold'], marker_color='#3b82f6')])
        fig.update_layout(height=400, barmode='group', title=texts['utilities_comparison'])
        comp_chart = fig.to_html(full_html=False, include_plotlyjs=False)

        # Second chart: Performance Metrics
        fig_perf = go.Figure()
        fig_perf.add_trace(go.Scatter(x=sc_names, y=sc_best_cop, mode='lines+markers', name='Best HP COP', line=dict(color='#AB63FA', width=3, dash='dot'), marker=dict(size=8)))
        fig_perf.update_layout(
            height=400, title="Performance Metrics",
            yaxis=dict(title='Best HP COP', autorange=True, rangemode='tozero'),
            legend=dict(orientation="h", y=-0.2, x=0.5, xanchor='center')
        )
        perf_chart = fig_perf.to_html(full_html=False, include_plotlyjs=False)

        npv_chart = ""
        if any(v is not None for v in sc_npv):
            fig_npv = go.Figure(go.Bar(
                x=sc_names, y=sc_npv, name=texts['econ_npv'],
                marker_color=['#C62828' if (v or 0) < 0 else '#2E7D32' for v in sc_npv],
                hovertemplate='%{x}: %{y:,.0f} €<extra></extra>',
            ))
            fig_npv.update_layout(height=400, title=texts['econ_npv_title'], separators=',.',
                                  yaxis=dict(title='€', tickformat=',.0f', zeroline=True))
            npv_chart = (f"<div class='hpi-table-col'><div class='plot-section'>"
                         f"{fig_npv.to_html(full_html=False, include_plotlyjs=False)}</div></div>")

        comparison_html = f"""
        <div id="comparison-summary" class="page-content">
            <h2>⚖️ {texts['comparison_summary']}</h2>
            
            <div style="background:#fff; padding:15px; border:1px solid #ddd; border-radius:8px; margin-bottom:20px;">
                <h3 style="margin-top:0;">Combined Status Quo vs. Proposal Comparison</h3>
                <table class="data-table" style="text-align:center;">
                    <thead>
                        <tr>
                            <th rowspan="2" style="background:#f1f5f9; color:#333;">{texts['scenario']}</th>
                            <th rowspan="2" style="background:#f1f5f9; color:#333;">ΔTmin</th>
                            <th colspan="2" style="background:#ffcdd2; color:#b71c1c; text-align:center;">HEATING (KW)</th>
                            <th colspan="2" style="background:#bbdefb; color:#0d47a1; text-align:center;">COOLING (KW)</th>
                            <th colspan="2" style="background:#c8e6c9; color:#1b5e20; text-align:center;">HEAT RECOVERY POTENTIAL</th>
                            <th colspan="2" style="background:#e1bee7; color:#4a148c; text-align:center;">HP INTEGRATION</th>
                            <th colspan="4" style="background:#fde68a; color:#78350f; text-align:center;">{texts['econ_title'].upper()}</th>
                        </tr>
                        <tr>
                            <th style="background:#ffebee; color:#d32f2f;">STATUS QUO</th><th style="background:#ffebee; color:#d32f2f;">PINCH MIN.</th>
                            <th style="background:#e3f2fd; color:#1976d2;">STATUS QUO</th><th style="background:#e3f2fd; color:#1976d2;">PINCH MIN.</th>
                            <th style="background:#e8f5e9; color:#388e3c;">SAVINGS (KW)</th><th style="background:#e8f5e9; color:#388e3c;">SAVINGS (%)</th>
                            <th style="background:#f3e5f5; color:#7b1fa2;">BEST COP</th><th style="background:#f3e5f5; color:#7b1fa2;">COVERAGE (%)</th>
                            <th style="background:#fef3c7; color:#92400e;">{texts['econ_invest']}</th><th style="background:#fef3c7; color:#92400e;">{texts['econ_npv']}</th>
                            <th style="background:#fef3c7; color:#92400e;">{texts['econ_payback']}</th><th style="background:#fef3c7; color:#92400e;">{texts['econ_saving1']}</th>
                        </tr>
                    </thead>
                    <tbody>{sc_rows}</tbody>
                </table>
            </div>

            <div class="hpi-flex-row">
                <div class="hpi-table-col"><div class="plot-section">{comp_chart}</div></div>
                <div class="hpi-table-col"><div class="plot-section">{perf_chart}</div></div>
                {npv_chart}
            </div>
        </div>"""

    # Final HTML assembly
    html = f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="UTF-8"><title>{texts['report_title']}</title>
<style>
    body {{ font-family: 'Segoe UI', sans-serif; background:#f5f5f5; margin:0; padding:20px; }}
    .report-container {{ background:#fff; padding:30px; border-radius:8px; max-width:2400px; margin:auto; box-shadow:0 2px 10px rgba(0,0,0,0.1); }}
    .nav-tabs {{ display:flex; gap:5px; border-bottom:3px solid #3498db; list-style:none; padding:0; margin-bottom:25px; overflow-x:auto; white-space:nowrap; }}
    .nav-tab {{ padding:12px 20px; background:#ecf0f1; cursor:pointer; font-weight:600; border-radius:6px 6px 0 0; border:1px solid #ddd; border-bottom:none; }}
    .nav-tab.active {{ background:#3498db; color:#fff; border-color:#3498db; }}
    .page-content {{ display:none; animation: fadeIn 0.3s; }}
    .page-content.active {{ display:block; }}
    @keyframes fadeIn {{ from {{ opacity: 0; }} to {{ opacity: 1; }} }}
    .maps-container {{ display:flex; gap:30px; justify-content:center; margin:30px 0; }}
    .map-section {{ text-align:center; flex:1; min-width:400px; max-width:1100px; }}
    .map-section img {{ max-width:100%; width:100%; border:1px solid #ddd; border-radius:4px; }}
    .map-section p {{ font-weight:bold; color:#555; margin-top:10px; }}
    .data-table {{ width:100%; border-collapse:collapse; margin:15px 0; font-size:12px; }}
    .data-table th, .data-table td {{ border:1px solid #ddd; padding:8px; text-align:left; }}
    .data-table th {{ background:#7aadcb; color:#fff; }}
    .metrics-row {{ display:flex; gap:15px; margin:20px 0; flex-wrap:wrap; }}
    .metric-card {{ flex:1; min-width:180px; padding:15px; border:1px solid #eee; border-radius:8px; text-align:center; }}
    .metric-label {{ font-size:11px; color:#666; text-transform:uppercase; }}
    .metric-value {{ font-size:22px; font-weight:bold; }}
    .hot {{ color:#c62828; }} .cold {{ color:#1565c0; }}
    .plots-container {{ display:flex; gap:20px; flex-wrap:wrap; margin:20px 0; }}
    .plot-section {{ flex:1; min-width:480px; border:1px solid #eee; padding:10px; border-radius:5px; }}
    .stream-map-layout {{ display:flex; gap:20px; }}
    .stream-list-section {{ flex:1; }} .map-display-section {{ flex:1; text-align:center; }}
    .map-display-section img {{ max-width:100%; border-radius:5px; border:1px solid #ddd; }}
    .hpi-flex-row {{ display:flex; gap:20px; flex-wrap:wrap; }}
    .pa-hp-table-wrap {{ margin:8px 0; overflow-x:auto; -webkit-overflow-scrolling:touch; }}
    .pa-hp-table {{ width:100%; border-collapse:collapse; font-size:0.75rem; margin:8px 0; }}
    .pa-hp-table th, .pa-hp-table td {{ border:1px solid #e2e8f0; padding:6px 8px; text-align:left; white-space:nowrap; }}
    .pa-hp-table th {{ background:#2b589c; color:#fff; font-weight:600; }}
    .pa-hp-table tr:nth-child(even) {{ background:#f8fafc; }}
    .hpi-table-col {{ flex:1; }} .hpi-chart-col {{ flex:1.5; }}
    .econ-kpi {{ flex:1; min-width:160px; padding:10px 14px; border:1px solid #e2e8f0; border-left-width:4px; border-radius:6px; text-align:center; }}
    .econ-kpi-value {{ font-size:20px; font-weight:700; }}
    .econ-unit {{ font-size:12px; font-weight:600; }}
    .econ-kpi-sub {{ font-size:12px; color:#333; }}
    .econ-grid {{ display:grid; grid-template-columns:repeat(auto-fit, minmax(380px, 1fr)); gap:12px; align-items:start; }}
    .econ-table {{ margin:0; }}
    @media print {{ .nav-tabs {{ display:none; }} .page-content {{ display:block !important; page-break-after:always; }} }}
</style>
</head>
<body>
<div class="report-container">
    <h1>{texts['report_title']}</h1>
    <p style="color:#666">{texts['generated']}: {now_str}</p>
    <ul class="nav-tabs">{nav_links_html}</ul>
    
    <div id="data-collection" class="page-content active">
        <h2>📍 {texts['data_collection']}</h2>
        <h3>{texts['process_maps']}</h3>
        <div class="maps-container">
          <div class="map-section">{map_osm_html}<p>OpenStreetMap</p></div>
          <div class="map-section">{map_sat_html}<p>Satellite</p></div>
        </div>
        <h3>📋 {texts['collected_data']}</h3>
        <table class="data-table">
            <thead><tr><th>{texts['process']}</th><th>{texts['subprocess']}</th><th>{texts['stream']}</th><th>{texts['type']}</th><th>Tin (°C)</th><th>Tout (°C)</th><th>ṁ</th><th>cp</th><th>CP</th><th>Q (kW)</th></tr></thead>
            <tbody>{data_rows_html}</tbody>
        </table>
        <h3>📝 {texts['notes']}</h3><div style="background:#f9f9f9; padding:15px; border-left:4px solid #3498db; white-space: pre-wrap;">{req.project_notes or texts['no_notes']}</div>
    </div>

    {scenario_pages_html}
    {comparison_html}
</div>
<script>
function showPage(id) {{
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(t => {{
        if (t.getAttribute('onclick').includes(id)) t.classList.add('active');
    }});
    
    window.dispatchEvent(new Event('resize'));
}}
</script>
</body></html>"""

    return html

