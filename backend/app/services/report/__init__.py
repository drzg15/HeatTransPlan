"""
Report generation service — produces self-contained HTML report.
Includes detailed pages for every saved scenario and a comparison overview.
"""

from app.services.report.document import generate_html_report
from app.services.report.texts import I18N

__all__ = ["generate_html_report", "I18N"]
