"""
Projects router — CRUD for project state.
"""

from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from app.models.project import ProjectState
from app.services import project_service

router = APIRouter()


@router.post("")
async def create_project(state: ProjectState | None = None):
    """Create a new project, optionally initialized with state."""
    project_id, project = project_service.create_project(state)
    return {"project_id": project_id, "state": project}


@router.get("/{project_id}")
async def get_project(project_id: str):
    """Get full project state by ID."""
    project = project_service.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}")
async def update_project(
    project_id: str,
    state: ProjectState,
    x_live_session: Optional[str] = Header(None),
):
    """Replace the entire project state. A page syncing its own edits sends its
    live session id, so the change is not echoed back to it."""
    result = project_service.update_project(project_id, state, origin=x_live_session)
    if result is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return result


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    """Delete a project."""
    if not project_service.delete_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return {"deleted": True}
