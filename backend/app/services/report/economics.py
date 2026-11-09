"""The economic analysis section of a scenario page."""

from html import escape
from typing import Any, Dict, Optional

from app.services.report.figures import _spec_chart
from app.services.report.formatting import _part


def _render_economics(econ: Optional[Dict[str, Any]], texts: Dict[str, str], anchor: str = "") -> str:
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

    figs = econ.get("figures", [])
    bar, price, npv, sens, size = ([_spec_chart(f, wide=i >= 2) for i, f in enumerate(figs)] + [""] * 5)[:5]

    summary = econ.get("summary") or {}
    border = "#2E7D32" if summary.get("good") else "#C62828"

    return f"""
    {_part(4, texts, econ.get('pump', ''), anchor)}
    <h3>{escape(lab.get('key', ''))}</h3>
    <div class="metrics-row">{kpis}</div>
    <h3>{escape(lab.get('inputs', ''))}</h3>
    <div class="econ-grid">{inputs}</div>
    <h3>{escape(lab.get('results', ''))}</h3>
    <div class="econ-grid">{results}</div>
    <h3>{escape(lab.get('charts', ''))}</h3>
    <div class="grid-2">{bar}{price}</div>
    {npv}
    <h3>{escape(lab.get('sensitivity', ''))}</h3>
    <p class="muted">{escape(econ.get('sens_explain', ''))}</p>
    {sens}
    <h3>{escape(lab.get('size', ''))}</h3>
    <p class="muted">{escape(econ.get('size_explain', ''))}</p>
    {size}
    <h3>{escape(lab.get('summary', ''))}</h3>
    <p class="callout" style="border-left-color:{border}">
        <b>{escape(summary.get('name', ''))}:</b> {escape(summary.get('text', ''))}
    </p>
    """
