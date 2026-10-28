"""The MCP server's tools against the real backend (in-process), with a stand-in
page answering live commands the way the browser does."""

import asyncio
import json

import httpx
import pytest

from app.main import app
from app.services import live, project_service

mcp_server = pytest.importorskip("heattransplan_mcp.server")
from heattransplan_mcp.api import Api, ApiError  # noqa: E402

S = mcp_server


@pytest.fixture(autouse=True)
def _isolated(tmp_path, monkeypatch):
    monkeypatch.setattr(project_service, "STATE_DIR", tmp_path)
    monkeypatch.setattr(live, "_sessions", {})


def run(coro_fn):
    """Run a test body with the tools pointed at the in-process backend."""
    async def main():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            S.set_api(Api(base_url="http://test", api_key="", client=client))
            return await coro_fn()
    return asyncio.run(main())


def test_building_and_analysing_a_project(tmp_path):
    async def body():
        p = await S.create_project()
        pid = p["project_id"]
        assert p["project"]["processes"] == []

        r = await S.add_process(pid, name="Dryer", lat=51.7, lon=8.7)
        assert r["result"] == {"process": 0}
        proc = r["project"]["processes"][0]
        assert proc["name"] == "Dryer" and proc["subprocesses"][0]["name"] == "Subprocess 1"

        await S.add_stream(pid, 0, "Exhaust air", t_in=70, t_out=30, mass_flow=10, cp=1.0, stream_type="air")
        await S.add_stream(pid, 0, "Fresh air", t_in=80, t_out=140, CP=5)
        await S.add_stream(pid, 0, "Hot water", t_in=95, t_out=60, mass_flow=3600, cp=4.18, units={"ṁ": "kg/h"})
        sub = await S.add_subprocess(pid, 0, name="Washer")
        assert sub["result"] == {"subprocess": 1}
        await S.add_stream(pid, 1, "Wash bath", t_in=30, t_out=70, CP=4)

        view = await S.get_project(pid)
        streams = view["processes"][0]["subprocesses"][0]["streams"]
        assert [s["key"] for s in streams] == ["stream_0_0", "stream_0_1", "stream_0_2"]
        assert streams[2]["values"] == {"Tin": "95", "Tout": "60", "ṁ": "3600", "cp": "4.18"}
        assert streams[2]["units"]["ṁ"] == "kg/h"

        await S.update_stream(pid, 0, 1, t_out=150)
        full = await S.get_project(pid, full=True)
        assert full["processes"][0]["streams"][1]["stream_values"]["Tout"] == "150"

        out = await S.analyse_project(pid, t_min=10)
        assert len(out["streams"]) == 4
        assert out["pinch"]["min_heating_kW"] >= 0
        assert out["optimization"]["feasible_points"] > 0
        assert out["economics"]["investment_eur"] > 0

        pumps = await S.list_heat_pumps(pid, real_only=True, limit=3)
        assert len(pumps) == 3 and all(p["kind"] == "real" for p in pumps)
        econ = await S.economic_analysis(pid, inputs={"pFuel": 9}, pumps=[{"refrigerant": pumps[1]["refrigerant"], "T_sink": pumps[1]["T_sink"]}])
        assert econ["pump"]["refrigerant"] == pumps[1]["refrigerant"]

        report = tmp_path / "report.html"
        await S.generate_report(pid, str(report), "de")
        assert "Wärmeintegrationsbericht" in report.read_text(encoding="utf-8")

        saved = tmp_path / "project.json"
        await S.save_project_file(pid, str(saved))
        again = await S.create_project(file_path=str(saved))
        assert again["project"]["processes"][0]["name"] == "Dryer"

        # Deleting moves later indices and the selection, as the page does.
        await S.replace_project(pid, {**full, "selected_streams": {"stream_0_2": True, "stream_1_0": True}})
        await S.delete_stream(pid, 0, 0)
        assert (await S.get_project(pid))["selected_streams"] == ["stream_0_1", "stream_1_0"]
        await S.delete_subprocess(pid, 0)
        left = await S.get_project(pid)
        assert left["selected_streams"] == ["stream_0_0"]
        assert left["processes"][0]["subprocesses"][0]["name"] == "Washer"
        await S.delete_subprocess(pid, 0)
        assert (await S.get_project(pid))["processes"] == []

        with pytest.raises(ApiError, match="no subprocess"):
            await S.add_stream(pid, 5, "x", t_in=1, t_out=2, CP=1)
        with pytest.raises(ApiError, match="Unit"):
            await S.add_process(pid) and await S.add_stream(pid, 0, "x", t_in=1, t_out=2, CP=1, units={"CP": "MW/K"})

    run(body)


def test_examples_site_plan_and_formula(tmp_path):
    async def body():
        examples = await S.list_examples()
        p = await S.create_project(example=examples[0])
        pid = p["project_id"]
        assert sum(len(g["subprocesses"]) for g in p["project"]["processes"]) == 4
        png = tmp_path / "plan.png"
        png.write_bytes(bytes.fromhex(
            "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
            "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082"))
        r = await S.set_site_plan(pid, str(png), bounds=[[51.70, 8.76], [51.71, 8.78]])
        assert r["project"]["has_site_plan"]
        full = await S.get_project(pid, full=True)
        assert full["site_plan"]["url"].startswith("data:image/png;base64,")
        await S.set_site_plan(pid, remove=True)
        assert not (await S.get_project(pid))["has_site_plan"]
        ok = await S.validate_cop_formula("0.5 * carnot")
        assert ok["valid"]
        out = await S.analyse_project(pid, cop_formula={"name": "Half Carnot", "expression": "0.5 * carnot"})
        assert out["optimization"]["feasible_points"] > 0
        assert (await S.economics_defaults())["form"]["specCost"] == 1000

    run(body)


def test_driving_a_connected_page(tmp_path):
    async def body():
        created = await S.create_project(example=(await S.list_examples())[0])
        pid = created["project_id"]
        session = live.create(pid)
        seen = []

        async def page():
            async for chunk in live.events(session):
                if not chunk.startswith("event: "):
                    continue
                event = json.loads(chunk.split("data: ", 1)[1])
                seen.append(event)
                if event.get("type") != "command":
                    continue
                name, args = event["name"], event["args"]
                if name == "fail":
                    live.resolve(session, event["id"], False, error="not available here")
                elif name == "generate_report":
                    live.resolve(session, event["id"], True, {"html": "<html>page report</html>"})
                else:
                    live.resolve(session, event["id"], True, {"ran": name, "args": args})

        task = asyncio.create_task(page())
        await asyncio.sleep(0)

        sessions = await S.live_sessions()
        assert sessions[0]["session_id"] == session.id and sessions[0]["connected"]
        assert (await S.live_view(session.id)) == {"ran": "get_view", "args": {}}
        r = await S.live_select_streams(session.id, keys=["stream_0_0"], value=False)
        assert r["args"] == {"value": False, "all": False, "none": False, "keys": ["stream_0_0"]}
        await S.live_set_analysis(session.id, t_min=15, heat_recovery_pct=50)
        names = [e["name"] for e in seen if e.get("type") == "command"]
        assert names[-3:] == ["set_t_min", "set_recovery_pct", "wait_idle"]
        await S.live_select_heat_pumps(session.id, pumps=[{"refrigerant": "R600", "T_sink": 100}])
        out = tmp_path / "live.html"
        await S.live_generate_report(session.id, str(out))
        assert out.read_text() == "<html>page report</html>"
        with pytest.raises(ApiError, match="not available here"):
            await S.live_command(session.id, "fail")

        # Project edits on the session's project reach the page.
        await S.set_notes(pid, project_notes="Edited by the AI")
        await asyncio.sleep(0.05)
        project_events = [e for e in seen if e.get("type") == "project"]
        assert project_events[-1]["state"]["project_notes"] == "Edited by the AI"
        task.cancel()

    run(body)
