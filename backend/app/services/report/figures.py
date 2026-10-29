"""The optimization chart of the Potential Analysis page, rebuilt for the report."""

import re
from html import escape
from typing import Any, Dict, List

import plotly.graph_objects as go
import plotly.io as pio

from app.services.report.points import (
    _active_points, _headline_point, _on_profile, _q_source, _thin_points,
)

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


# One look for every chart in the report: the app's type, quiet grid lines,
# the title on the card rather than inside the plot.
_FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
_STYLE = dict(
    template='plotly_white',
    font=dict(family=_FONT, size=12, color='#334155'),
    paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)',
    legend=dict(orientation='h', x=0, y=1.0, xanchor='left', yanchor='bottom', bgcolor='rgba(0,0,0,0)'),
    hoverlabel=dict(font=dict(family=_FONT)),
)
_AXIS = dict(gridcolor='#eef2f6', zerolinecolor='#cbd5e1', linecolor='#cbd5e1', automargin=True)
_CONFIG = {'displaylogo': False, 'responsive': True}


def _card(title: str, plot_html: str, wide: bool = False) -> str:
    cls = 'chart wide' if wide else 'chart'
    return f"<figure class='{cls}'><figcaption>{escape(title)}</figcaption>{plot_html}</figure>"


def _chart(fig: go.Figure, title: str, include_plotlyjs: Any = False, wide: bool = False) -> str:
    """A Plotly figure drawn in the report's style, as a titled card."""
    fig.update_layout(title=None, margin=dict(l=56, r=16, t=28, b=48), **_STYLE)
    fig.update_xaxes(**_AXIS)
    fig.update_yaxes(**_AXIS)
    return _card(title, fig.to_html(full_html=False, include_plotlyjs=include_plotlyjs, config=_CONFIG), wide)


def _spec_chart(spec: Dict[str, Any], wide: bool = False) -> str:
    """The same for a chart the page sent as a plotly.js spec (economics).
    Its title moves to the card; the rest of its layout is the page's."""
    layout = dict(spec.get("layout") or {})
    title = layout.pop("title", None)
    title = title.get("text", "") if isinstance(title, dict) else (title or "")
    title = re.sub(r"<[^>]+>", " ", title)  # Plotly markup such as <br>
    layout.update(font=_STYLE['font'], paper_bgcolor=_STYLE['paper_bgcolor'],
                  plot_bgcolor=_STYLE['plot_bgcolor'], hoverlabel=_STYLE['hoverlabel'])
    margin = dict(layout.get("margin") or {})
    margin["t"] = min(margin.get("t", 28), 28)
    layout["margin"] = margin
    # Specs come from plotly.js, so skip the Python-side validation.
    plot = pio.to_html({**spec, "layout": layout}, full_html=False, include_plotlyjs=False,
                       validate=False, config=_CONFIG)
    return _card(title, plot, wide)
