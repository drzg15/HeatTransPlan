"""
Streams router — CRUD for streams on any process node.
"""

from fastapi import APIRouter, HTTPException
from app.models.stream import StreamModel
from app.services import project_service

router = APIRouter()


@router.post("/procs/{project_id}/{proc_idx}/streams")
async def add_stream(project_id: str, proc_idx: int, stream: StreamModel | None = None):
    """Add a stream to a subprocess."""
    project = project_service.get_project(project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
    if proc_idx >= len(project.processes):
        raise HTTPException(404, "Process not found")
    proc = project.processes[proc_idx]
    if stream is None:
        stream = StreamModel(name=f"Stream {len(proc.streams) + 1}")
    proc.streams.append(stream)
    project_service.update_project(project_id, project)
    return {"stream_index": len(proc.streams) - 1, "stream": stream}


@router.put("/streams/{project_id}/{proc_idx}/{stream_idx}")
async def update_stream(project_id: str, proc_idx: int, stream_idx: int, stream: StreamModel):
    """Update a stream."""
    project = project_service.get_project(project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
    if proc_idx >= len(project.processes):
        raise HTTPException(404, "Process not found")
    proc = project.processes[proc_idx]
    if stream_idx >= len(proc.streams):
        raise HTTPException(404, "Stream not found")
    proc.streams[stream_idx] = stream
    project_service.update_project(project_id, project)
    return {"stream_index": stream_idx, "stream": stream}


@router.delete("/streams/{project_id}/{proc_idx}/{stream_idx}")
async def delete_stream(project_id: str, proc_idx: int, stream_idx: int):
    """Delete a stream from a subprocess."""
    project = project_service.get_project(project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
    if proc_idx >= len(project.processes):
        raise HTTPException(404, "Process not found")
    proc = project.processes[proc_idx]
    if stream_idx >= len(proc.streams):
        raise HTTPException(404, "Stream not found")
    proc.streams.pop(stream_idx)
    project_service.update_project(project_id, project)
    return {"deleted": True}


# ---- Streams on children (sub-subprocesses) ----

@router.post("/procs/{project_id}/{proc_idx}/children/{child_idx}/streams")
async def add_child_stream(
    project_id: str, proc_idx: int, child_idx: int, stream: StreamModel | None = None
):
    """Add a stream to a child node."""
    project = project_service.get_project(project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
    if proc_idx >= len(project.processes):
        raise HTTPException(404, "Process not found")
    parent = project.processes[proc_idx]
    if child_idx >= len(parent.children):
        raise HTTPException(404, "Child not found")
    child = parent.children[child_idx]
    if stream is None:
        stream = StreamModel(name=f"Stream {len(child.streams) + 1}")
    child.streams.append(stream)
    project_service.update_project(project_id, project)
    return {"stream_index": len(child.streams) - 1, "stream": stream}
