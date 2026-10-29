"""The MCP server's tools against the real backend (in-process), with a stand-in
page answering live commands the way the browser does."""

import asyncio
import copy
import json

import httpx
import pytest

from app.main import app
from app.models.project import ProjectState
from app.services import live, project_service

mcp_server = pytest.importorskip("heattransplan_mcp.server")
from heattransplan_mcp.api import Api, ApiError  # noqa: E402
from heattransplan_mcp import files  # noqa: E402

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


_pages = []  # the stand-in pages' listeners, to close one
_asked = []  # what the stand-in pages were asked to allow
EMPTY = ProjectState().model_dump()


def page_command(page: dict, name: str, args: dict, allow: bool = True):
    """What the browser page does with a command (frontend/src/live/commands.ts),
    on page = {"state": project, "steps": undo stack}."""
    state = page["state"]
    if name == "confirm_ai_action":
        _asked.append(args)
        return {"allowed": allow}
    if name == "get_project":
        return {**state, "selected_streams": state.get("selected_streams") or {}}
    if name == "edit_project":
        page["steps"].append(copy.deepcopy(state))
        state.update(args["changes"])
        return {"ok": True}
    if name == "undo":
        page["state"] = page["steps"].pop()
        return {"undone": True}
    if name == "set_project":
        page["state"], page["steps"] = copy.deepcopy(args.get("state") or EMPTY), []
        return {"processes": len(page["state"].get("proc_group_names", []))}
    if name in ("set_project_notes", "set_pinch_notes"):
        state[name[4:]] = args["notes"]
        return {"ok": True}
    if name == "get_view":
        return {"page": "/data-collection", "scenarios": [], "project": {"groups": [
            {"index": gi, "name": n, "subprocesses": [
                {"index": pi, "streams": state["processes"][pi].get("streams", [])}
                for pi in state["proc_groups"][gi]]}
            for gi, n in enumerate(state.get("proc_group_names", []))]}}
    return {"ran": name, "args": args}


async def open_page(example=None, allow=True):
    """A page the user has open and connected, with an empty project or an
    example: returns its Connect AI code, all the AI works with. It holds the
    project as the browser does and keeps the backend's copy in step; the
    user there answers every "may the AI ...?" with allow."""
    state = await S.api.get(f"/api/assets/examples/{example}") if example else None
    created = await S.api.post("/api/projects", json=state)
    session = live.create(created["project_id"])
    page = {"state": await S.api.get(f"/api/projects/{created['project_id']}"), "steps": []}

    async def listen():
        async for chunk in live.events(session):
            if chunk.startswith("event: "):
                event = json.loads(chunk.split("data: ", 1)[1])
                if event.get("type") != "command":
                    continue
                result = page_command(page, event["name"], event["args"], allow)
                project_service.update_project(session.project_id, ProjectState(**page["state"]),
                                               origin=session.id)
                live.resolve(session, event["id"], True, result)

    _pages.append(asyncio.create_task(listen()))
    await asyncio.sleep(0.01)
    return session.id


def test_building_and_analysing_a_project(tmp_path):
    async def body():
        pid = await open_page()
        assert (await S.get_project(pid))["processes"] == []

        r = await S.add_process(pid, name="Dryer", lat=51.7, lon=8.7)
        assert r["result"] == {"process": 0}
        proc = r["changed"]  # the step returns what it changed
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
        text = report.read_text(encoding="utf-8")
        assert "Wärmeintegrationsbericht" in text and "KI-Assistenten" in text  # marked as AI-made

        saved = tmp_path / "project.json"
        await S.save_project_file(pid, str(saved))
        again = await S.replace_project(await open_page(), file_path=str(saved))
        assert again["processes"][0]["name"] == "Dryer"

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
        pid = await open_page()
        p = await S.replace_project(pid, example=examples[0])
        assert sum(len(g["subprocesses"]) for g in p["processes"]) == 4
        png = tmp_path / "plan.png"
        png.write_bytes(bytes.fromhex(
            "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
            "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082"))
        await S.set_site_plan(pid, str(png), bounds=[[51.70, 8.76], [51.71, 8.78]])
        assert (await S.get_project(pid))["has_site_plan"]
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
        example = await S.api.get(f"/api/assets/examples/{(await S.list_examples())[0]}")
        pid = (await S.api.post("/api/projects", json=example))["project_id"]
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
                elif name == "confirm_ai_action":
                    live.resolve(session, event["id"], True, {"allowed": True})
                elif name == "generate_report":
                    live.resolve(session, event["id"], True, {"html": "<html>page report</html>"})
                else:
                    live.resolve(session, event["id"], True, {"ran": name, "args": args})

        task = asyncio.create_task(page())
        await asyncio.sleep(0)

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

        # Notes are the page's own command, not a new project.
        await S.set_notes(pid, project_notes="Edited by the AI")
        assert seen[-1]["name"] == "set_project_notes"
        assert seen[-1]["args"] == {"notes": "Edited by the AI"}
        task.cancel()

    run(body)


def test_training_a_cop_model_and_using_it(tmp_path):
    from tests.test_cop_training import MAP4, german_csv, synthetic

    data = tmp_path / "plant.csv"
    data.write_bytes(german_csv(synthetic()))

    async def body():
        trained = await S.train_cop_model(str(data), MAP4, name="Plant")
        assert trained["test_metrics"]["r2"] > 0.95 and trained["heat_pumps_added"] == 4
        pid = await open_page((await S.list_examples())[0])
        await S.analyse_project(pid, custom_model="Plant")
        pumps = await S.list_heat_pumps(pid, refrigerant="Plant", limit=50)
        assert pumps and all(p["type"] == "Custom model" for p in pumps)
        with pytest.raises(ApiError, match="No trained model"):
            await S.analyse_project(pid, custom_model="Nope")

    run(body)


def test_page_parity_edits_and_inputs(tmp_path):
    """What the page does beyond the basics: moving a process carries its
    subprocesses, the stream editor's extra fields, a heater's presets, the
    status quo, reading a data file before training, the method docs."""
    from tests.test_cop_training import german_csv, synthetic

    async def body():
        pid = await open_page()
        await S.add_process(pid, name="Dryer", lat=51.0, lon=8.0)
        await S.update_subprocess(pid, 0, lat=51.001, lon=8.002, box_scale=2, density="1.2 kg/m³")
        await S.update_process(pid, 0, lat=51.5)
        node = (await S.get_project(pid, full=True))["processes"][0]
        assert (float(node["lat"]), float(node["lon"])) == pytest.approx((51.501, 8.002))
        assert node["box_scale"] == 2 and node["extra_info"]["density"] == "1.2 kg/m³"

        await S.add_stream(pid, 0, "Exhaust", t_in=70, t_out=30, CP=10, stream_type="air",
                           extra={"Water Content In": 12}, units={"Water Content In": "g/kg"})
        await S.update_stream(pid, 0, 0, mass_flow=10, cp=1.0, clear=["CP"])
        s = (await S.get_project(pid, full=True))["processes"][0]["streams"][0]
        assert s["stream_values"]["CP"] == "" and s["stream_values"]["Water Content In"] == "12"
        assert "Water Content In" in s["display_vars"]
        await S.update_stream(pid, 0, 0, stream_type="steam")
        s = (await S.get_project(pid, full=True))["processes"][0]["streams"][0]
        assert s["display_vars"] == ["Tin", "ṁ"]
        with pytest.raises(ApiError, match="Unknown stream variable"):
            await S.update_stream(pid, 0, 0, show=["Colour"])

        ex = await open_page((await S.list_examples())[0])
        demands = [{"heat_demand": 900, "cooling_demand": 400,
                    "selected_heat_streams": [], "selected_cooling_streams": []}]
        out = await S.analyse_project(ex, t_min=12, energy_demands=demands, reference_heater="oil")
        assert out["status_quo"]["total_current_heating"] == 900
        saved = await S.get_project(ex, full=True)
        assert saved["t_min"] == 12 and saved["energy_demands"] == demands
        cached = S._analysis[await S._page(ex)]
        assert cached["economics_inputs"]["pFuel"] == 8  # the oil preset
        await S.economic_analysis(ex, reference_heater="eboiler")
        assert S._analysis[await S._page(ex)]["economics_inputs"]["eta"] == 99

        data = tmp_path / "plant.csv"
        data.write_bytes(german_csv(synthetic()))
        seen = await S.inspect_cop_data(str(data))
        assert "COP" in seen["guess"] and seen["rows"] > 0

        assert "Pinch" in await S.explain("pinch")

    run(body)


def test_reading_documents_and_the_guide(tmp_path):
    import zipfile

    def office(name, parts):
        path = tmp_path / name
        with zipfile.ZipFile(path, "w") as z:
            for part, xml in parts.items():
                z.writestr(part, xml)
        return str(path)

    W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
    docx = office("site.docx", {"word/document.xml": (
        f'<w:document {W}><w:body><w:p><w:r><w:t>Dairy, </w:t></w:r><w:r><w:t>Bremen</w:t></w:r></w:p>'
        '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Stream</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Tin</w:t></w:r></w:p></w:tc></w:tr>'
        '<w:tr><w:tc><w:p><w:r><w:t>Whey</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>72</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'
        '</w:body></w:document>')})
    A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
    slide = lambda text: f'<p:sld {A}><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>{text}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>'
    pptx = office("talk.pptx", {"ppt/slides/slide10.xml": slide("ten"), "ppt/slides/slide2.xml": slide("two")})
    M = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
    xlsx = office("streams.xlsx", {
        "xl/workbook.xml": f'<workbook {M} {R}><sheets><sheet name="Streams" sheetId="1" r:id="rId1"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
        "xl/sharedStrings.xml": f'<sst {M}><si><t>Condenser</t></si></sst>',
        "xl/worksheets/sheet1.xml": f'<worksheet {M}><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1"><v>35.5</v></c><c r="D1"><v>2</v></c></row></sheetData></worksheet>',
    })

    async def body():
        assert (await S.read_document(docx))["content"] == ["Dairy, Bremen", {"table": [["Stream", "Tin"], ["Whey", "72"]]}]
        assert [s["content"] for s in (await S.read_document(pptx))["slides"]] == [["two"], ["ten"]]
        sheet = (await S.read_document(xlsx))["sheets"][0]
        assert sheet["sheet"] == "Streams" and sheet["rows"] == [["Condenser", None, 35.5, 2]]
        with pytest.raises(ApiError, match="Cannot read .pdf"):
            await S.read_document("x.pdf", content="JVBERi0=")
        with pytest.raises(ApiError, match="Cannot open"):
            await S.read_document(str(tmp_path / "missing.docx"))
        for step in ("start", "data", "analysis", "economics", "report"):
            assert "?" in await S.guide(step)

    run(body)


def test_only_on_an_open_page():
    """The AI works only on a page that is open and connected: without one,
    or once it closes, every project tool refuses."""
    async def body():
        stored = (await S.api.post("/api/projects", json=None))["project_id"]
        for call in (lambda: S.get_project(stored), lambda: S.add_process(stored),
                     lambda: S.analyse_project(stored), lambda: S.export_csv(stored, "x.csv"),
                     lambda: S.list_heat_pumps("nocode12")):
            with pytest.raises(ApiError, match="Connect AI"):
                await call()
        code = await open_page()
        await S.add_process(code, name="Kiln")
        _pages[-1].cancel()  # the user closes the page
        await asyncio.sleep(0.01)
        with pytest.raises(ApiError, match="Connect AI"):
            await S.get_project(code)

    run(body)


def test_the_user_decides_and_sees():
    """Deleting asks the user on the page and stops if they decline; what the
    AI changed is listed on the page; while paused the AI can do nothing."""
    async def body():
        code = await open_page(allow=False)
        await S.add_process(code, name="Kiln")
        await S.get_project(code)  # reading is not listed
        with pytest.raises(ApiError, match="declined"):
            await S.delete_process(code, 0)
        assert _asked[-1] == {"kind": "delete_process", "name": "Kiln"}
        assert (await S.get_project(code))["processes"][0]["name"] == "Kiln"  # untouched
        session = live.get(code)
        assert [e["tool"] for e in session.log] == ["add_process"]
        assert "name=Kiln" in session.log[0]["detail"]

        session.paused = True
        with pytest.raises(ApiError, match="paused"):
            await S.get_project(code)
        with pytest.raises(ApiError, match="paused"):
            await S.live_view(code)
        session.paused = False
        assert (await S.get_project(code))["processes"]

    run(body)


def test_served_online_at_mcp(monkeypatch):
    """The backend's /mcp: an agent connects with the URL alone. Files come in
    as content and go out as links; the server's own disk stays out of reach."""
    from fastapi.testclient import TestClient
    from app import dependencies, mcp_http

    page = {"state": copy.deepcopy(EMPTY), "steps": []}

    async def the_page(session_id, name, args=None, timeout=60):
        return page_command(page, name, args or {})

    monkeypatch.setattr(S, "_live", the_page)

    monkeypatch.setattr(dependencies, "API_KEYS", ["k1"])
    monkeypatch.setattr(mcp_http, "API_KEYS", ["k1"])
    headers = {"Accept": "application/json, text/event-stream", "Authorization": "Bearer k1"}

    def call(c, name, args):
        r = c.post("/mcp", headers=headers, json={"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                                                 "params": {"name": name, "arguments": args}})
        out = r.json()["result"]
        return out.get("isError"), out["content"][0]["text"]

    with TestClient(app) as c:
        assert c.post("/mcp", json={}).status_code == 401  # no key
        r = c.post("/mcp", headers=headers, json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
        names = {t["name"] for t in r.json()["result"]["tools"]}
        assert "analyse_project" in names
        assert not names & {"live_sessions", "list_projects", "create_project", "delete_project"}

        # A page connects (its event stream stands in here), and the AI writes on it.
        code = c.post("/api/live/sessions", json={}, headers={"X-API-Key": "k1"}).json()["session_id"]
        monkeypatch.setattr(live.Session, "connected", property(lambda s: s.id == code))
        err, text = call(c, "set_notes", {"project_id": code, "project_notes": "from a file"})
        assert not err, text
        _, text = call(c, "save_project_file", {"project_id": code, "file_path": "/etc/evil.json"})
        url = text.split(": ", 1)[1]
        assert url.startswith("http://testserver/api/mcp/files/") and url.endswith("/evil.json")
        got = c.get(url.split("testserver", 1)[1])
        assert got.json()["project_notes"] == "from a file"
        assert c.get(url.split("testserver", 1)[1].replace("evil", "other")).status_code == 404

        err, text = call(c, "read_document", {"file_path": "/etc/hosts"})
        assert err and "cannot open files" in text
        err, text = call(c, "read_document", {"file_path": "s.csv", "content": "a,b\n1,2"})
        assert not err and json.loads(text)["text"] == "a,b\n1,2"
    assert files.HOSTED is False  # the local tools are themselves again


def test_one_step_at_a_time(tmp_path, monkeypatch):
    """The AI opens with what the page holds and the ways of working; each
    step sends only what it changes, returns it, and can be taken back; a new
    case starts empty."""
    sent = []
    real = S._live

    async def spy(session_id, name, args=None, timeout=60):
        sent.append((name, args or {}))
        return await real(session_id, name, args, timeout)

    monkeypatch.setattr(S, "_live", spy)

    async def body():
        code = await open_page((await S.list_examples())[0])
        started = await S.start(code)
        assert started["say"] == ("Here is the current page: 1 process, 4 subprocesses, 6 streams. "
                                  "Continue with it or start fresh?")
        assert set(started["modes"]) == {"guided_study", "chat_building", "from_document", "validation"}
        assert len(started["rules"]) == 3

        r = await S.add_stream(code, 1, "Condenser", t_in=40, t_out=30, CP=5)
        assert r["changed"]["key"] == "stream_1_1" and r["changed"]["values"]["CP"] == "5"
        step = [args for name, args in sent if name == "edit_project"][-1]
        assert list(step["changes"]) == ["processes"]  # not the whole project
        assert step["focus"] == "stream_1_1" and step["label"] == "add stream Condenser"
        await S.undo(code)
        assert len((await S.get_project(code))["processes"][0]["subprocesses"][1]["streams"]) == 1

        await S.replace_project(code, empty=True)
        assert (await S.get_project(code))["processes"] == []
        assert (await S.start(code))["say"] == "The page is empty, so we start a new case."

        out = tmp_path / "differences.csv"
        await S.save_text_file(str(out), "quantity,presentation,app\n")
        assert out.read_text() == "quantity,presentation,app\n"

    run(body)
