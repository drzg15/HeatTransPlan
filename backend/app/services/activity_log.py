"""What the app is used for, anonymously: one SQLite table in the container.

A row says which feature was used, by whom in kind only ("human" on the page,
"ai" through the MCP server or a page command, "system" for errors), whether
it worked and how long it took. Never who: no address, page code or project
id (paths keep their pattern, e.g. /api/projects/{project_id}). Never the
data: no values, names or error messages, only which fields an AI set, which
parts of a project changed and where in the code an error was raised.

Past MAX_BYTES the oldest half is deleted. The file stays on the server (a
Docker volume, see docker-compose.yml), never in the repository. Read it with
    docker compose exec backend python -m app.services.activity_log [rows] [actor]
"""

from __future__ import annotations

import os
import sqlite3
import sys
import tempfile
import threading
import traceback
from datetime import datetime, timezone
from typing import Optional

PATH = os.getenv("ACTIVITY_LOG") or os.path.join(tempfile.gettempdir(), "heattransplan_activity.sqlite")
MAX_BYTES = 20 * 1024 * 1024
# Size is checked every this many rows, not on each one.
CHECK_EVERY = 200
ACTORS = ("human", "ai", "ai+human", "system")

_lock = threading.Lock()
_conn: Optional[sqlite3.Connection] = None
_conn_path: Optional[str] = None
_since_check = 0


def _db() -> sqlite3.Connection:
    global _conn, _conn_path
    if _conn is None or _conn_path != PATH:
        conn = sqlite3.connect(PATH, check_same_thread=False, isolation_level=None)
        # Kept only once the table exists, so a failed start (disk full) is retried.
        conn.execute(
            "CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY, time TEXT, actor TEXT, "
            "action TEXT, detail TEXT, status INTEGER, ms INTEGER)")
        _conn, _conn_path = conn, PATH
    return _conn


def _trim(db: sqlite3.Connection) -> None:
    """Past the size limit, drop the oldest half and give the space back."""
    if os.path.getsize(PATH) <= MAX_BYTES:
        return
    db.execute("DELETE FROM log WHERE id <= (SELECT (MIN(id) + MAX(id)) / 2 FROM log)")
    db.execute("VACUUM")


def actor_of(header: Optional[str]) -> str:
    """The X-Actor header the page and the MCP server send; anything else is the page."""
    return header if header in ACTORS else "human"


def where_it_failed(exc: BaseException) -> str:
    """The exception's type and the app's frames it passed, without its message
    (a message can carry the user's values)."""
    frames = [f"{f.filename.split('/app/', 1)[-1]}:{f.lineno} {f.name}"
              for f in traceback.extract_tb(exc.__traceback__) if "/app/" in f.filename]
    return type(exc).__name__ + "".join(f"\n  at {f}" for f in frames)


def write(actor: str, action: str, detail: str = "", status: Optional[int] = None,
          ms: Optional[int] = None) -> None:
    """One row. Never raises: a log that fails must not fail the request."""
    global _since_check
    try:
        with _lock:
            db = _db()
            db.execute(
                "INSERT INTO log (time, actor, action, detail, status, ms) VALUES (?,?,?,?,?,?)",
                (datetime.now(timezone.utc).isoformat(timespec="seconds"), actor, action,
                 detail[:2000], status, ms))
            _since_check += 1
            if _since_check >= CHECK_EVERY:
                _since_check = 0
                _trim(db)
    except Exception as exc:  # noqa: BLE001
        print(f"activity log: {type(exc).__name__}", file=sys.stderr)


def last(rows: int = 50, actor: Optional[str] = None) -> list:
    with _lock:
        sql = "SELECT time, actor, action, status, ms, detail FROM log"
        args: tuple = ()
        if actor:
            sql, args = sql + " WHERE actor = ?", (actor,)
        return _db().execute(sql + " ORDER BY id DESC LIMIT ?", (*args, rows)).fetchall()[::-1]


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 50
    for t, who, action, status, ms, detail in last(n, sys.argv[2] if len(sys.argv) > 2 else None):
        extra = " ".join(x for x in (f"[{status}]" if status else "", f"{ms}ms" if ms is not None else "") if x)
        print(f"{t} {who:<8} {action} {extra}".rstrip() + (f"\n    {detail}" if detail else ""))
