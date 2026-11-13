"""Live sessions: a page subscribes, the AI runs commands on it, the page
answers. The server keeps nothing of the project."""

import asyncio
import json

import pytest

from app.services import live


@pytest.fixture(autouse=True)
def _isolated(monkeypatch):
    monkeypatch.setattr(live, "_sessions", {})


def _parse(chunk: str) -> dict:
    event = chunk.split("\n")[0].removeprefix("event: ")
    data = json.loads(chunk.split("data: ", 1)[1])
    return {"event": event, **data}


def test_a_command_reaches_the_page_and_its_answer_comes_back():
    async def scenario():
        session = live.create()
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


def test_a_command_without_a_page_fails_fast(client):
    sid = client.post("/api/live/sessions").json()["session_id"]
    # Sessions are not listed: the code is the user's key to their page. (Without
    # a built frontend the answer is a JSON 404, with one its page: neither lists it.)
    assert sid not in client.get("/api/live/sessions").text
    r = client.post(f"/api/live/sessions/{sid}/commands", json={"name": "navigate", "args": {"page": "home"}})
    assert r.status_code == 409
    assert client.get(f"/api/live/sessions/{sid}").json()["session_id"] == sid


def test_ai_switched_off_leaves_the_rest():
    """AI off, as it is without AI_ENABLED: no Connect AI, no live endpoints,
    no /mcp; the rest still works."""
    import subprocess
    import sys
    code = (
        "import os; os.environ.pop('AI_ENABLED', None)\n"
        "from fastapi.testclient import TestClient\nfrom app.main import app\n"
        "with TestClient(app) as c:\n"
        "    f = c.get('/api/features').json()\n"
        "    print(f['ai'], f['mcp'], c.post('/api/live/sessions', json={}).status_code,\n"
        "          c.post('/mcp', json={}).status_code, c.post('/api/io/import-json-body', json={}).status_code)"
    )
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, check=True).stdout.split()
    assert out[:2] == ["False", "False"]
    assert out[2] in ("404", "405") and out[3] in ("404", "405") and out[4] == "200"


def test_the_server_keeps_no_project(client):
    """Starting a session sends nothing of the project and stores nothing:
    there is no project store and no endpoint to put one in."""
    import app.services as services
    assert not hasattr(services, "project_service")
    created = client.post("/api/live/sessions").json()
    sid, pid = created["session_id"], created["project_id"]
    for method, path in (("POST", "/api/projects"), ("PUT", f"/api/projects/{pid}"),
                         ("PUT", f"/api/live/sessions/{sid}/view")):
        assert client.request(method, path, json={}).status_code in (404, 405)
    assert set(vars(live.get(sid))) == {"id", "project_id", "created", "last_seen", "subscribers",
                                        "pending", "paused", "log"}
    assert client.delete(f"/api/live/sessions/{sid}").status_code == 200
    assert live.get(sid) is None


def test_a_closed_page_ends_its_session(monkeypatch):
    """When the page's stream closes and it does not come back within the
    grace time, the session ends."""
    monkeypatch.setattr(live, "DISCONNECT_GRACE_SECONDS", 0.05)

    async def scenario():
        session = live.create()
        stream = live.events(session)
        await stream.__anext__()  # hello: the page is connected
        await stream.aclose()  # the page closed
        assert live.get(session.id) is not None  # a reload may follow
        await asyncio.sleep(0.2)
        return session.id

    assert live.get(asyncio.run(scenario())) is None


def test_a_reloaded_page_keeps_its_session(monkeypatch):
    monkeypatch.setattr(live, "DISCONNECT_GRACE_SECONDS", 0.1)

    async def scenario():
        session = live.create()
        first = live.events(session)
        await first.__anext__()
        await first.aclose()
        second = live.events(session)  # reconnected within the grace time
        await second.__anext__()
        await asyncio.sleep(0.25)
        alive = live.get(session.id) is not None
        await second.aclose()
        return alive

    assert asyncio.run(scenario())


def test_pausing_stops_the_ai_and_the_log_reaches_the_page(client, monkeypatch):
    from app.services import live
    monkeypatch.setattr(live, "_sessions", {})
    sid = client.post("/api/live/sessions").json()["session_id"]
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
