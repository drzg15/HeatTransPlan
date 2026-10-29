"""Live sessions: an open page that an AI (through the MCP server) can watch
and drive.

The page registers a session and keeps its project on the backend. It
listens on an event stream for two things: project changes made by someone
else (the AI editing through the project endpoints), and commands to run
(navigate, select streams, pick a heat pump, ...). It runs each command with
the same functions its own buttons call, then posts the result back, which
is what the command call returns.

Held in memory: the backend runs as one process (see the Dockerfile).
ponytail: one process only; a shared broker (e.g. Redis) when it runs on more.
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Dict, List, Optional

# A session nobody has listened to for this long is dropped.
IDLE_SECONDS = 3600
# Keeps proxies from closing a quiet stream.
HEARTBEAT_SECONDS = 15


class SessionNotConnected(Exception):
    """No page is listening on the session, so a command cannot run."""


@dataclass
class Session:
    id: str
    project_id: str
    created: float = field(default_factory=time.time)
    last_seen: float = field(default_factory=time.time)
    # What the page shows right now, as it last reported it.
    view: Dict[str, Any] = field(default_factory=dict)
    subscribers: List[asyncio.Queue] = field(default_factory=list)
    pending: Dict[str, asyncio.Future] = field(default_factory=dict)

    @property
    def connected(self) -> bool:
        return bool(self.subscribers)

    def summary(self) -> Dict[str, Any]:
        return {
            "session_id": self.id,
            "project_id": self.project_id,
            "connected": self.connected,
            "page": self.view.get("page"),
            "last_seen": self.last_seen,
        }


_sessions: Dict[str, Session] = {}


def _prune() -> None:
    now = time.time()
    for sid in [s.id for s in _sessions.values() if not s.connected and now - s.last_seen > IDLE_SECONDS]:
        del _sessions[sid]


def create(project_id: str) -> Session:
    _prune()
    session = Session(id=uuid.uuid4().hex[:8], project_id=project_id)
    _sessions[session.id] = session
    return session


def get(session_id: str) -> Optional[Session]:
    return _sessions.get(session_id)


def connected_project(key: str) -> Optional[str]:
    """The project of a page that is open and connected, found by its session
    code or its project id. The AI works only on such a page."""
    for s in _sessions.values():
        if s.connected and key in (s.id, s.project_id):
            return s.project_id
    return None


def remove(session_id: str) -> bool:
    return _sessions.pop(session_id, None) is not None


def set_view(session: Session, view: Dict[str, Any]) -> None:
    session.view = view
    session.last_seen = time.time()


def _publish(session: Session, event: Dict[str, Any]) -> None:
    for q in session.subscribers:
        q.put_nowait(event)


def notify_project(project_id: str, state: Any, origin: Optional[str] = None) -> None:
    """Tell every page showing this project that it changed, except the one
    the change came from (it already has it)."""
    payload = state.model_dump() if hasattr(state, "model_dump") else state
    for session in _sessions.values():
        if session.project_id == project_id and session.id != origin:
            _publish(session, {"type": "project", "state": payload})


async def send_command(session: Session, name: str, args: Dict[str, Any], timeout: float = 30.0) -> Any:
    """Run a command on the page and return what it answered."""
    if not session.connected:
        raise SessionNotConnected(f"No page is connected to session {session.id}.")
    command_id = uuid.uuid4().hex
    future: asyncio.Future = asyncio.get_running_loop().create_future()
    session.pending[command_id] = future
    _publish(session, {"type": "command", "id": command_id, "name": name, "args": args})
    try:
        return await asyncio.wait_for(future, timeout)
    finally:
        session.pending.pop(command_id, None)


def resolve(session: Session, command_id: str, ok: bool, result: Any = None, error: Optional[str] = None) -> bool:
    """The page's answer to a command. False when nobody waits for it any more."""
    future = session.pending.get(command_id)
    if future is None or future.done():
        return False
    if ok:
        future.set_result(result)
    else:
        future.set_exception(RuntimeError(error or "The page could not run the command."))
    return True


async def events(session: Session) -> AsyncIterator[str]:
    """The session's event stream in text/event-stream format."""
    queue: asyncio.Queue = asyncio.Queue()
    session.subscribers.append(queue)
    session.last_seen = time.time()
    try:
        yield f"event: hello\ndata: {json.dumps(session.summary())}\n\n"
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), HEARTBEAT_SECONDS)
            except asyncio.TimeoutError:
                yield ": ping\n\n"
                continue
            session.last_seen = time.time()
            yield f"event: {event['type']}\ndata: {json.dumps(event)}\n\n"
    finally:
        session.subscribers.remove(queue)
        session.last_seen = time.time()
