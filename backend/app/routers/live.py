"""
Live router — an open page registers here so an AI can watch and drive it.
See app/services/live.py for how sessions, events and commands fit together.
"""

import asyncio
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.models.project import ProjectState
from app.services import live, project_service

router = APIRouter()


class SessionCreate(BaseModel):
    """The page's project, or the id of a backend project to show."""
    state: Optional[ProjectState] = None
    project_id: Optional[str] = None


class Command(BaseModel):
    name: str = Field(max_length=64)
    args: Dict[str, Any] = Field(default_factory=dict)
    timeout: float = Field(30.0, gt=0, le=300)


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
async def create_session(body: SessionCreate):
    """Start a session for a page. Its project is kept on the backend under
    project_id, where the project endpoints (and so the AI) can edit it."""
    if body.project_id:
        if project_service.get_project(body.project_id) is None:
            raise HTTPException(404, "Project not found")
        project_id = body.project_id
    else:
        project_id, _ = project_service.create_project(body.state)
    session = live.create(project_id)
    return session.summary()


@router.get("/sessions")
async def list_sessions():
    """Every session, most recently active first."""
    return live.list_sessions()


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """The session and what its page shows right now."""
    session = _session(session_id)
    return {**session.summary(), "view": session.view}


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    if not live.remove(session_id):
        raise HTTPException(404, "Live session not found")
    return {"deleted": True}


@router.get("/sessions/{session_id}/events")
async def session_events(session_id: str):
    """Server-sent events for the page: `project` when someone else changed
    the project, `command` when it should run one."""
    session = _session(session_id)
    return StreamingResponse(
        live.events(session),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.put("/sessions/{session_id}/view")
async def put_view(session_id: str, view: Dict[str, Any]):
    """The page reports what it shows (page, selections, results)."""
    live.set_view(_session(session_id), view)
    return {"ok": True}


@router.post("/sessions/{session_id}/commands")
async def run_command(session_id: str, command: Command):
    """Run a command on the page and wait for its answer."""
    session = _session(session_id)
    try:
        result = await live.send_command(session, command.name, command.args, command.timeout)
    except live.SessionNotConnected as exc:
        raise HTTPException(409, str(exc)) from exc
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
