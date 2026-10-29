"""The activity log: what is used and by whom in kind, never who or the data,
and it stays within its size."""

import os

from app.services import activity_log, live


def test_use_is_logged_without_who_or_data(client):
    pid = client.post("/api/projects", json={}).json()["project_id"]
    state = client.get(f"/api/projects/{pid}").json()
    client.put(f"/api/projects/{pid}", json={**state, "project_notes": "Brewery Smith, 95 °C"})
    client.put(f"/api/projects/{pid}", json={**state, "project_notes": "x"}, headers={"X-Actor": "ai"})
    client.put(f"/api/projects/{pid}", json=state, headers={"X-Actor": "root"})  # unknown → human
    client.get(f"/api/projects/{pid}")  # reads are not logged
    session = live.create(pid)
    live.record(session, "add_stream", 'name=Wort cooler, t_in=95, notes="a, b=c"',
                ["name", "t_in", "notes", "Wort cooler 95"])  # a value as a name is dropped

    rows = activity_log.last(10)
    assert [(r[1], r[2]) for r in rows] == [
        ("human", "POST /api/projects"),
        ("human", "PUT /api/projects/{project_id}"),
        ("ai", "PUT /api/projects/{project_id}"),
        ("human", "PUT /api/projects/{project_id}"),
        ("ai", "add_stream"),
    ]
    assert rows[1][5] == "changed: project_notes" and rows[1][3] == 200
    assert rows[4][5] == "name, t_in, notes"
    everything = repr(rows)
    for secret in (pid, session.id, "Brewery", "Smith", "95", "Wort"):
        assert secret not in everything


def test_an_error_keeps_where_not_what():
    try:
        raise ValueError("stream 'Wort cooler' has t_in 95")
    except ValueError as exc:
        text = activity_log.where_it_failed(exc)
    assert text.startswith("ValueError") and "Wort" not in text and "95" not in text


def test_old_rows_go_when_the_file_is_too_big(monkeypatch):
    monkeypatch.setattr(activity_log, "MAX_BYTES", 64 * 1024)
    monkeypatch.setattr(activity_log, "CHECK_EVERY", 50)
    for i in range(2000):
        activity_log.write("human", f"step {i}", "x" * 200)
    assert os.path.getsize(activity_log.PATH) <= 2 * 64 * 1024
    rows = activity_log.last(5000)
    assert rows[-1][2] == "step 1999" and rows[0][2] != "step 0"
