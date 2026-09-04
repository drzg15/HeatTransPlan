"""
Project store. Each project gets a UUID.

Backed by one JSON file per project on disk rather than a process-local dict.
The server runs uvicorn with one worker per CPU, and workers do not share
memory: with an in-memory dict a client that created a project on worker 1 got
a 404 as soon as the next request landed on worker 2. The heavy endpoints
(pinch, HPI, optimization) are stateless — they take everything they need in
the request body — so the workers stay useful and only this small amount of
CRUD state has to be shared.

Set HEATTRANSPLAN_STATE_DIR to control where the files live.
"""

from __future__ import annotations
import json
import os
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

from app.models.project import ProjectState


STATE_DIR = Path(
    os.getenv("HEATTRANSPLAN_STATE_DIR", Path(tempfile.gettempdir()) / "heattransplan_projects")
)


def _ensure_dir() -> Path:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    return STATE_DIR


def _path_for(project_id: str) -> Path:
    # uuid4() only ever produces hex and dashes; reject anything else so a
    # crafted id cannot walk out of the state directory.
    if not project_id or not all(c.isalnum() or c == "-" for c in project_id):
        raise ValueError(f"Invalid project id: {project_id!r}")
    return _ensure_dir() / f"{project_id}.json"


def _write(project_id: str, state: ProjectState) -> None:
    """Serialize atomically so a concurrent reader never sees a half-written file."""
    path = _path_for(project_id)
    fd, tmp_name = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(state.model_dump(), fh)
        os.replace(tmp_name, path)
    except BaseException:
        # os.replace() consumes the temp file on success; only clean up on failure.
        if os.path.exists(tmp_name):
            os.unlink(tmp_name)
        raise


def create_project(state: Optional[ProjectState] = None) -> tuple[str, ProjectState]:
    """Create a new project, optionally initialized from an existing state."""
    project_id = str(uuid.uuid4())
    if state is None:
        state = ProjectState()
    state.timestamp = datetime.now().isoformat()
    _write(project_id, state)
    return project_id, state


def get_project(project_id: str) -> Optional[ProjectState]:
    """Retrieve a project by ID."""
    try:
        path = _path_for(project_id)
    except ValueError:
        return None
    if not path.exists():
        return None
    try:
        with path.open(encoding="utf-8") as fh:
            return ProjectState(**json.load(fh))
    except (OSError, json.JSONDecodeError, ValueError):
        return None


def update_project(project_id: str, state: ProjectState) -> Optional[ProjectState]:
    """Replace the full project state."""
    try:
        if not _path_for(project_id).exists():
            return None
    except ValueError:
        return None
    state.timestamp = datetime.now().isoformat()
    _write(project_id, state)
    return state


def delete_project(project_id: str) -> bool:
    """Delete a project."""
    try:
        path = _path_for(project_id)
    except ValueError:
        return False
    if not path.exists():
        return False
    path.unlink()
    return True


def list_projects() -> Dict[str, str]:
    """Return dict of project_id → timestamp for all projects."""
    projects: Dict[str, str] = {}
    for path in _ensure_dir().glob("*.json"):
        state = get_project(path.stem)
        if state is not None:
            projects[path.stem] = state.timestamp or ""
    return projects
