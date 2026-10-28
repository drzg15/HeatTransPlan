"""The whole report: data collection page, scenario pages, comparison page."""

from datetime import datetime
from typing import Dict, List, Optional

import plotly.graph_objects as go

from app.models.report import ReportRequest, ReportStream
from app.services.map_service import generate_process_map_b64
from app.services.report.formatting import _de, _fmt
from app.services.report.points import _headline_point
from app.services.report.scenario import _render_pinch_content
from app.services.report.texts import I18N


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
