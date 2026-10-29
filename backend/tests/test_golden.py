"""Golden snapshot of every API endpoint, taken before the refactoring.

Each case calls the API with the example projects and compares the answer
with the one stored in tests/golden/. A refactoring that changes any number,
text or field shows up here. Run with GOLDEN_UPDATE=1 to rewrite the files,
only when a change of output is intended.
"""

import gzip
import hashlib
import json
import os
import re
from pathlib import Path

import pytest

from app.config import EXAMPLES_DIR
from app.services import project_service

GOLDEN_DIR = Path(__file__).parent / "golden"
UPDATE = os.getenv("GOLDEN_UPDATE") == "1"
EXAMPLES = sorted(p.name for p in EXAMPLES_DIR.glob("*.json"))

_UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
_SET = re.compile(r"\{('[^{}]*')\}")
_BLOB = re.compile(r"[A-Za-z0-9+/=]{400,}")
_STAMP = re.compile(r"\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?|\d{8}_\d{6}")


def _normalize(text: str) -> str:
    # Ids and clock times differ on every run; nothing else may. Embedded
    # images are kept as a fingerprint so the files stay small.
    text = _BLOB.sub(lambda m: "<blob " + hashlib.sha256(m.group().encode()).hexdigest()[:16] + ">", text)
    # The CSV import names the missing columns as a Python set: random order.
    text = _SET.sub(lambda m: "{" + ", ".join(sorted(m.group(1).split(", "))) + "}", text)
    return _STAMP.sub("<time>", _UUID.sub("<uuid>", text))


def _check(name: str, payload) -> None:
    text = payload if isinstance(payload, str) else json.dumps(payload, indent=1, sort_keys=True, ensure_ascii=False)
    text = _normalize(text)
    path = GOLDEN_DIR / f"{name}.golden.gz"
    if UPDATE or not path.exists():
        GOLDEN_DIR.mkdir(exist_ok=True)
        path.write_bytes(gzip.compress(text.encode("utf-8"), mtime=0))
        return
    expected = gzip.decompress(path.read_bytes()).decode("utf-8")
    assert text == expected, f"{name} differs from its golden file"


def _example(filename: str) -> dict:
    return json.loads((EXAMPLES_DIR / filename).read_text(encoding="utf-8"))


def _pinch_streams(state: dict) -> list:
    out = []
    for proc in state["processes"]:
        for s in proc.get("streams", []):
            v = s["values"]
            out.append({
                "name": s["name"],
                "CP": float(v["val3"]) * float(v["val4"]),
                "T_supply": float(v["val1"]),
                "T_target": float(v["val2"]),
            })
    return out


def _post(client, url: str, body: dict):
    r = client.post(url, json=body)
    return {"status": r.status_code, "body": r.json() if "json" in r.headers.get("content-type", "") else r.text}


@pytest.fixture(autouse=True)
def _isolated_state(tmp_path, monkeypatch):
    monkeypatch.setattr(project_service, "STATE_DIR", tmp_path)


@pytest.mark.parametrize("example", EXAMPLES)
def test_analysis_chain(client, example):
    state = _example(example)
    streams = _pinch_streams(state)
    stem = Path(example).stem

    for t_min in (5.0, 10.0, 20.0):
        _check(f"{stem}_pinch_{t_min:g}", _post(client, "/api/analysis/pinch", {"streams": streams, "T_min": t_min}))

    pinch = client.post("/api/analysis/pinch", json={"streams": streams, "T_min": 10.0}).json()

    for mode in ("net_load", "composite"):
        _check(f"{stem}_hpi_{mode}", _post(client, "/api/analysis/hpi", {"pinch_result": pinch, "profile_mode": mode}))

    optimizations = {}
    for mode in ("net_load", "composite"):
        for model in ("2t", "4t"):
            for pct in (100.0, 50.0, 0.0):
                body = {"pinch_result": pinch, "profile_mode": mode, "cop_model": model, "recovery_pct": pct}
                res = _post(client, "/api/analysis/hpi-optimization", body)
                optimizations[(mode, model, pct)] = res["body"]
                _check(f"{stem}_opt_{mode}_{model}_{pct:g}", res)

    _check(f"{stem}_opt_de", _post(client, "/api/analysis/hpi-optimization", {"pinch_result": pinch, "lang": "de", "recovery_pct": 30.0}))
    formula = {"name": "Test", "expression": "0.5 * T_sink / (T_sink - T_source)", "T_source_min": 0, "T_source_max": 200, "T_sink_min": 0, "T_sink_max": 250}
    _check(f"{stem}_opt_formula", _post(client, "/api/analysis/hpi-optimization", {"pinch_result": pinch, "cop_formula": formula}))

    for ref in ("gas", "oil", "eboiler"):
        _check(f"{stem}_economics_{ref}", _post(client, "/api/analysis/economics", {
            "ref_type": ref, "optimization": optimizations[("net_load", "2t", 100.0)],
            "selected_points": optimizations[("net_load", "2t", 100.0)]["feasible_points"][3:5] if ref == "oil" else [],
        }))

    demands = [{"stream_name": s["name"], "heating_kW": 100.0 * i, "cooling_kW": 50.0 * i} for i, s in enumerate(streams)]
    _check(f"{stem}_status_quo", _post(client, "/api/analysis/status-quo", {
        "current_demands": demands, "pinch_hot_utility": pinch["hot_utility"], "pinch_cold_utility": pinch["cold_utility"],
    }))

    hpi = client.post("/api/analysis/hpi", json={"pinch_result": pinch}).json()
    opt = optimizations[("net_load", "2t", 100.0)]
    report_streams = [{"name": s["name"], "Tin": s["T_supply"], "Tout": s["T_target"], "CP": s["CP"],
                       "Q": abs(s["CP"] * (s["T_supply"] - s["T_target"])),
                       "type": "hot" if s["T_supply"] > s["T_target"] else "cold"} for s in streams]
    processes = [{"name": p["name"], "streams": p.get("streams", [])} for p in state["processes"]]
    selected = opt["feasible_points"][:2]
    report = {
        "project_notes": "Notes", "pinch_notes": "Pinch notes",
        "map_center": state["map_center"], "map_zoom": state["map_zoom"],
        "processes": processes, "proc_groups": state["proc_groups"],
        "proc_group_names": state["proc_group_names"], "proc_group_coordinates": state["proc_group_coordinates"],
        "selected_streams": report_streams, "pinch_result": pinch, "heat_pumps": hpi["heat_pumps"],
        "hpi_optimization_result": opt,
        "energy_demands": [{"heat_demand": 300.0, "cooling_demand": 200.0}],
        "scenarios": [
            {"name": "A", "selected_streams": report_streams, "pinch_result": pinch, "heat_pumps": hpi["heat_pumps"],
             "hpi_optimization_result": opt, "selected_hp_points": selected,
             "energy_demands": [{"heat_demand": 300.0, "cooling_demand": 200.0}]},
            {"name": "B", "selected_streams": report_streams[:3], "pinch_result": pinch, "t_min": 10.0},
        ],
    }
    for lang in ("en", "de"):
        r = client.post("/api/analysis/report", json={**report, "language": lang})
        _check(f"{stem}_report_{lang}", f"{r.status_code}\n{r.text}")
    _check(f"{stem}_map_preview", _post(client, "/api/analysis/map-preview", report))


def test_cop_formula_validate(client):
    cases = ["0.5 * T_sink / (T_sink - T_source)", "T_sink +", "__import__('os')", "1 / (T_sink - T_sink)", "log(T_sink) * 2"]
    _check("cop_validate", [_post(client, "/api/analysis/cop-formula/validate", {"expression": c}) for c in cases])


def test_assets(client):
    _check("assets_models", client.get("/api/assets/models").json())
    _check("assets_examples", client.get("/api/assets/examples").json())
    _check("assets_example_1", client.get(f"/api/assets/examples/{EXAMPLES[0]}").json())
    _check("assets_example_bad", client.get("/api/assets/examples/..%2Fsecret.json").status_code)


def test_default_pump_is_a_real_machine_on_the_profiles(client):
    """The pump the chart boxes and economics prices by default: never an
    archetype or an off-profile point when a real one sits on both curves."""
    pinch = client.post("/api/analysis/pinch", json={"streams": _pinch_streams(_example(EXAMPLES[0])), "T_min": 10.0}).json()
    for mode, model, pct in (("net_load", "2t", 100.0), ("net_load", "4t", 50.0), ("composite", "2t", 100.0)):
        opt = client.post("/api/analysis/hpi-optimization", json={
            "pinch_result": pinch, "profile_mode": mode, "cop_model": model, "recovery_pct": pct}).json()
        best = opt["max_q_point"]
        assert not best["theoretical"] and not best["source_limited"] and not best["demand_limited"]
        on = [p for p in opt["feasible_points"]
              if not p["theoretical"] and not p["source_limited"] and not p["demand_limited"]]
        assert best["Q_demand"] == max(p["Q_demand"] for p in on)


@pytest.mark.parametrize("example", EXAMPLES)
def test_project_editing(client, example):
    """Walk every editing endpoint the page uses, as a user would."""
    stem = Path(example).stem
    log = []

    def rec(label, r):
        log.append({"step": label, "status": r.status_code,
                    "body": r.json() if "json" in r.headers.get("content-type", "") else r.text})

    r = client.post("/api/projects", json=_example(example))
    rec("create", r)
    pid = r.json()["project_id"] if "project_id" in r.json() else r.json()["id"]
    rec("get", client.get(f"/api/projects/{pid}"))
    rec("add_group", client.post(f"/api/projects/{pid}/groups", json={"name": "New group"}))
    rec("rename_group", client.put(f"/api/projects/{pid}/groups/0", json={"name": "Renamed"}))
    rec("add_proc", client.post(f"/api/projects/{pid}/groups/0/procs"))
    rec("add_proc_named", client.post(f"/api/projects/{pid}/groups/1/procs", json={"name": "Dryer", "level": 1}))
    rec("update_proc", client.put(f"/api/procs/{pid}/0", json={"name": "Changed", "level": 1, "lat": "51.7", "lon": "8.7"}))
    rec("add_child", client.post(f"/api/procs/{pid}/0/children"))
    rec("add_stream", client.post(f"/api/procs/{pid}/0/streams"))
    rec("add_stream_data", client.post(f"/api/procs/{pid}/1/streams", json={
        "name": "Hot water", "type": "water", "values": {"val1": "90", "val2": "40", "val3": "2", "val4": "4.18"}}))
    rec("update_stream", client.put(f"/api/streams/{pid}/1/0", json={"name": "Edited", "values": {"val1": "80", "val2": "30"}}))
    rec("add_child_stream", client.post(f"/api/procs/{pid}/0/children/0/streams"))
    rec("delete_stream", client.delete(f"/api/streams/{pid}/1/0"))
    rec("delete_child", client.delete(f"/api/procs/{pid}/0/children/0"))
    rec("export_json", client.get(f"/api/io/export-json/{pid}"))
    csv = client.get(f"/api/io/export-csv/{pid}")
    rec("export_csv", csv)
    rec("import_csv", client.post(f"/api/io/import-csv/{pid}", files={"file": ("data.csv", csv.content, "text/csv")}))
    rec("delete_proc", client.delete(f"/api/procs/{pid}/1"))
    rec("delete_group", client.delete(f"/api/projects/{pid}/groups/1"))
    rec("after_edits", client.get(f"/api/projects/{pid}"))
    rec("import_json_body", client.post("/api/io/import-json-body", json=_example(example)))
    rec("import_json_file", client.post("/api/io/import-json", files={"file": ("p.json", json.dumps(_example(example)), "application/json")}))
    rec("put_project", client.put(f"/api/projects/{pid}", json=_example(example)))
    rec("delete_project", client.delete(f"/api/projects/{pid}"))
    rec("get_deleted", client.get(f"/api/projects/{pid}"))
    rec("missing_proc", client.delete(f"/api/procs/{pid}/99"))
    _check(f"{stem}_project_editing", log)
