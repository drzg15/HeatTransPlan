"""
Report generation service — produces self-contained HTML report.
Includes detailed pages for every saved scenario and a comparison overview.
"""

# Thin re-export: the code lives in app.services.report.
from app.services.report.builder import generate_html_report
from app.services.report.figures import _optimization_figure
from app.services.report.hp_rules import _box_point, _hp_view
from app.services.report.texts import I18N

__all__ = ["generate_html_report", "I18N", "_optimization_figure", "_box_point", "_hp_view"]
