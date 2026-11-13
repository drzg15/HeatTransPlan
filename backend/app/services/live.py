"""Live sessions: an open page that an AI (through the MCP server) can watch
and drive.

The server never holds the project: the page does. A session is only a
relay. The page registers one and listens on an event stream for commands
(read the project, apply an edit, navigate, select streams, pick a heat
pump, ...). It runs each command with the same functions its own buttons
call, then posts the result back, which is what the command call returns.

A session carries an id the AI addresses the page by (project_id, a random
id with no data behind it) and the AI's activity list, in memory. What the
page shows, the AI asks the page for (the get_view command). When the
page's stream closes and it does not reconnect within
DISCONNECT_GRACE_SECONDS (a reload does), the session ends and all of it is
gone.

Held in memory: the backend runs as one process (see the Dockerfile).
ponytail: one process only; a shared broker (e.g. Redis) when it runs on more.
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Dict, List, Optional

from app.services import activity_log

# A page that closed its stream has this long to reconnect (a reload) before
# its session ends. Also the limit for a session
# no page ever connected to.
DISCONNECT_GRACE_SECONDS = 120
# Keeps proxies from closing a quiet stream.
HEARTBEAT_SECONDS = 15


class SessionNotConnected(Exception):
    """No page is listening on the session, so a command cannot run."""


class SessionPaused(Exception):
    """The user paused the AI on the page: nothing runs until they resume."""


@dataclass
class Session:
    id: str
    project_id: str
    created: float = field(default_factory=time.time)
    last_seen: float = field(default_factory=time.time)
    subscribers: List[asyncio.Queue] = field(default_factory=list)
    pending: Dict[str, asyncio.Future] = field(default_factory=dict)
    # Set by the user on the page; the AI then can do nothing until resumed.
    paused: bool = False
    # What the AI did, newest last, for the page's activity list.
    log: deque = field(default_factory=lambda: deque(maxlen=100))

    @property
    def connected(self) -> bool:
        return bool(self.subscribers)

    def summary(self) -> Dict[str, Any]:
        return {
            "session_id": self.id,
            "project_id": self.project_id,
            "connected": self.connected,
            "last_seen": self.last_seen,
            "paused": self.paused,
        }


_sessions: Dict[str, Session] = {}


def end(session_id: str) -> bool:
    """End a session. False when there was no such session."""
    return _sessions.pop(session_id, None) is not None


def _prune() -> None:
    now = time.time()
    for sid in [s.id for s in _sessions.values()
                if not s.connected and now - s.last_seen > DISCONNECT_GRACE_SECONDS]:
        end(sid)


async def _end_unless_back(session: Session) -> None:
    """After the page's stream closed: end the session unless it reconnected."""
    await asyncio.sleep(DISCONNECT_GRACE_SECONDS)
    if not session.connected and time.time() - session.last_seen >= DISCONNECT_GRACE_SECONDS - 1:
        end(session.id)


def create() -> Session:
    _prune()
    session = Session(id=uuid.uuid4().hex[:8], project_id=str(uuid.uuid4()))
    _sessions[session.id] = session
    return session


def get(session_id: str) -> Optional[Session]:
    return _sessions.get(session_id)


def connected_session(key: str) -> Optional[Session]:
    """The session of a page that is open and connected, found by its code or
    its project id. The AI works only on such a page."""
    for s in _sessions.values():
        if s.connected and key in (s.id, s.project_id):
            return s
    return None


def record(session: Session, tool: str, detail: str, fields: Optional[List[str]] = None) -> Dict[str, Any]:
    """Note what the AI did: in full on the page's activity list (its user sees
    it), anonymously in the activity log (the tool and the names of the fields
    it set, never their values)."""
    entry = {"time": time.time(), "tool": tool, "detail": detail}
    session.log.append(entry)
    _publish(session, {"type": "ai_log", **entry})
    names = [f for f in fields or [] if f.isidentifier()]
    activity_log.write("ai", tool, ", ".join(names))
    return entry


def _publish(session: Session, event: Dict[str, Any]) -> None:
    for q in session.subscribers:
        q.put_nowait(event)


async def send_command(session: Session, name: str, args: Dict[str, Any], timeout: float = 30.0) -> Any:
    """Run a command on the page and return what it answered."""
    if not session.connected:
        raise SessionNotConnected(f"No page is connected to session {session.id}.")
    if session.paused:
        raise SessionPaused("The user has paused the AI on this page.")
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
        if not session.connected:
            asyncio.get_running_loop().create_task(_end_unless_back(session))
