"""
Report generation service — produces self-contained HTML report.
Includes detailed pages for every saved scenario and a comparison overview.
"""

from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional

import plotly.graph_objects as go
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
        "interval_diagram": "Interval Diagram",
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
        "map_not_avail": "Map not available"
    },
    "de": {
        "report_title": "Wärmeintegrationsbericht",
        "generated": "Generiert",
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
        "status_quo": "Status Quo",
        "savings": "Einsparung",
        "hp_hdr": "WP-Abdeckung",
        "hp_hdr_kw": "WP – {name} (kW)",
        "hp_integration": "Wärmepumpen-Integration",
        "hp_table_hdr": "Wärmepumpe",
        "diagrams": "Diagramme",
        "interval_diagram": "Intervalldiagramm",
        "scenario": "Szenario",
        "comparison_summary": "Szenarienvergleich",
        "utilities_comparison": "Vergleich der Versorgungsleistungen",
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
        "medium_sink": "Senken-Medium",
        "refrigerant": "Kältemittel",
        "opt_hp_title": "Optimierung - Machbare Wärmepumpenlösungen",
        "orig_gcc": "Ursprüngliche Großverbundkurve",
        "heat_source_pocketless": "Wärmequelle (ohne Pockets)",
        "heat_sink_pocketless": "Wärmesenke (ohne Pockets)",
        "active_sink": "Aktive Senke",
        "active_source": "Aktive Quelle",
        "shifted_t": "Verschobene T (°C)",
        "net_delta_h": "Netto-Wärmestrom ΔH (kW)",
        "heat_capacity_q": "Wärmekapazitätsstrom Q (kW)",
        "temperature": "Temperatur (°C)",
        "map_not_avail": "Karte nicht verfügbar"
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


def _render_pinch_content(
    name: str,
    id_slug: str,
    t_min: float,
    pinch_result: Any,
    selected_streams: List[ReportStream],
    heat_pumps: List[Any],
    hpi_optimization_result: Any,
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

        hp_sorted = sorted([hp for hp in heat_pumps if hp.available], key=lambda x: x.cop or 0, reverse=True)
        best = hp_sorted[0] if hp_sorted else None
        if best and best.q_sink is not None and best.q_source is not None:
            hc_heat = min(best.q_sink, pr.hot_utility)
            hc_cool = min(best.q_source, pr.cold_utility)
            hp_hdr = texts['hp_hdr_kw'].format(name=best.name)
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

    # HP table
    hp_table_html = ""
    hp_rows = ""
    for hp in sorted([h for h in heat_pumps if h.available], key=lambda x: x.cop or 0, reverse=True):
        hp_rows += (
            f"<tr><td>{hp.name}</td><td>{_fmt(hp.cop)}</td>"
            f"<td>{_fmt(hp.t_source, 1)}</td><td>{_fmt(hp.t_sink, 1)}</td>"
            f"<td>{_fmt(hp.q_source, 1)}</td><td>{_fmt(hp.q_sink, 1)}</td></tr>\n"
        )
    if hp_rows:
        hp_table_html = f"""
        <h3>{texts['hp_integration']} ({display_name})</h3>
        <table class='data-table'>
          <thead><tr><th>{texts['hp_table_hdr']}</th><th>COP</th><th>{texts['t_source']} (°C)</th><th>{texts['t_sink']} (°C)</th><th>{texts['q_source']} (kW)</th><th>{texts['q_sink']} (kW)</th></tr></thead>
          <tbody>{hp_rows}</tbody>
        </table>"""

    opt_table_html = ""
    if hpi_optimization_result and getattr(hpi_optimization_result, "max_q_point", None):
        opt = hpi_optimization_result.max_q_point
        opt_table_html = f"""
        <h3>{texts['opt_hp']} ({display_name})</h3>
        <table class='data-table'>
          <thead><tr><th>{texts['type']}</th><th>{texts['medium_sink']}</th><th>{texts['refrigerant']}</th><th>COP</th><th>{texts['t_source']} (°C)</th><th>{texts['t_sink']} (°C)</th><th>{texts['q_source']} (kW)</th><th>{texts['q_demand']} (kW)</th></tr></thead>
          <tbody>
            <tr>
              <td>{opt.hp_level}</td>
              <td>{opt.medium_sink}</td>
              <td>{opt.refrigerant}</td>
              <td>{_fmt(opt.COP)}</td>
              <td>{_fmt(opt.T_source, 1)}</td>
              <td>{_fmt(opt.T_sink, 1)}</td>
              <td>{_fmt(opt.Q_source, 1)}</td>
              <td>{_fmt(opt.Q_demand, 1)}</td>
            </tr>
          </tbody>
        </table>"""

    # Charts
    chart_layout_base = dict(
        height=400, margin=dict(l=60, r=20, t=40, b=50),
        font=dict(size=11), hovermode='closest', template='plotly_white'
    )
    
    comp_html = gcc_html = hpi_html = int_html = ""
    include_js = 'cdn' if include_plotly_js else False

    # Composite
    if pr.composite_diagram.hot.get("H"):
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=pr.composite_diagram.hot["H"], y=pr.composite_diagram.hot["T"], mode='lines+markers', name=texts['hot'], line=dict(color='red')))
        fig.add_trace(go.Scatter(x=pr.composite_diagram.cold["H"], y=pr.composite_diagram.cold["T"], mode='lines+markers', name=texts['cold'], line=dict(color='blue')))
        fig.add_hline(y=pr.pinch_temperature, line_dash='dash', line_color='gray', annotation_text="Pinch")
        fig.update_layout(**chart_layout_base, title=texts['composite_title'], xaxis_title='H (kW)', yaxis_title='T (°C)')
        comp_html = fig.to_html(full_html=False, include_plotlyjs=include_js)

    # Optimization Chart
    opt_chart_html = ""
    if hpi_optimization_result and getattr(hpi_optimization_result, "pocketless_source", None) and getattr(hpi_optimization_result, "pocketless_sink", None):
        fig = go.Figure()
        
        # Original GCC
        if pr.grand_composite_curve.get("H"):
            fig.add_trace(go.Scatter(
                x=pr.grand_composite_curve["H"],
                y=pr.grand_composite_curve["T"],
                mode='lines+markers',
                line=dict(color='gray', width=2),
                marker=dict(size=3, color='gray'),
                name=texts['orig_gcc'],
                showlegend=False
            ))
            
        # Pocketless Source
        psrc = hpi_optimization_result.pocketless_source
        if psrc.get("H"):
            fig.add_trace(go.Scatter(
                x=psrc["H"],
                y=psrc["T"],
                mode='lines',
                line=dict(color='red', width=3),
                name=texts['heat_source_pocketless'],
                showlegend=False
            ))
            
        # Pocketless Sink
        psnk = hpi_optimization_result.pocketless_sink
        if psnk.get("H"):
            fig.add_trace(go.Scatter(
                x=psnk["H"],
                y=psnk["T"],
                mode='lines',
                line=dict(color='blue', width=3),
                name=texts['heat_sink_pocketless'],
                showlegend=False
            ))
            
        # Max Q Point (Active)
        opt = getattr(hpi_optimization_result, "max_q_point", None)
        if opt:
            # Active Sink
            fig.add_trace(go.Scatter(
                x=[opt.Q_demand],
                y=[opt.T_sink],
                mode='markers',
                name=texts['active_sink'],
                showlegend=False,
                marker=dict(size=9, color='blue', symbol='circle', line=dict(width=2, color='black')),
                hoverinfo='text',
                text=[f"{texts['active_sink']}<br>T: {opt.T_sink:.1f}°C<br>{texts['q_demand']}: {opt.Q_demand:.1f} kW<br>COP: {opt.COP:.2f}"]
            ))
            # Active Source
            q_src = opt.Q_demand * (opt.COP - 1) / opt.COP
            fig.add_trace(go.Scatter(
                x=[q_src],
                y=[opt.T_source],
                mode='markers',
                name=texts['active_source'],
                showlegend=False,
                marker=dict(size=9, color='red', symbol='circle', line=dict(width=2, color='black')),
                hoverinfo='text',
                text=[f"{texts['active_source']}<br>T: {opt.T_source:.1f}°C<br>{texts['q_source']}: {q_src:.1f} kW<br>COP: {opt.COP:.2f}"]
            ))
            
        fig.add_hline(y=pr.pinch_temperature, line_dash='dash', line_color='gray', annotation_text=f"Pinch: {pr.pinch_temperature:.1f}°C")
        fig.update_layout(**chart_layout_base, title=texts['opt_hp_title'], xaxis_title=texts['heat_capacity_q'], yaxis_title=texts['temperature'])
        opt_chart_html = fig.to_html(full_html=False, include_plotlyjs=False)

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

    # HPI
    if heat_pumps and pr.grand_composite_curve.get("H"):
        gcc_H = pr.grand_composite_curve["H"]
        gcc_T = pr.grand_composite_curve["T"]
        hc = pr.heat_cascade
        fig = go.Figure()
        
        for i in range(len(gcc_H) - 1):
            seg_color = 'rgba(255, 0, 0, 0.4)' if i < len(hc) and hc[i].get('deltaH', 0) > 0 else ('rgba(0, 0, 255, 0.4)' if i < len(hc) and hc[i].get('deltaH', 0) < 0 else 'rgba(128, 128, 128, 0.4)')
            fig.add_trace(go.Scatter(
                x=[gcc_H[i], gcc_H[i+1]], 
                y=[gcc_T[i], gcc_T[i+1]], 
                mode='lines', 
                line=dict(color=seg_color, width=2), 
                showlegend=False,
                hoverinfo='skip'
            ))

        hp_colors = ['#00CC96', '#AB63FA', '#FFA15A']
        for idx, hp in enumerate([h for h in heat_pumps if h.available][:3]):
            c = hp_colors[idx % len(hp_colors)]
            fig.add_trace(go.Scatter(x=[hp.q_source, hp.q_sink], y=[hp.t_source, hp.t_sink], mode='markers', marker=dict(size=12, color=c, symbol='diamond'), name=hp.name))
        fig.update_layout(**chart_layout_base, title=texts['hpi_title'])
        hpi_html = fig.to_html(full_html=False, include_plotlyjs=False)

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
        <div class="hpi-flex-row">
            <div class="hpi-table-col">{hp_table_html}</div>
            <div class="hpi-chart-col"><div class="plot-section">{hpi_html}</div></div>
        </div>
        <div class="hpi-flex-row" style="margin-top: 20px;">
            <div class="hpi-table-col">{opt_table_html}</div>
            <div class="hpi-chart-col"><div class="plot-section">{opt_chart_html}</div></div>
        </div>
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
            sc.name, sc_id, sc.t_min, sc.pinch_result, sc.selected_streams, sc.heat_pumps, sc.hpi_optimization_result, sc.energy_demands, sc_map_html,
            lang=lang,
            include_plotly_js=(i == 0)
        )

    # 4. Comparison Summary Page
    comparison_html = ""
    if req.scenarios:
        nav_links_html += f'<li class="nav-tab" onclick="showPage(\'comparison-summary\')">⚖️ {texts["comparison"]}</li>'
        sc_rows = ""
        sc_names, sc_hot, sc_cold = [], [], []
        for sc in req.scenarios:
            sc_disp_name = texts['all_streams'] if sc.name.lower() == 'all streams' else sc.name
            phu = sc.pinch_result.hot_utility if sc.pinch_result else 0
            pcu = sc.pinch_result.cold_utility if sc.pinch_result else 0
            sc_names.append(sc_disp_name); sc_hot.append(phu); sc_cold.append(pcu)
            sc_rows += f"<tr><td><strong>{sc_disp_name}</strong></td><td>{sc.t_min}K</td><td>{phu:.1f} kW</td><td>{pcu:.1f} kW</td></tr>"
        
        fig = go.Figure([go.Bar(x=sc_names, y=sc_hot, name=texts['hot'], marker_color='#ef4444'), go.Bar(x=sc_names, y=sc_cold, name=texts['cold'], marker_color='#3b82f6')])
        fig.update_layout(height=400, barmode='group', title=texts['utilities_comparison'])
        comp_chart = fig.to_html(full_html=False, include_plotlyjs=False)

        comparison_html = f"""
        <div id="comparison-summary" class="page-content">
            <h2>⚖️ {texts['comparison_summary']}</h2>
            <div class="plot-section">{comp_chart}</div>
            <table class="data-table">
                <thead><tr><th>{texts['scenario']}</th><th>ΔTmin</th><th>{texts['min_heating']}</th><th>{texts['min_cooling']}</th></tr></thead>
                <tbody>{sc_rows}</tbody>
            </table>
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

