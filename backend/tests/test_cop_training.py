"""The COP training module: reading data, training, the exported model, and
the trained model inside the optimization. Also that it can be switched off."""

import io
import json

import numpy as np
import pandas as pd
import pytest

from app.services import cop_training
from app.services.cop_training.data import MAX_ROWS

rng = np.random.default_rng(1)


def synthetic(n=1500, four=True):
    """COP of a real machine: a share of Carnot that depends on refrigerant."""
    t_src = rng.uniform(20, 80, n)
    t_snk = t_src + rng.uniform(25, 70, n)
    ref = rng.choice(["R600", "R1233zd"], n)
    eta = np.where(ref == "R600", 0.55, 0.45)
    cop = eta * (t_snk + 273.15) / (t_snk - t_src) + rng.normal(0, 0.05, n)
    df = pd.DataFrame({"T Rücklauf Quelle": t_src, "T Vorlauf Senke": t_snk, "COP": cop, "Kältemittel": ref,
                       "Stufen": rng.choice(["1", "2"], n), "Medium": "Water"})
    if four:
        df["T Vorlauf Quelle"] = t_src + 5
        df["T Rücklauf Senke"] = t_snk - 10
    return df


def german_csv(df) -> bytes:
    return df.to_csv(sep=";", decimal=",", index=False).encode()


MAP4 = {"T_source_out": "T Rücklauf Quelle", "T_sink_out": "T Vorlauf Senke", "COP": "COP",
        "T_source_in": "T Vorlauf Quelle", "T_sink_in": "T Rücklauf Senke",
        "refrigerant": "Kältemittel", "stages": "Stufen", "medium": "Medium"}


def train(client, df, mapping, name="Test model", filename="data.csv"):
    content = german_csv(df) if filename.endswith(".csv") else _xlsx(df)
    return client.post("/api/analysis/cop-model/train",
                       files={"file": (filename, content)},
                       data={"mapping": json.dumps(mapping), "name": name})


def _xlsx(df) -> bytes:
    buf = io.BytesIO()
    df.to_excel(buf, index=False)
    return buf.getvalue()


def test_inspect_guesses_the_columns(client):
    r = client.post("/api/analysis/cop-model/inspect", files={"file": ("d.csv", german_csv(synthetic(50)))})
    assert r.status_code == 200
    out = r.json()
    assert out["rows"] == 50 and out["max_rows"] == MAX_ROWS
    assert out["guess"]["COP"] == "COP"
    assert out["guess"]["T_source_out"] == "T Rücklauf Quelle"
    assert out["guess"]["T_sink_in"] == "T Rücklauf Senke"
    assert "T Vorlauf Senke" in out["numeric_columns"]


def test_trains_a_good_model_from_a_german_csv(client):
    r = train(client, synthetic(), MAP4)
    assert r.status_code == 200, r.text
    out = r.json()
    m = out["spec"]["metrics"]
    assert m["r2"] > 0.95 and m["mae"] < 0.3
    assert out["spec"]["temps"] == ["T_source_in", "T_source_out", "T_sink_in", "T_sink_out"]
    assert len(out["spec"]["combos"]) == 4  # 2 refrigerants × 2 stage counts, one medium
    assert len(out["parity"]["actual"]) == len(out["parity"]["predicted"]) > 0


def test_two_temperatures_and_excel(client):
    r = train(client, synthetic(four=False), {"T_source_out": "T Rücklauf Quelle", "T_sink_out": "T Vorlauf Senke",
                                              "COP": "COP"}, filename="data.xlsx")
    assert r.status_code == 200, r.text
    assert r.json()["spec"]["temps"] == ["T_source_out", "T_sink_out"]
    assert r.json()["spec"]["combos"] == [{}]


def test_large_files_are_sampled_and_bad_input_is_explained(client):
    big = synthetic(MAX_ROWS + 500, four=False)
    two = {"T_source_out": "T Rücklauf Quelle", "T_sink_out": "T Vorlauf Senke", "COP": "COP"}
    out = train(client, big, two).json()
    assert out["rows_used"] == MAX_ROWS and out["sampled_from"] == MAX_ROWS + 500
    assert train(client, synthetic(10), two).status_code == 400  # too few rows
    assert train(client, synthetic(100), {**two, "COP": "nope"}).status_code == 400
    assert train(client, synthetic(100), {**two, "T_source_in": "T Vorlauf Quelle"}).status_code == 422
    bad = client.post("/api/analysis/cop-model/train", files={"file": ("d.pdf", b"x")},
                      data={"mapping": json.dumps(two)})
    assert bad.status_code == 400


def _pinch(client):
    from app.config import EXAMPLES_DIR
    state = json.loads((EXAMPLES_DIR / "heat_integration_example_1.json").read_text(encoding="utf-8"))
    return client.post("/api/analysis/project", json={"state": state}).json()["pinch"]


def test_the_trained_model_joins_the_optimization(client, monkeypatch):
    spec = train(client, synthetic(), MAP4).json()["spec"]
    pinch = _pinch(client)

    def custom_points(model):
        r = client.post("/api/analysis/hpi-optimization", json={"pinch_result": pinch, "custom_cop_model": model})
        assert r.status_code == 200, r.text
        return [p for p in r.json()["feasible_points"] if p["refrigerant_type"] == "Custom model"]

    pts = custom_points(spec)
    assert pts and {p["refrigerant"].split(": ")[0] for p in pts} == {"Test model"}
    assert all(p["T_vorlauf_quelle"] is not None for p in pts)  # four temperatures: pinch-filled
    assert "Your trained model" in pts[0]["calculation_details"]
    assert custom_points({**spec, "enabled": False}) == []
    monkeypatch.setattr(cop_training, "ENABLED", False)
    assert custom_points(spec) == []


def test_a_malformed_model_is_rejected(client):
    spec = train(client, synthetic(200, four=False), {"T_source_out": "T Rücklauf Quelle",
                                                      "T_sink_out": "T Vorlauf Senke", "COP": "COP"}).json()["spec"]
    spec["layers"][0]["W"] = spec["layers"][0]["W"][:1]
    r = client.post("/api/analysis/hpi-optimization", json={"pinch_result": _pinch(client), "custom_cop_model": spec})
    assert r.status_code == 422


def test_features_says_whether_the_module_runs(client):
    assert client.get("/api/features").json()["cop_training"] is True


def test_switched_off_the_endpoints_are_gone():
    import subprocess
    import sys
    code = (
        "import os; os.environ['COP_TRAINING_ENABLED']='0'\n"
        "from fastapi.testclient import TestClient\nfrom app.main import app\n"
        "c = TestClient(app)\n"
        "print(c.get('/api/features').json()['cop_training'], "
        "c.post('/api/analysis/cop-model/inspect').status_code)"
    )
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, check=True).stdout.split()
    assert out[0] == "False" and out[1] in ("404", "405")


def test_regressions_give_their_formula(client):
    # Exactly linear data: a linear regression has to find the coefficients.
    n = 400
    t_src = rng.uniform(20, 80, n)
    t_snk = t_src + rng.uniform(25, 70, n)
    ref = rng.choice(["A", "B"], n)
    cop = 2 + 0.05 * t_src - 0.02 * t_snk + np.where(ref == "B", 0.3, 0.0)
    df = pd.DataFrame({"Tq": t_src, "Ts": t_snk, "COP": cop, "Ref": ref})
    mapping = {"T_source_out": "Tq", "T_sink_out": "Ts", "COP": "COP", "refrigerant": "Ref"}
    r = client.post("/api/analysis/cop-model/train", files={"file": ("d.csv", german_csv(df))},
                    data={"mapping": json.dumps(mapping), "model_type": "linear"})
    assert r.status_code == 200, r.text
    spec = r.json()["spec"]
    assert spec["kind"] == "linear" and spec["metrics"]["r2"] > 0.999999
    coefs = {tuple(sorted(t["powers"].items())): t["coef"] for t in spec["terms"]}
    assert coefs[()] == pytest.approx(2, abs=1e-6)
    assert coefs[(("T_source_out", 1),)] == pytest.approx(0.05, abs=1e-8)
    assert coefs[(("T_sink_out", 1),)] == pytest.approx(-0.02, abs=1e-8)
    assert spec["offsets"]["refrigerant"]["B"] == pytest.approx(0.3, abs=1e-8)
    assert spec["formula"].startswith("COP = 2") and "T_src,out" in spec["formula"]

    for degree in (2, 3):
        out = train_kind(client, synthetic(800), MAP4, "poly", degree).json()["spec"]
        assert out["kind"] == "poly" and out["metrics"]["degree"] == degree
        assert "²" in out["formula"] and out["metrics"]["r2"] > 0.9
    bad = train_kind(client, synthetic(100), MAP4, "poly", 5)
    assert bad.status_code == 400


def train_kind(client, df, mapping, kind, degree=2):
    return client.post("/api/analysis/cop-model/train", files={"file": ("d.csv", german_csv(df))},
                       data={"mapping": json.dumps(mapping), "model_type": kind, "degree": str(degree)})


def test_a_regression_joins_the_optimization(client):
    spec = train_kind(client, synthetic(), MAP4, "poly", 2).json()["spec"]
    r = client.post("/api/analysis/hpi-optimization", json={"pinch_result": _pinch(client), "custom_cop_model": spec})
    pts = [p for p in r.json()["feasible_points"] if p["refrigerant_type"] == "Custom model"]
    assert pts and "polynomial regression (degree 2)" in pts[0]["calculation_details"]
    assert "COP = " in pts[0]["calculation_details"]


def test_parquet_and_excel_sheets(client):
    df = synthetic(300, four=False)
    two = {"T_source_out": "T Rücklauf Quelle", "T_sink_out": "T Vorlauf Senke", "COP": "COP"}
    buf = io.BytesIO()
    df.to_parquet(buf)
    r = client.post("/api/analysis/cop-model/train", files={"file": ("d.parquet", buf.getvalue())},
                    data={"mapping": json.dumps(two)})
    assert r.status_code == 200, r.text and r.json()["rows_used"] == 300

    # A parameter study: inputs on the first sheet, results (with a units
    # row) on the second. The results sheet is found and the units row dropped.
    xbuf = io.BytesIO()
    with pd.ExcelWriter(xbuf) as w:
        pd.DataFrame({"Kältemittel": ["Butane"], "T_min": [30], "T_max": [90]}).to_excel(w, sheet_name="Input_Data", index=False)
        units = pd.DataFrame([{c: ("°C" if c.startswith("T ") else None) for c in df.columns}])
        pd.concat([units, df]).to_excel(w, sheet_name="Results", index=False)
    content = xbuf.getvalue()
    info = client.post("/api/analysis/cop-model/inspect", files={"file": ("study.xlsx", content)}).json()
    assert info["sheets"] == ["Input_Data", "Results"] and info["sheet"] == "Results"
    assert info["guess"]["COP"] == "COP" and "T Vorlauf Senke" in info["numeric_columns"]
    first = client.post("/api/analysis/cop-model/inspect", files={"file": ("study.xlsx", content)},
                        data={"sheet": "Input_Data"}).json()
    assert first["sheet"] == "Input_Data" and first["columns"] == ["Kältemittel", "T_min", "T_max"]
    out = client.post("/api/analysis/cop-model/train", files={"file": ("study.xlsx", content)},
                      data={"mapping": json.dumps(two), "sheet": "Results"}).json()
    assert out["rows_used"] == 300 and out["rows_dropped"] == 1


def test_the_range_defaults_to_the_data_with_the_sink_capped(client):
    df = synthetic(400, four=False)
    df.loc[:9, "T Vorlauf Senke"] = 210  # a few points beyond any real heat pump
    two = {"T_source_out": "T Rücklauf Quelle", "T_sink_out": "T Vorlauf Senke", "COP": "COP"}
    spec = train(client, df, two).json()["spec"]
    assert spec["data_envelope"]["T_sink_max"] == 210
    assert spec["envelope"]["T_sink_max"] == 180
    # A range set by the user is used as given; an inverted one is refused.
    pinch = _pinch(client)
    own = {**spec, "envelope": {**spec["envelope"], "T_sink_min": 100, "T_sink_max": 120}}
    pts = client.post("/api/analysis/hpi-optimization", json={"pinch_result": pinch, "custom_cop_model": own}).json()
    custom = [p for p in pts["feasible_points"] if p["refrigerant_type"] == "Custom model"]
    assert custom and all(100 <= p["T_sink"] <= 120 for p in custom)
    bad = {**spec, "envelope": {**spec["envelope"], "T_sink_min": 150, "T_sink_max": 120}}
    assert client.post("/api/analysis/hpi-optimization",
                       json={"pinch_result": pinch, "custom_cop_model": bad}).status_code == 422
