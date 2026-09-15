import sys
from app.models.report import ReportRequest, ScenarioReportData, ReportEnergyDemand, HeatPumpEntry, PinchResult
from app.services.report_service import generate_html_report

try:
    req = ReportRequest(
        scenarios=[
            ScenarioReportData(
                name="Test",
                energy_demands=[ReportEnergyDemand(heat_demand=100.0, cooling_demand=50.0)],
                heat_pumps=[HeatPumpEntry(name="HP1", available=True, cop=3.5, q_sink=40.0, q_source=30.0)],
                pinch_result=PinchResult(hot_utility=80.0, cold_utility=40.0, pinch_temperature=50.0, composite_diagram={"hot": {}, "cold": {}}, grand_composite_curve={}, heat_cascade=[]),
            )
        ]
    )
    print("Generating report...")
    out = generate_html_report(req)
    print("Success, length:", len(out))
except Exception as e:
    import traceback
    traceback.print_exc()
    sys.exit(1)
