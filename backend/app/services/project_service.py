"""
Project store. Each project gets a UUID.

Held in memory only, never written to disk: a project exists while a page or
an API client works with it and is gone when the backend restarts. The heavy
endpoints (pinch, HPI, optimization) are stateless — they take everything
they need in the request body — so only this small amount of CRUD state is
kept, and only for as long as it is in use.

A page's project goes when its live session ends (app/services/live.py). A
project no open page uses is deleted once nobody has touched it for
RETENTION_SECONDS.

Held in one process: the backend runs as one (see the Dockerfile and
app/services/live.py, which relies on the same).
"""

from __future__ import annotations
import os
import time
import uuid
from datetime import datetime
from typing import Dict, Optional, Tuple

from app.models.project import ProjectState
from app.services import live


# A project no open page uses is deleted once nobody touched it for this long.
RETENTION_SECONDS = float(os.getenv("PROJECT_RETENTION_MINUTES", "10")) * 60

# project_id -> (state as plain data, last touched). Stored as a copy so a
# caller changing its object afterwards does not change the stored project.
_projects: Dict[str, Tuple[dict, float]] = {}


def _store(project_id: str, state: ProjectState) -> None:
    _projects[project_id] = (state.model_dump(), time.time())


def create_project(state: Optional[ProjectState] = None) -> tuple[str, ProjectState]:
    """Create a new project, optionally initialized from an existing state."""
    forget_old_projects()
    project_id = str(uuid.uuid4())
    if state is None:
        state = ProjectState()
    state.timestamp = datetime.now().isoformat()
    _store(project_id, state)
    return project_id, state


def get_project(project_id: str) -> Optional[ProjectState]:
    """Retrieve a project by ID."""
    forget_old_projects()
    entry = _projects.get(project_id)
    if entry is None:
        return None
    data, _ = entry
    _projects[project_id] = (data, time.time())
    return ProjectState(**data)


def update_project(project_id: str, state: ProjectState, origin: Optional[str] = None) -> Optional[ProjectState]:
    """Replace the full project state. Pages showing the project live are told,
    except `origin`, the live session the change came from."""
    if project_id not in _projects:
        return None
    state.timestamp = datetime.now().isoformat()
    _store(project_id, state)
    live.notify_project(project_id, state, origin)
    return state


def delete_project(project_id: str) -> bool:
    """Delete a project."""
    return _projects.pop(project_id, None) is not None


def forget_old_projects() -> None:
    """Delete projects untouched for RETENTION_SECONDS that no session uses."""
    now = time.time()
    in_use = live.project_ids()
    for pid in [p for p, (_, touched) in _projects.items()
                if p not in in_use and now - touched > RETENTION_SECONDS]:
        _projects.pop(pid, None)
