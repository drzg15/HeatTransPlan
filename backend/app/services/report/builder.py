"""
Report generation service — produces self-contained HTML report.
Includes detailed pages for every saved scenario and a comparison overview.
"""

from __future__ import annotations
from html import escape
from datetime import datetime
from typing import Any, Dict, List

import plotly.graph_objects as go
from app.models.report import ReportRequest, ReportStream
from app.services.map_service import generate_process_map_b64
from app.services.report.figures import (
    _BADGE_REAL, _BADGE_THEORETICAL, _COP_CELL, _EL_CELL, _SINK_CELL, _SOURCE_CELL,
    _optimization_figure,
)
from app.services.report.hp_rules import _hp_view, _q_source
from app.services.report.texts import I18N, _fmt


def _render_pinch_content(
    name: str,
    id_slug: str,
    t_min: float,
    pinch_result: Any,
    selected_streams: List[ReportStream],
    hpi_optimization_result: Any,
    selected_hp_points: List[Any],
    hp_filters: Any,
    energy_demands: List[Any],
    map_streams_img_html: str,
    lang: str = "en",
    include_plotly_js: bool = False
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
    # Which heat pumps this page shows, by the same rules as the analysis page.
    hp_view = _hp_view(hpi_optimization_result, selected_hp_points, hp_filters) if hpi_optimization_result else None
    total_hot_duty = sum(abs(s.Q) for s in selected_streams if s.Tin > s.Tout)
    heat_recovery = total_hot_duty - pr.hot_utility

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
        best = hp_view.box if hp_view else None
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
    opt_rows = hp_view.table if hp_view else []
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
                # The point's temperatures are the Grand Composite Curve's
                # shifted ones, which the COP is computed at; the actual ones sit
                # ΔTmin/2 below the sink, above the source.
                (_fmt(p.T_sink - t_min / 2, 1), _SINK_CELL),
                (_fmt(p.T_sink, 1), _SINK_CELL),
                (_fmt(p.T_source + t_min / 2, 1), _SOURCE_CELL),
                (_fmt(p.T_source, 1), _SOURCE_CELL),
                ('' if p.theoretical else ref_name, ''),
                ('' if p.theoretical else p.hp_level, ''),
            ]
            # The page shades a row when a picked pump matches it.
            picked = any(sp.refrigerant == p.refrigerant and sp.T_sink == p.T_sink
                         for sp in selected_hp_points)
            rows += (f"<tr style='background-color:#E2E8F0'>" if picked else "<tr>") + "".join(
                f"<td style=\"{style}\">{value}</td>" if style else f"<td>{value}</td>"
                for value, style in cells
            ) + "</tr>"

        # Say which filters shaped the table and chart, or a filtered table
        # reads as the full one.
        f = hp_filters
        names = texts['hp_filter_names']
        applied = [f"{names[k]}: {escape(v)}" for k, v in
                   (("medium_sink", f.medium_sink), ("refrigerant_type", f.refrigerant_type)) if v != "All"]
        applied += [f"{names[k]}: {escape(', '.join(v))}" for k, v in
                    (("refrigerants", f.refrigerants), ("hp_levels", f.hp_levels)) if v]
        applied += [texts[k] for k, on in (("hp_filter_theoretical_hidden", not f.show_theoretical),
                                           ("hp_filter_source_limited", f.show_source_limited),
                                           ("hp_filter_demand_limited", f.show_demand_limited)) if on]
        filters_html = (f"<p class='pa-hp-filters'><strong>{texts['hp_filters_applied']}:</strong> "
                        f"{' · '.join(applied)}</p>") if applied else ""

        opt_table_html = f"""
        <h3>{texts['hp_table_title']} ({display_name})</h3>{filters_html}
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
    
    comp_html = gcc_html = int_html = ""
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
                                       selected_hp_points, hp_filters)
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

    # Interval
    if pr.temperatures and pr.streams_data:
        fig = go.Figure()
        for i, strm in enumerate(pr.streams_data):
            color = 'red' if strm.get('type') == 'HOT' else 'blue'
            fig.add_trace(go.Scatter(x=[i+1, i+1], y=[strm.get('ss'), strm.get('st')], mode='lines', line=dict(color=color, width=10)))
        fig.update_layout(**chart_layout_base, title=texts['interval_diagram'])
        int_html = fig.to_html(full_html=False, include_plotlyjs=False)

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
        <h3>{texts['interval_diagram']}</h3>
        <div class="plot-section" style="width:100%">{int_html}</div>
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
            sc.selected_hp_points, sc.hp_filters, sc.energy_demands, sc_map_html,
            lang=lang,
            include_plotly_js=(i == 0)
        )

    # 4. Comparison Summary Page
    comparison_html = ""
    if req.scenarios:
        nav_links_html += f'<li class="nav-tab" onclick="showPage(\'comparison-summary\')">⚖️ {texts["comparison"]}</li>'
        sc_rows = ""
        sc_names, sc_hot, sc_cold = [], [], []
        sc_best_cop, sc_tot_heat = [], []
        
        for sc in req.scenarios:
            sc_disp_name = texts['all_streams'] if sc.name.lower() == 'all streams' else sc.name
            phu = sc.pinch_result.hot_utility if sc.pinch_result else 0
            pcu = sc.pinch_result.cold_utility if sc.pinch_result else 0
            
            # Additional detailed metrics
            tot_heat = sum(d.heat_demand for d in sc.energy_demands)
            tot_cool = sum(d.cooling_demand for d in sc.energy_demands)
            sh = tot_heat - phu
            sh_pct = (abs(sh)/tot_heat*100) if tot_heat > 0 else 0
            
            best = _hp_view(sc.hpi_optimization_result, sc.selected_hp_points, sc.hp_filters).box if sc.hpi_optimization_result else None

            hc_heat = min(best.Q_demand, phu) if best else 0
            coverage = (hc_heat / phu * 100) if phu > 0 else 0
            best_cop = best.COP if best else 0

            sc_names.append(sc_disp_name)
            sc_hot.append(phu)
            sc_cold.append(pcu)
            sc_best_cop.append(best_cop)
            sc_tot_heat.append(tot_heat)
            
            sc_rows += f"<tr><td><strong>{sc_disp_name}</strong></td><td>{sc.t_min}K</td><td>{tot_heat:.1f}</td><td>{phu:.1f}</td><td>{tot_cool:.1f}</td><td>{pcu:.1f}</td><td style='background:#e8f5e9'>{sh:.1f}</td><td style='background:#e8f5e9'>{sh_pct:.1f}%</td><td style='background:#f3e5f5'>{_fmt(best_cop)}</td><td style='background:#f3e5f5'>{coverage:.1f}%</td></tr>"
        
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
                        </tr>
                        <tr>
                            <th style="background:#ffebee; color:#d32f2f;">STATUS QUO</th><th style="background:#ffebee; color:#d32f2f;">PINCH MIN.</th>
                            <th style="background:#e3f2fd; color:#1976d2;">STATUS QUO</th><th style="background:#e3f2fd; color:#1976d2;">PINCH MIN.</th>
                            <th style="background:#e8f5e9; color:#388e3c;">SAVINGS (KW)</th><th style="background:#e8f5e9; color:#388e3c;">SAVINGS (%)</th>
                            <th style="background:#f3e5f5; color:#7b1fa2;">BEST COP</th><th style="background:#f3e5f5; color:#7b1fa2;">COVERAGE (%)</th>
                        </tr>
                    </thead>
                    <tbody>{sc_rows}</tbody>
                </table>
            </div>

            <div class="hpi-flex-row">
                <div class="hpi-table-col"><div class="plot-section">{comp_chart}</div></div>
                <div class="hpi-table-col"><div class="plot-section">{perf_chart}</div></div>
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

