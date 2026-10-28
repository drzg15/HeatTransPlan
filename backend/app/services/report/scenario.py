"""One scenario page of the report: streams, metrics, tables and charts."""

from typing import Any, Dict, List, Optional

import plotly.graph_objects as go

from app.models.report import ReportStream
from app.services.report.economics import _render_economics
from app.services.report.figures import _optimization_figure
from app.services.report.formatting import _fmt
from app.services.report.points import _headline_point, _q_source, _same_point, _table_points
from app.services.report.texts import I18N

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
