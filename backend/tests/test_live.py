"""Live sessions: a page subscribes, the AI edits the project and runs
commands, the page answers."""

import asyncio
import json

import pytest

from app.models.project import ProjectState
from app.services import live, project_service


@pytest.fixture(autouse=True)
def _isolated(tmp_path, monkeypatch):
    monkeypatch.setattr(project_service, "STATE_DIR", tmp_path)
    monkeypatch.setattr(live, "_sessions", {})


def _parse(chunk: str) -> dict:
    event = chunk.split("\n")[0].removeprefix("event: ")
    data = json.loads(chunk.split("data: ", 1)[1])
    return {"event": event, **data}


def test_a_command_reaches_the_page_and_its_answer_comes_back():
    async def scenario():
        pid, _ = project_service.create_project()
        session = live.create(pid)
        stream = live.events(session)
        assert _parse(await stream.__anext__())["event"] == "hello"

        call = asyncio.create_task(live.send_command(session, "set_t_min", {"value": 15}))
        cmd = _parse(await stream.__anext__())
        assert (cmd["event"], cmd["name"], cmd["args"]) == ("command", "set_t_min", {"value": 15})
        assert live.resolve(session, cmd["id"], True, {"t_min": 15})
        assert await call == {"t_min": 15}

        call = asyncio.create_task(live.send_command(session, "explode", {}))
        cmd = _parse(await stream.__anext__())
        live.resolve(session, cmd["id"], False, error="Unknown command")
        with pytest.raises(RuntimeError, match="Unknown command"):
            await call
        await stream.aclose()
        assert not session.connected

    asyncio.run(scenario())


def test_project_edits_reach_other_pages_but_not_their_origin():
    async def scenario():
        pid, state = project_service.create_project()
        a, b = live.create(pid), live.create(pid)
        sa, sb = live.events(a), live.events(b)
        await sa.__anext__(), await sb.__anext__()
        state.project_notes = "from the AI"
        project_service.update_project(pid, state, origin=a.id)
        got = _parse(await asyncio.wait_for(sb.__anext__(), 1))
        assert got["event"] == "project" and got["state"]["project_notes"] == "from the AI"
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(sa.__anext__(), 0.2)
        await sb.aclose()

    asyncio.run(scenario())


def test_a_command_without_a_page_fails_fast(client):
    pid = client.post("/api/projects", json=ProjectState().model_dump()).json()["project_id"]
    sid = client.post("/api/live/sessions", json={"project_id": pid}).json()["session_id"]
    # Sessions are not listed: the code is the user's key to their page.
    assert "json" not in client.get("/api/live/sessions").headers.get("content-type", "")
    r = client.post(f"/api/live/sessions/{sid}/commands", json={"name": "navigate", "args": {"page": "home"}})
    assert r.status_code == 409
    assert client.post("/api/live/sessions", json={"project_id": "nope"}).status_code == 404
    created = client.post("/api/live/sessions", json={"state": {"project_notes": "x"}}).json()
    assert client.get(f"/api/projects/{created['project_id']}").json()["project_notes"] == "x"
    assert client.put(f"/api/live/sessions/{sid}/view", json={"page": "home"}).status_code == 200
    assert client.get(f"/api/live/sessions/{sid}").json()["view"] == {"page": "home"}


def test_ai_switched_off_leaves_the_rest():
    """AI_ENABLED=0: no Connect AI, no live endpoints, no /mcp; projects still work."""
    import subprocess
    import sys
    code = (
        "import os; os.environ['AI_ENABLED']='0'\n"
        "from fastapi.testclient import TestClient\nfrom app.main import app\n"
        "with TestClient(app) as c:\n"
        "    f = c.get('/api/features').json()\n"
        "    print(f['ai'], f['mcp'], c.post('/api/live/sessions', json={}).status_code,\n"
        "          c.post('/mcp', json={}).status_code, c.post('/api/projects').status_code)"
    )
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, check=True).stdout.split()
    assert out[:2] == ["False", "False"]
    assert out[2] in ("404", "405") and out[3] in ("404", "405") and out[4] == "200"


def test_projects_do_not_stay_on_the_server(client, monkeypatch, tmp_path):
    """Disconnecting deletes the page's project; any other project goes once
    nobody has changed it for the retention time. Open sessions keep theirs."""
    import os
    import time
    from app.services import live, project_service
    monkeypatch.setattr(project_service, "STATE_DIR", tmp_path)
    monkeypatch.setattr(live, "_sessions", {})

    sid = client.post("/api/live/sessions", json={"state": {}}).json()["session_id"]
    pid = live.get(sid).project_id
    assert client.delete(f"/api/live/sessions/{sid}").status_code == 200
    assert client.get(f"/api/projects/{pid}").status_code == 404

    old = client.post("/api/projects").json()["project_id"]
    kept = client.post("/api/live/sessions", json={"state": {}}).json()["session_id"]
    kept_pid = live.get(kept).project_id
    week_ago = time.time() - 7 * 24 * 3600
    for p in (old, kept_pid):
        os.utime(tmp_path / f"{p}.json", (week_ago, week_ago))
    monkeypatch.setattr(project_service, "_last_cleanup", 0.0)
    client.post("/api/projects")  # creating a project runs the cleanup
    assert client.get(f"/api/projects/{old}").status_code == 404
    assert client.get(f"/api/projects/{kept_pid}").status_code == 200


def test_pausing_stops_the_ai_and_the_log_reaches_the_page(client, monkeypatch):
    from app.services import live
    monkeypatch.setattr(live, "_sessions", {})
    sid = client.post("/api/live/sessions", json={"state": {}}).json()["session_id"]
    monkeypatch.setattr(live.Session, "connected", property(lambda s: True))
    assert client.get(f"/api/live/pages/{sid}").json()["session_id"] == sid

    assert client.put(f"/api/live/sessions/{sid}/pause", json={"paused": True}).json() == {"paused": True}
    assert client.get(f"/api/live/sessions/{sid}").json()["paused"] is True
    assert client.get(f"/api/live/pages/{sid}").status_code == 423
    r = client.post(f"/api/live/sessions/{sid}/commands", json={"name": "navigate", "args": {}})
    assert r.status_code == 423
    client.put(f"/api/live/sessions/{sid}/pause", json={"paused": False})
    assert client.get(f"/api/live/pages/{sid}").status_code == 200

    entry = client.post(f"/api/live/pages/{sid}/log", json={"tool": "add_stream", "detail": "name=Exhaust"}).json()
    assert entry["tool"] == "add_stream" and list(live.get(sid).log)[-1] == entry
    assert client.post("/api/live/pages/nope1234/log", json={"tool": "x"}).status_code == 404
