"""The economic analysis section of a scenario page."""

from html import escape
from typing import Any, Dict, Optional

import plotly.io as pio


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
