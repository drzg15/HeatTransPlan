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
