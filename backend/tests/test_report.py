"""The report shows the optimized heat pump only, with the page's chart."""

from app.models.analysis import HPIOptimizationResult, OptimizedIntegrationPoint, PinchResult
from app.models.report import ReportRequest, ReportStream, ScenarioReportData
from app.services.report import generate_html_report, I18N
from app.services.report.figures import _optimization_figure


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
            _point(refrigerant="R1224yd", refrigerant_type="Synthetic", medium_sink="Water", COP=2.94),
            _point(T_sink=90.0, Q_demand=500.0, COP=3.8, refrigerant="Carnot", theoretical=True),
            _point(T_sink=80.0, Q_demand=400.0, COP=4.1, refrigerant="VHTHP", theoretical=True),
            _point(T_sink=85.0, Q_demand=300.0, COP=4.9, refrigerant="Stirling", theoretical=True),
            _point(T_sink=130.0, Q_demand=900.0, COP=2.1, refrigerant="Limited", source_limited=True),
            _point(T_sink=125.0, Q_demand=850.0, COP=2.2, refrigerant="Unused", demand_limited=True),
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
    assert "Integration with Heat Pump model and optimization" in html
    assert "Optimization - Feasible Heat Pump Solutions" in html


def test_german_report_has_every_label():
    assert set(I18N["de"]) == set(I18N["en"])
    html = generate_html_report(_request("de"))
    assert "Integration mit Wärmepumpenmodell und Optimierung" in html


def test_table_lists_the_pumps_the_page_lists():
    from app.services.report.points import _table_points

    rows = _table_points(_opt())
    names = [p.refrigerant for p in rows]
    # Best real machine per refrigerant type, plus Carnot and the best other
    # archetype. Stirling fits only at a low sink temperature, so it loses to
    # VHTHP on duty despite the higher COP.
    assert names == ["Butane_1", "R1224yd", "Carnot", "VHTHP"]
    assert all(not p.source_limited and not p.demand_limited for p in rows)


def test_chart_hides_the_off_profile_points():
    fig = _optimization_figure(_opt(), 73.0, I18N["en"])
    plotted = {round(y, 1) for trace in fig.data for y in (trace.y or ())}
    # Source- and demand-limited points miss one of the profiles; the page keeps
    # them off the chart unless asked, so the report does too.
    assert 130.0 not in plotted and 125.0 not in plotted


def test_report_lists_every_pump_row():
    html = generate_html_report(_request())
    # The page's table: a Real/Theoretical badge, the archetype name beside it, and
    # the derived P_el and shifted-temperature columns.
    assert html.count(">Real</span>") == 2
    assert html.count(">Theoretical</span>") == 2
    assert "Carnot (50 %)" in html
    for header in ("P_EL (KW)", "Shifted Sink (T+5K)", "Shifted Source (T-5K)", "HP STAGES"):
        assert header in html
    for name in ("Butane", "R1224yd", "Carnot", "VHTHP"):
        assert name in html


def test_a_picked_pump_takes_the_box_and_the_top_row():
    from app.services.report.points import _headline_point, _table_points

    opt = _opt()
    picked = _point(T_sink=100.0, Q_demand=600.0, COP=3.4)

    # Nothing clicked: the best real machine, which is what the page highlights.
    assert _headline_point(opt, []).T_sink == 118.0
    # Clicked: that one, even though it delivers less duty.
    assert _headline_point(opt, [picked]).T_sink == 100.0
    assert _table_points(opt, [picked])[0].T_sink == 100.0


def test_report_shows_the_picked_pump():
    picked = _point(T_sink=100.0, Q_demand=600.0, COP=3.4)
    req = _request()
    req.scenarios[0].selected_hp_points = [picked]
    html = generate_html_report(req)
    # The coverage column names the pump in the box, and the picked row is shaded.
    assert "#E2E8F0" in html
    assert "600.0" in html

    fig = _optimization_figure(_opt(), 73.0, I18N["en"], [picked])
    box = [a.text for a in fig.layout.annotations if a.text and "COP" in a.text]
    assert box and "COP 3.40" in box[0]


def test_a_report_made_by_an_ai_says_so():
    plain = generate_html_report(_request())
    assert I18N["en"]["ai_note"] not in plain and 'name="generator"' not in plain
    req = _request("de")
    req.created_by_ai = True
    html = generate_html_report(req)
    assert I18N["de"]["ai_note"] in html and "AI assistant via MCP" in html


def test_typed_text_is_shown_never_run():
    """Names and notes are typed by users or an AI: the report shows them as
    text, so a name cannot carry a script into the file."""
    req = _request()
    req.project_notes = "<script>alert(1)</script> & more"
    req.scenarios[0].name = "<img src=x onerror=alert(2)>"
    req.selected_streams = [ReportStream(name="<b>Hot</b>", Tin=90, Tout=40, CP=2, Q=100, type="HOT")]
    html = generate_html_report(req)
    assert "<script>alert(1)" not in html and "&lt;script&gt;alert(1)&lt;/script&gt; &amp; more" in html
    assert "<img src=x" not in html and "&lt;img src=x onerror=alert(2)&gt;" in html
