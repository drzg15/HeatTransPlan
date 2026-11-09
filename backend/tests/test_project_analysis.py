"""The backend reads stream values exactly as the page does, and runs the
page's chain on a project."""

import json
import math
from pathlib import Path

import pytest

from app.config import EXAMPLES_DIR
from app.services.project_analysis import stream_info

REF = json.loads((Path(__file__).parent / "fixtures" / "stream_info_reference.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", REF, ids=lambda c: c["stream"].get("name", "?"))
def test_stream_info_matches_the_page(case):
    got = stream_info(case["stream"])
    for k, want in case["info"].items():
        if isinstance(want, float) or isinstance(got[k], float):
            assert want is not None and got[k] is not None and math.isclose(got[k], want, rel_tol=1e-12), (k, got[k], want)
        else:
            assert got[k] == want, (k, got[k], want)


def test_project_chain(client):
    state = json.loads((EXAMPLES_DIR / "heat_integration_example_1.json").read_text(encoding="utf-8"))
    r = client.post("/api/analysis/project", json={"state": state, "economics_form": {"pFuel": 7}})
    assert r.status_code == 200
    out = r.json()
    assert len(out["streams"]) == 6
    # The same pinch the page gets for these streams.
    page = client.post("/api/analysis/pinch", json={
        "streams": [{"name": s["name"], "CP": s["CP"], "T_supply": s["Tin"], "T_target": s["Tout"]} for s in out["streams"]],
        "T_min": out["t_min"],
    }).json()
    assert out["pinch"] == page
    assert out["optimization"]["feasible_points"]
    assert out["economics"]["results"][0]["npv"] is not None
    one = client.post("/api/analysis/project", json={"state": state, "selected_streams": {"stream_0_0": True}}).json()
    assert "message" in one and "pinch" not in one
