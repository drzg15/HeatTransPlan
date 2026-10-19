"""The report shows the optimized heat pump only, with the page's chart."""

from app.models.analysis import HPIOptimizationResult, OptimizedIntegrationPoint, PinchResult
from app.models.report import ReportRequest, ReportStream, ScenarioReportData
from app.services.report_service import _optimization_figure, generate_html_report, I18N


def _point(**kw):
    base = dict(T_source=48.0, T_sink=118.0, Q_source=499.0, Q_demand=750.0, COP=2.98,
                refrigerant="Butane_1", medium_sink="Steam", refrigerant_type="Natural",
                hp_level="1")
    base.update(kw)
    return OptimizedIntegrationPoint(**base)


def _opt():
    best = _point()
    return HPIOptimizationResult(
        feasible_points=[
            best,
            _point(T_sink=100.0, Q_demand=600.0, COP=3.4),
            _point(T_sink=90.0, Q_demand=500.0, COP=3.8, refrigerant="Carnot", theoretical=True),
        ],
        max_q_point=best,
        original_gcc={"H": [0.0, 500.0, 700.0], "T": [73.0, 48.0, 20.0]},
        pocketless_source={"H": [0.0, 500.0], "T": [73.0, 48.0]},
        pocketless_sink={"H": [0.0, 750.0], "T": [73.0, 118.0]},
    )


def _request(language="en"):
    streams = [
        ReportStream(name="Hot", Tin=103.0, Tout=43.0, CP=40.0, Q=2400.0, type="HOT"),
        ReportStream(name="Cold", Tin=68.0, Tout=88.0, CP=50.0, Q=1000.0, type="COLD"),
    ]
    pinch = PinchResult(
        hot_utility=750.0, cold_utility=500.0, pinch_temperature=73.0, T_min=10.0,
        temperatures=[118.0, 73.0, 43.0], problem_table=[], heat_cascade=[],
        unfeasible_heat_cascade=[],
        grand_composite_curve={"H": [0.0, 500.0, 700.0], "T": [73.0, 48.0, 20.0]},
    )
    return ReportRequest(
        language=language,
        selected_streams=streams,
        scenarios=[ScenarioReportData(
            name="All streams", selected_streams=streams, pinch_result=pinch,
            hpi_optimization_result=_opt(), t_min=10.0,
        )],
    )


def test_optimization_figure_draws_the_heat_pump():
    fig = _optimization_figure(_opt(), 73.0, I18N["en"])
    names = [t.name for t in fig.data if t.name]
    assert "Source profile" in names and "Sink profile" in names
    # The heat pump box and its three annotated flows.
    texts = " ".join(a.text or "" for a in fig.layout.annotations)
    assert "COP 2.98" in texts
    assert "P<sub>el</sub>" in texts
    assert "750.0 kW" in texts and "498" in texts.replace(",", "")
    assert any(s.type == "rect" for s in fig.layout.shapes)


def test_report_drops_the_single_point_integration():
    html = generate_html_report(_request())
    assert "Heat Pump Integration" not in html
    assert "Optimization Heat Pump" in html
    assert "Optimization - Feasible Heat Pump Solutions" in html


def test_german_report_has_every_label():
    assert set(I18N["de"]) == set(I18N["en"])
    html = generate_html_report(_request("de"))
    assert "Optimierte Wärmepumpe" in html
