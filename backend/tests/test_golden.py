"""Golden tests: the numbers the app produces, pinned.

A wrong pinch temperature looks exactly like a right one, so the analysis chain
is run end to end — through the same HTTP routes the browser calls — and its
results compared with values recorded in tests/golden/.

Two kinds of reference:

* The textbook problem below has its answer worked out by hand, independently
  of this code. It anchors correctness: if it fails, the code is wrong.
* The bundled examples are pinned to what the code produced when the golden
  files were recorded. They anchor *stability*: if one fails, a change moved a
  number, and the diff says which. If the move is intended, re-record with

      UPDATE_GOLDEN=1 pytest tests/test_golden.py

  and review the change to tests/golden/ like any other.
"""

import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app

GOLDEN = Path(__file__).parent / "golden"
EXAMPLES = Path(__file__).parent.parent / "app" / "data" / "examples"
UPDATE = os.environ.get("UPDATE_GOLDEN") == "1"

# The heat pump types the page asks for (PotentialAnalysisPage DEFAULT_HP_TYPES).
HP_TYPES = [
    "Prototypical Stirling",
    "VHTHP (HFC/HFO)",
    "SHP and HTHPs (HFC/HFO)",
    "SHP and HTHPs (R717)",
    "Carnot",
]

client = TestClient(app)


# --- The textbook problem ---------------------------------------------------

TEXTBOOK = [
    {"name": "1 cold", "CP": 2.0, "T_supply": 20, "T_target": 135},
    {"name": "2 hot", "CP": 3.0, "T_supply": 170, "T_target": 60},
    {"name": "3 cold", "CP": 4.0, "T_supply": 80, "T_target": 140},
    {"name": "4 hot", "CP": 1.5, "T_supply": 150, "T_target": 30},
]


def test_textbook_four_stream_problem():
    """The classic two-hot, two-cold problem, ΔTmin = 10 K.

    Worked by hand (temperatures shifted by ±5 K):

        interval   ΣCP hot − ΣCP cold   ΔH      cascade from 0
        165–145    3.0                  +60       60
        145–140    4.5 − 4.0 = 0.5      +2.5      62.5
        140–85     4.5 − 6.0 = −1.5     −82.5    −20   ← most negative
        85–55      4.5 − 2.0 = 2.5      +75       55
        55–25      1.5 − 2.0 = −0.5     −15       40

    Hot utility 20 kW; the pinch sits where the corrected cascade hits zero,
    at 85 °C shifted (90 °C hot / 80 °C cold); cold utility 40 + 20 = 60 kW.
    Check: hot streams give 510 kW, cold take 470 kW, and 60 − 20 = 40.
    """
    r = client.post("/api/analysis/pinch", json={"streams": TEXTBOOK, "T_min": 10})
    assert r.status_code == 200
    p = r.json()

    assert p["hot_utility"] == pytest.approx(20.0)
    assert p["cold_utility"] == pytest.approx(60.0)
    assert p["pinch_temperature"] == pytest.approx(85.0)
    assert p["temperatures"] == pytest.approx([165, 145, 140, 85, 55, 25])
    assert [i["deltaH"] for i in p["heat_cascade"]] == pytest.approx([60, 2.5, -82.5, 75, -15])
    # The grand composite curve is the corrected cascade at each boundary.
    assert p["grand_composite_curve"]["H"] == pytest.approx([20, 80, 82.5, 0, 75, 60])


# --- The full chain, pinned ---------------------------------------------------

def _example_streams(n):
    """What the browser sends for every stream of a bundled example.

    The examples carry no units, so the page's reading of a stream reduces to
    CP = ṁ · cp with the temperatures as given (utils/streamUtils.ts).
    """
    data = json.loads((EXAMPLES / f"heat_integration_example_{n}.json").read_text())
    streams = []
    for proc in data["processes"]:
        for s in proc["streams"]:
            assert not s.get("stream_units"), "units would need the page's conversions"
            v = {name: float(s["values"][key.replace("prop", "val")])
                 for key, name in s["properties"].items()}
            streams.append({
                "name": f"{proc['name']} - {s['name']}",
                "CP": v["ṁ"] * v["cp"],
                "T_supply": v["Tin"],
                "T_target": v["Tout"],
            })
    return streams, data.get("t_min") or 10


def _summarise(streams, t_min, mode):
    """Run the chain the page runs and keep what a user would read off it."""
    pinch = client.post("/api/analysis/pinch", json={"streams": streams, "T_min": t_min})
    assert pinch.status_code == 200, pinch.text
    p = pinch.json()

    hpi = client.post("/api/analysis/hpi",
                      json={"pinch_result": p, "hp_types": HP_TYPES, "profile_mode": mode})
    assert hpi.status_code == 200, hpi.text
    opt = client.post("/api/analysis/hpi-optimization",
                      json={"pinch_result": p, "profile_mode": mode})
    assert opt.status_code == 200, opt.text
    o = opt.json()

    per_refrigerant = {}
    for pt in o["feasible_points"]:
        best = per_refrigerant.setdefault(pt["refrigerant"], {"points": 0, "best_cop": 0.0})
        best["points"] += 1
        best["best_cop"] = max(best["best_cop"], pt["COP"])

    keep = ("refrigerant", "medium_sink", "hp_level", "T_source", "T_sink", "Q_demand", "COP")
    return {
        "pinch": {k: p[k] for k in ("pinch_temperature", "hot_utility", "cold_utility",
                                     "temperatures", "grand_composite_curve")},
        "heat_pumps": [
            {k: hp[k] for k in ("name", "available", "cop", "t_source", "t_sink", "q_source", "q_sink")}
            for hp in hpi.json()["heat_pumps"]
        ],
        "optimization": {
            "feasible_points": len(o["feasible_points"]),
            "max_q_point": {k: o["max_q_point"][k] for k in keep} if o["max_q_point"] else None,
            "per_refrigerant": dict(sorted(per_refrigerant.items())),
        },
    }


def _approx(expected, rel):
    """pytest.approx through nested dicts and lists; strings compared exactly."""
    if isinstance(expected, dict):
        return {k: _approx(v, rel) for k, v in expected.items()}
    if isinstance(expected, list):
        return [_approx(v, rel) for v in expected]
    if isinstance(expected, float):
        return pytest.approx(expected, rel=rel, abs=1e-6)
    return expected


# All four bundled examples carry the same six streams — they differ only in
# names and settings the analysis does not read — so one of them covers all
# four. The textbook problem adds a second, differently shaped case.
CASES = {
    "example_1": lambda: _example_streams(1),
    "textbook": lambda: (TEXTBOOK, 10),
}


@pytest.mark.parametrize("mode", ["net_load", "composite"])
@pytest.mark.parametrize("case", sorted(CASES))
def test_chain_matches_golden(case, mode):
    streams, t_min = CASES[case]()
    actual = _summarise(streams, t_min, mode)
    path = GOLDEN / f"{case}_{mode}.json"

    if UPDATE:
        GOLDEN.mkdir(exist_ok=True)
        path.write_text(json.dumps(actual, indent=2, ensure_ascii=False) + "\n")
        pytest.skip(f"recorded {path.name}")

    expected = json.loads(path.read_text())
    # Pinch and the single-point integration are plain arithmetic. The
    # optimization goes through the trained COP model, whose last digits can
    # differ between platforms and library versions.
    assert actual["pinch"] == _approx(expected["pinch"], rel=1e-9)
    assert actual["heat_pumps"] == _approx(expected["heat_pumps"], rel=1e-9)
    assert actual["optimization"] == _approx(expected["optimization"], rel=1e-6)


def test_analysis_leaves_no_charts_behind():
    """The legacy modules can draw matplotlib figures, which nobody sees on a
    server and pyplot keeps until they are closed. Two switches had drawing on
    for every request — about 6–13 figures per page refresh, held for the life
    of the process. Nothing in the request path may draw."""
    import matplotlib.pyplot as plt

    before = set(plt.get_fignums())
    for streams, t_min in (CASES["example_1"](), CASES["textbook"]()):
        p = client.post("/api/analysis/pinch", json={"streams": streams, "T_min": t_min}).json()
        for mode in ("net_load", "composite"):
            client.post("/api/analysis/hpi",
                        json={"pinch_result": p, "hp_types": HP_TYPES, "profile_mode": mode})
            client.post("/api/analysis/hpi-optimization",
                        json={"pinch_result": p, "profile_mode": mode})
    assert set(plt.get_fignums()) == before



def test_a_pocket_that_cancels_exactly_is_removed():
    """Below the pinch, a 30 kW surplus followed by a 30 kW deficit: the case
    where pocket deletion merges two intervals that cancel exactly. It used to
    overwrite the whole cascade with a number and crash, so the optimization
    in the default mode answered 500 — an empty heat pump view on the page.

    Worked by hand (shifted temperatures): the cascade from the pinch down is
    0 → 20 → 50 → 20 → 30 kW at 100, 90, 80, 70, 60 °C. The +30/−30 pair
    between 90 and 70 °C cancels, so the pocket-free source profile is
    (100, 0) → (90, 20) → (70, 20) → (60, 30).
    """
    streams = [
        {"name": "H1", "CP": 2.0, "T_supply": 105, "T_target": 65},
        {"name": "H2", "CP": 1.0, "T_supply": 95, "T_target": 85},
        {"name": "C1", "CP": 5.0, "T_supply": 65, "T_target": 75},
        {"name": "C2", "CP": 1.0, "T_supply": 55, "T_target": 65},
        {"name": "C3", "CP": 3.0, "T_supply": 95, "T_target": 115},
    ]
    p = client.post("/api/analysis/pinch", json={"streams": streams, "T_min": 10}).json()
    assert p["pinch_temperature"] == pytest.approx(100)
    assert p["grand_composite_curve"]["H"] == pytest.approx([60, 0, 20, 50, 20, 30])

    r = client.post("/api/analysis/hpi-optimization", json={"pinch_result": p, "profile_mode": "net_load"})
    assert r.status_code == 200, r.text
    source = r.json()["pocketless_source"]
    assert source["T"] == pytest.approx([60, 70, 90, 100])
    assert source["H"] == pytest.approx([30, 20, 20, 0])
    assert r.json()["feasible_points"]
