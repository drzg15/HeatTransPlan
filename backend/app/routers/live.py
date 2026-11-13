"""
Live router — an open page registers here so an AI can watch and drive it.
See app/services/live.py for how sessions, events and commands fit together.
"""

import asyncio
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services import live

router = APIRouter()


class Command(BaseModel):
    name: str = Field(max_length=64)
    args: Dict[str, Any] = Field(default_factory=dict)
    timeout: float = Field(30.0, gt=0, le=300)


class Pause(BaseModel):
    paused: bool


class LogEntry(BaseModel):
    tool: str = Field(max_length=64)
    detail: str = Field("", max_length=500)
    # The argument names alone, for the anonymous activity log.
    fields: list[str] = Field(default_factory=list, max_length=40)


class CommandResult(BaseModel):
    ok: bool
    result: Any = None
    error: Optional[str] = None


def _session(session_id: str) -> live.Session:
    session = live.get(session_id)
    if session is None:
        raise HTTPException(404, "Live session not found")
    return session


@router.post("/sessions")
async def create_session():
    """Start a session for a page. Nothing of its project is sent or kept:
    the AI reads and edits it through commands the page runs. project_id is
    only a second name the AI can address the page by."""
    session = live.create()
    return session.summary()


def _page(key: str) -> live.Session:
    session = live.connected_session(key)
    if session is None:
        raise HTTPException(404, "No open page is connected with this code or project")
    return session


@router.get("/pages/{key}")
async def connected_page(key: str):
    """The open, connected page with this code or project id: its project and
    session. 404 when no such page is open, 423 while the user paused the AI."""
    session = _page(key)
    if session.paused:
        raise HTTPException(423, "The user has paused the AI on this page")
    return {"project_id": session.project_id, "session_id": session.id}


@router.post("/pages/{key}/log")
async def log_ai_action(key: str, entry: LogEntry):
    """What the AI did, for the page's activity list and the server's log."""
    return live.record(_page(key), entry.tool, entry.detail, entry.fields)


@router.put("/sessions/{session_id}/pause")
async def pause(session_id: str, body: Pause):
    """The user pauses or resumes the AI on their page."""
    session = _session(session_id)
    session.paused = body.paused
    return {"paused": session.paused}


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """The session (a reloaded page uses it to reconnect)."""
    return _session(session_id).summary()


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Disconnect: the session ends."""
    if not live.end(session_id):
        raise HTTPException(404, "Live session not found")
    return {"deleted": True}


@router.get("/sessions/{session_id}/events")
async def session_events(session_id: str):
    """Server-sent events for the page: `command` when it should run one,
    `ai_log` when the AI did something."""
    session = _session(session_id)
    return StreamingResponse(
        live.events(session),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/sessions/{session_id}/commands")
async def run_command(session_id: str, command: Command):
    """Run a command on the page and wait for its answer."""
    session = _session(session_id)
    try:
        result = await live.send_command(session, command.name, command.args, command.timeout)
    except live.SessionNotConnected as exc:
        raise HTTPException(409, str(exc)) from exc
    except live.SessionPaused as exc:
        raise HTTPException(423, str(exc)) from exc
    except asyncio.TimeoutError as exc:
        raise HTTPException(504, f"The page did not answer '{command.name}' in time.") from exc
    except RuntimeError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {"ok": True, "result": result}


@router.post("/sessions/{session_id}/commands/{command_id}/result")
async def post_result(session_id: str, command_id: str, body: CommandResult):
    """The page's answer to a command."""
    if not live.resolve(_session(session_id), command_id, body.ok, body.result, body.error):
        raise HTTPException(404, "No command is waiting for this answer")
    return {"ok": True}
