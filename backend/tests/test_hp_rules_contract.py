"""The report shows the same heat pumps as the analysis page.

contracts/hp_rules.json holds hand-written points that hit every display rule,
and the outputs the page's own rules (frontend/.../hpRules.ts) give for them.
The frontend tests check hpRules.ts against it; this checks the report's port.
If one side changes a rule without the other, one of the two fails.
"""

import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.models.analysis import OptimizedIntegrationPoint
from app.models.report import HPFilters
from app.services.report_service import _box_point, _hp_view

CONTRACT = json.loads((Path(__file__).parents[2] / "contracts" / "hp_rules.json").read_text())


def _key(p):
    # Same key as the frontend test: numbers formatted the way JavaScript prints them.
    return p and f"{p.refrigerant}@{p.T_sink:g}@{p.T_source:g}"


def _apply(points, max_q, selected, filters=None):
    view = _hp_view(SimpleNamespace(feasible_points=points, max_q_point=max_q), selected, filters)
    keys = lambda ps: sorted(_key(p) for p in ps)
    return {
        "chart_points": keys(view.chart_points),
        "default_highlight": _key(view.highlight),
        "table_rows": keys(view.table),
        "table_order": [_key(p) for p in view.table],
        "cloud_real": keys(view.cloud_real),
        "cloud_theoretical": keys(view.cloud_theoretical),
        "active_points": [_key(p) for p in view.active],
        "box_point": _key(_box_point(view.active)),
    }


def _points(raw):
    return [OptimizedIntegrationPoint(**p) for p in raw]


CASES = {
    name: (_points(CONTRACT["points"]), OptimizedIntegrationPoint(**c["max_q_point"]), _points(c["selected"]),
           HPFilters(**c["filters"]) if "filters" in c else None)
    for name, c in CONTRACT["cases"].items()
}
CASES["only_off_profile"] = (_points(CONTRACT["only_off_profile"]), None, [], None)


@pytest.mark.parametrize("name", sorted(CASES))
def test_report_rules_match_the_page(name):
    assert _apply(*CASES[name]) == CONTRACT["expected"][name]
