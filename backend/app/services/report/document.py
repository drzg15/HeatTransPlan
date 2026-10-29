"""The whole report: data collection page, scenario pages, comparison page."""

import re
from datetime import datetime
from html import escape
from typing import Dict, List, Optional

import plotly.graph_objects as go
from plotly.offline import get_plotlyjs_version

from app.models.report import ReportRequest, ReportStream
from app.services.map_service import generate_process_map_b64
from app.services.project_analysis import stream_info
from app.services.report.figures import _chart
from app.services.report.formatting import _de, _fmt, _part
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
    """The report as one HTML file: an overview of the scenarios, the
    collected data, then each scenario through the app's steps 2–4."""
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M')
    lang = req.language if req.language in I18N else "en"
    texts = I18N[lang]

    # 1. Map images (Project-wide - Data Collection)
    map_cache: Dict[tuple, str] = {}
    original_base = req.current_base
    
    req.current_base = 'OpenStreetMap'
    osm_overlaid_b64 = _map_b64_cached(req, map_cache)
    map_osm_html = f"<img src='data:image/png;base64,{osm_overlaid_b64}' alt='{texts['map_osm']}'>" if osm_overlaid_b64 else f"<p>{texts['process_maps']} N/A</p>"
    
    req.current_base = 'Satellite'
    sat_overlaid_b64 = _map_b64_cached(req, map_cache)
    map_sat_html = f"<img src='data:image/png;base64,{sat_overlaid_b64}' alt='{texts['map_sat']}'>" if sat_overlaid_b64 else f"<p>{texts['process_maps']} N/A</p>"
    
    req.current_base = original_base

    # 2. Data collection table
    subprocess_to_process = {s_idx: g_idx for g_idx, g_subs in enumerate(req.proc_groups) for s_idx in g_subs}
    data_rows = []
    for sp_idx, sp in enumerate(req.processes):
        p_idx = subprocess_to_process.get(sp_idx)
        process_name = req.proc_group_names[p_idx] if p_idx is not None and p_idx < len(req.proc_group_names) else "Unknown"
        for s in (sp.streams or []):
            # Read the way the analysis reads it: any input format, in base units.
            info = stream_info(s)
            s_type = s.get('type', '')
            localized_type = texts['hot'] if s_type == 'HOT' else (texts['cold'] if s_type == 'COLD' else s_type)
            cells = [_fmt(info[k]) for k in ('tin', 'tout', 'mdot', 'cp', 'CP', 'Q')]

            data_rows.append(
                # Names are typed by users (or an AI): text, never markup.
                f"<tr><td>{escape(str(process_name))}</td><td>{escape(str(sp.name))}</td><td>{escape(str(s.get('name')))}</td>"
                f"<td>{escape(str(localized_type))}</td>" + "".join(f"<td>{c}</td>" for c in cells) + "</tr>"
            )
    data_rows_html = "".join(data_rows)

    # 3. Compile Individual Scenario Pages
    scenario_pages_html = ""
    # The table of contents: (anchor, label); the overview goes first.
    toc: List[tuple] = [("data-collection", f"1 · {texts['part_1']}", "")]
    
    # Render each saved scenario
    for i, sc in enumerate(req.scenarios):
        sc_id = f"scenario-{i}"
        sc_disp_name = texts['all_streams'] if sc.name.lower() == 'all streams' else sc.name
        
        # Regenerate map for this specific scenario
        old_streams = req.selected_streams
        req.selected_streams = sc.selected_streams
        sc_map_b64 = _map_b64_cached(req, map_cache)
        sc_map_html = f"<img src='data:image/png;base64,{sc_map_b64}'>" if sc_map_b64 else f"<p>{texts['map_not_avail']}</p>"
        req.selected_streams = old_streams

        page = _render_pinch_content(
            sc.name, sc_id, sc.t_min, sc.pinch_result, sc.selected_streams, sc.hpi_optimization_result,
            sc.selected_hp_points, sc.energy_demands, sc_map_html,
            lang=lang,
            economics=sc.economics,
        )
        scenario_pages_html += page
        # The scenario, then the app's steps it reached, as they appear on it.
        toc.append((sc_id, escape(sc_disp_name), ""))
        for n in re.findall(rf"id='{sc_id}-p(\d)'", page):
            toc.append((f"{sc_id}-p{n}", f"{n} · {texts[f'part_{n}']}", "sub"))

    # 4. Comparison Summary Page
    comparison_html = ""
    if req.scenarios:
        toc.insert(0, ("overview", texts['comparison_summary'], ""))
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
                    f"<td class='c-econ'>{_de(num['capex'])}</td>"
                    f"<td class='c-econ' style='font-weight:700;color:{npv_colour}'>{_de(npv)}</td>"
                    f"<td class='c-econ'>{payback}</td>"
                    f"<td class='c-econ'>{_de(num['saving1'])}</td>"
                )
            else:
                sc_npv.append(None)
                econ_cells = "<td class='c-econ'>—</td>" * 4

            sc_rows += f"<tr><td><strong>{escape(sc_disp_name)}</strong></td><td>{sc.t_min} K</td><td>{tot_heat:.1f}</td><td>{phu:.1f}</td><td>{tot_cool:.1f}</td><td>{pcu:.1f}</td><td class='c-rec'>{sh:.1f}</td><td class='c-rec'>{sh_pct:.1f}%</td><td class='c-hp'>{_fmt(best_cop)}</td><td class='c-hp'>{coverage:.1f}%</td>{econ_cells}</tr>"
        
        fig = go.Figure([go.Bar(x=sc_names, y=sc_tot_heat, name=texts['status_quo_hot'], marker_color='#dc2626', opacity=0.3, showlegend=False), 
                         go.Bar(x=sc_names, y=sc_hot, name=texts['hot'], marker_color='#dc2626'), 
                         go.Bar(x=sc_names, y=sc_cold, name=texts['cold'], marker_color='#2563eb')])
        fig.update_layout(height=360, barmode='group')
        comp_chart = _chart(fig, texts['utilities_comparison'])

        # Second chart: Performance Metrics
        fig_perf = go.Figure()
        fig_perf.add_trace(go.Scatter(x=sc_names, y=sc_best_cop, mode='lines+markers', name=texts['best_cop'], line=dict(color='#7c3aed', width=3, dash='dot'), marker=dict(size=8)))
        fig_perf.update_layout(
            height=360, yaxis=dict(title=texts['best_cop'], autorange=True, rangemode='tozero'),
        )
        perf_chart = _chart(fig_perf, texts['best_cop_title'])

        npv_chart = ""
        if any(v is not None for v in sc_npv):
            fig_npv = go.Figure(go.Bar(
                x=sc_names, y=sc_npv, name=texts['econ_npv'],
                marker_color=['#C62828' if (v or 0) < 0 else '#2E7D32' for v in sc_npv],
                hovertemplate='%{x}: %{y:,.0f} €<extra></extra>',
            ))
            fig_npv.update_layout(height=360, separators=',.',
                                  yaxis=dict(title='€', tickformat=',.0f', zeroline=True))
            npv_chart = _chart(fig_npv, texts['econ_npv_title'])

        comparison_html = f"""
        <section id="overview" class="report-section">
            <h1 class="section-title">{texts['comparison_summary']}</h1>
            <div class="card">
            <h4>{texts['cmp_table_title']}</h4>
            <div class="table-wrap">
            <table class="data-table cmp-table">
                <thead>
                    <tr>
                        <th rowspan="2">{texts['scenario']}</th>
                        <th rowspan="2">ΔTmin</th>
                        <th colspan="2" class="c-hot">{texts['heating_kw']}</th>
                        <th colspan="2" class="c-cold">{texts['cooling_kw']}</th>
                        <th colspan="2" class="c-rec">{texts['recovery_potential']}</th>
                        <th colspan="2" class="c-hp">{texts['part_3']}</th>
                        <th colspan="4" class="c-econ">{texts['part_4']}</th>
                    </tr>
                    <tr>
                        <th class="c-hot">{texts['status_quo']}</th><th class="c-hot">{texts['pinch_min']}</th>
                        <th class="c-cold">{texts['status_quo']}</th><th class="c-cold">{texts['pinch_min']}</th>
                        <th class="c-rec">{texts['savings']} (kW)</th><th class="c-rec">{texts['savings']} (%)</th>
                        <th class="c-hp">{texts['best_cop']}</th><th class="c-hp">{texts['coverage_pct']}</th>
                        <th class="c-econ">{texts['econ_invest']}</th><th class="c-econ">{texts['econ_npv']}</th>
                        <th class="c-econ">{texts['econ_payback']}</th><th class="c-econ">{texts['econ_saving1']}</th>
                    </tr>
                </thead>
                <tbody>{sc_rows}</tbody>
            </table>
            </div>
            </div>

            <div class="grid-3">{comp_chart}{perf_chart}{npv_chart}</div>
        </section>"""

    ai_meta = '<meta name="generator" content="HeatTransPlan, AI assistant via MCP">' if req.created_by_ai else ""
    ai_note = f'<p class="ai-note">{texts["ai_note"]}</p>' if req.created_by_ai else ""
    # Plotly once for every chart, the version the figures were made with.
    plotly_js = (f'<script src="https://cdn.plot.ly/plotly-{get_plotlyjs_version()}.min.js" charset="utf-8"></script>'
                 if req.scenarios else "")
    plotly_note = f'<p class="muted small">{texts["plotly_note"]}</p>' if req.scenarios else ""
    toc_html = "".join(f'<li class="{cls}"><a href="#{anchor}">{label}</a></li>' for anchor, label, cls in toc)

    # Final HTML assembly. Colours, type and the numbered banners follow the
    # app (frontend/src/index.css, components/ui/Part.css).
    html = f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{texts['report_title']}</title>{ai_meta}
{plotly_js}
<style>
    :root {{ --primary:#2b589c; --text:#0f172a; --muted:#64748b; --border:#e2e8f0; --bg:#f1f5f9; --surface:#fff; --radius:12px; }}
    * {{ box-sizing:border-box; }}
    html {{ scroll-behavior:smooth; }}
    body {{ font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color:var(--text); background:var(--bg); margin:0; line-height:1.5; font-size:14px; }}
    .layout {{ display:grid; grid-template-columns:240px minmax(0,1fr); min-height:100vh; }}
    .toc {{ position:sticky; top:0; height:100vh; overflow-y:auto; padding:24px 16px; background:var(--surface); border-right:1px solid var(--border); }}
    .toc-brand {{ font-weight:700; font-size:1rem; margin-bottom:2px; }}
    .toc-brand::before {{ content:''; display:block; height:4px; width:48px; border-radius:2px; margin-bottom:12px; background:linear-gradient(90deg,#2b589c 0%,#b4396e 50%,#e13945 100%); }}
    .toc ol {{ list-style:none; padding:0; margin:20px 0 0; }}
    .toc a {{ display:block; padding:7px 10px; border-radius:8px; color:var(--text); text-decoration:none; font-weight:500; }}
    .toc a:hover {{ background:var(--bg); }}
    .toc a.active {{ background:var(--primary); color:#fff; }}
    .toc li.sub a {{ padding:5px 10px 5px 22px; font-size:0.85rem; font-weight:400; color:var(--muted); }}
    .toc li.sub a.active {{ color:#fff; }}
    .part {{ scroll-margin-top:16px; }}
    main {{ padding:32px clamp(16px,3vw,48px) 64px; max-width:1600px; }}
    .cover h1 {{ font-size:2rem; margin:0 0 4px; letter-spacing:-0.01em; }}
    .muted {{ color:var(--muted); }} .small {{ font-size:0.8rem; }}
    .ai-note {{ color:#7a4b00; background:#fff4e0; padding:8px 12px; border-radius:8px; }}
    .report-section {{ margin-top:40px; scroll-margin-top:16px; }}
    .section-title {{ font-size:1.5rem; margin:0 0 16px; letter-spacing:-0.01em; }}
    .section-sub {{ font-size:0.95rem; font-weight:400; color:var(--muted); margin-left:8px; }}
    .part {{ display:flex; align-items:center; flex-wrap:wrap; gap:12px; padding:10px 16px; margin:28px 0 14px; background:var(--primary); color:#fff; border-radius:var(--radius); }}
    .part h2 {{ margin:0; font-size:1.05rem; }}
    .part-num {{ display:inline-flex; align-items:center; justify-content:center; width:2rem; height:2rem; border-radius:50%; background:#fff; color:var(--primary); font-weight:700; }}
    .part-in {{ font-size:0.85rem; opacity:0.85; }}
    h3 {{ font-size:1rem; margin:24px 0 10px; }}
    h4 {{ margin:0 0 10px; font-size:0.85rem; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:0.04em; }}
    .card, .chart {{ background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin:0 0 16px; box-shadow:0 1px 2px rgba(15,23,42,0.04); }}
    .chart {{ padding:12px 12px 4px; min-width:0; }}
    .chart figcaption {{ font-weight:600; font-size:0.95rem; padding:2px 4px 4px; }}
    .grid-2, .grid-3 {{ display:grid; gap:16px; align-items:start; }}
    /* Fixed columns: a chart is drawn as soon as it is read, before the cards
       after it exist, so its column must already have its final width. */
    .grid-2 {{ grid-template-columns:repeat(2, minmax(0, 1fr)); }}
    .grid-3 {{ grid-template-columns:repeat(3, minmax(0, 1fr)); }}
    @media (max-width: 1100px) {{ .grid-3 {{ grid-template-columns:repeat(2, minmax(0, 1fr)); }} }}
    @media (max-width: 760px) {{ .grid-2, .grid-3 {{ grid-template-columns:minmax(0, 1fr); }} }}
    .grid-2 > *, .grid-3 > * {{ margin:0; }}
    .map-card img, .maps img {{ display:block; max-width:100%; border-radius:8px; }}
    .maps figure {{ margin:0; }}
    .maps figcaption {{ font-weight:600; color:var(--muted); margin-top:8px; text-align:center; }}
    .table-wrap {{ overflow-x:auto; }}
    .data-table {{ width:100%; border-collapse:collapse; font-size:0.82rem; font-variant-numeric:tabular-nums; }}
    .data-table th, .data-table td {{ padding:8px 10px; text-align:left; border-bottom:1px solid var(--border); }}
    .data-table th {{ background:#f8fafc; color:var(--muted); font-weight:600; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.03em; }}
    .data-table tbody tr:hover {{ background:#f8fafc; }}
    .cmp-table td, .cmp-table th {{ text-align:center; }}
    .c-hot {{ background:#fef2f2 !important; }} .c-cold {{ background:#eff6ff !important; }} .c-rec {{ background:#f0fdf4 !important; }} .c-hp {{ background:#f5f3ff !important; }} .c-econ {{ background:#fffbeb !important; }}
    .notes {{ background:var(--surface); padding:14px 16px; border:1px solid var(--border); border-left:4px solid var(--primary); border-radius:8px; white-space:pre-wrap; }}
    .callout {{ background:var(--surface); padding:12px 16px; border:1px solid var(--border); border-left:4px solid; border-radius:8px; }}
    .badge {{ font-weight:600; }}
    .metrics-row {{ display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:12px; margin:0 0 16px; }}
    .metric-card {{ background:var(--surface); padding:14px 16px; border:1px solid var(--border); border-radius:var(--radius); border-top:3px solid var(--primary); }}
    .metric-card.hot {{ border-top-color:#dc2626; }} .metric-card.cold {{ border-top-color:#2563eb; }} .metric-card.pinch {{ border-top-color:#94a3b8; }} .metric-card.recovery {{ border-top-color:#16a34a; }}
    .metric-label {{ font-size:0.72rem; color:var(--muted); text-transform:uppercase; letter-spacing:0.04em; }}
    .metric-value {{ font-size:1.45rem; font-weight:700; margin-top:2px; font-variant-numeric:tabular-nums; }}
    .metric-card .metric-value {{ color:var(--text); }}
    .pa-hp-table-wrap {{ overflow-x:auto; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); margin:0 0 16px; }}
    .pa-hp-table {{ width:100%; border-collapse:collapse; font-size:0.75rem; font-variant-numeric:tabular-nums; }}
    .pa-hp-table th, .pa-hp-table td {{ padding:7px 9px; text-align:left; white-space:nowrap; border-bottom:1px solid var(--border); }}
    .pa-hp-table th {{ background:#f8fafc; color:var(--muted); font-weight:600; }}
    .econ-kpi {{ background:var(--surface); padding:12px 14px; border:1px solid var(--border); border-left-width:4px; border-radius:var(--radius); }}
    .econ-kpi-value {{ font-size:1.25rem; font-weight:700; }}
    .econ-unit {{ font-size:0.75rem; font-weight:600; }}
    .econ-kpi-sub {{ font-size:0.75rem; color:#334155; }}
    .econ-grid {{ display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap:12px; align-items:start; }}
    .econ-table {{ margin:0; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; }}
    @media (max-width: 900px) {{
        .layout {{ display:block; }}
        .toc {{ position:sticky; height:auto; z-index:10; padding:10px 12px; border-right:none; border-bottom:1px solid var(--border); }}
        .toc-brand, .toc-brand::before {{ display:none; }}
        .toc ol {{ display:flex; gap:6px; overflow-x:auto; margin:0; }}
        .toc a {{ white-space:nowrap; }}
        .report-section {{ scroll-margin-top:64px; }}
    }}
    @media print {{
        body {{ background:#fff; font-size:12px; }} .layout {{ display:block; }} .toc {{ display:none; }} main {{ padding:0; max-width:none; }}
        .report-section {{ break-before:page; }} .card, .chart, .metric-card {{ box-shadow:none; break-inside:avoid; }}
        .part, .c-hot, .c-cold, .c-rec, .c-hp, .c-econ {{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }}
    }}
</style>
</head>
<body>
<div class="layout">
<nav class="toc" aria-label="{texts['report_title']}">
    <div class="toc-brand">HeatTransPlan</div>
    <div class="muted small">{texts['report_title']}</div>
    <ol>{toc_html}</ol>
</nav>
<main>
    <header class="cover">
        <h1>{texts['report_title']}</h1>
        <p class="muted">HeatTransPlan · {texts['generated']}: {now_str}</p>{ai_note}{plotly_note}
    </header>

    {comparison_html}

    <section id="data-collection" class="report-section">
        <h1 class="section-title">{texts['data_collection']}</h1>
        {_part(1, texts)}
        <h3>{texts['process_maps']}</h3>
        <div class="grid-2 maps">
          <figure class="card">{map_osm_html}<figcaption>{texts['map_osm']}</figcaption></figure>
          <figure class="card">{map_sat_html}<figcaption>{texts['map_sat']}</figcaption></figure>
        </div>
        <h3>{texts['collected_data']}</h3>
        <div class="card table-wrap">
        <table class="data-table">
            <thead><tr><th>{texts['process']}</th><th>{texts['subprocess']}</th><th>{texts['stream']}</th><th>{texts['type']}</th><th>Tin (°C)</th><th>Tout (°C)</th><th>ṁ (kg/s)</th><th>cp (kJ/(kg·K))</th><th>CP (kW/K)</th><th>Q (kW)</th></tr></thead>
            <tbody>{data_rows_html}</tbody>
        </table>
        </div>
        <h3>{texts['notes']}</h3><div class="notes">{escape(req.project_notes) if req.project_notes else texts['no_notes']}</div>
    </section>

    {scenario_pages_html}
</main>
</div>
<script>
// Each chart is drawn while the page is still being read in, before its
// neighbours in the row exist, so it first takes the whole row. Re-measure
// whenever its card changes size.
if (window.Plotly) {{
    const fit = new ResizeObserver(es => es.forEach(e => Plotly.Plots.resize(e.target)));
    document.querySelectorAll('.js-plotly-plot').forEach(p => fit.observe(p));
}}
// The table of contents marks the section being read.
const links = [...document.querySelectorAll('.toc a')];
const seen = new IntersectionObserver(entries => entries.forEach(e => {{
    if (!e.isIntersecting) return;
    links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
}}), {{ rootMargin: '-20% 0px -70% 0px' }});
document.querySelectorAll('.report-section, .part[id]').forEach(s => seen.observe(s));
</script>
</body></html>"""

    return html
