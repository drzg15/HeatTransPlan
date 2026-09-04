"""
Processes router — CRUD for process groups, subprocesses, and children.
Also includes geocoding proxy.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Union

from app.models.process import ProcessNode
from app.services import project_service
from app.utils.geo_utils import geocode_address

router = APIRouter()


# ---- Process groups ----

class GroupCreate(BaseModel):
    name: str = "New Process"


@router.post("/projects/{project_id}/groups")
async def add_group(project_id: str, body: GroupCreate):
    """Add a new process group."""
    project = project_service.get_project(project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
    group_idx = len(project.proc_group_names)
    project.proc_group_names.append(body.name)
    project.proc_groups.append([])
    project.proc_group_expanded.append(False)
    project.proc_group_info_expanded.append(False)
    project_service.update_project(project_id, project)
    return {"group_index": group_idx, "name": body.name}


@router.put("/projects/{project_id}/groups/{group_idx}")
async def update_group(project_id: str, group_idx: int, body: GroupCreate):
    """Rename a process group."""
    project = project_service.get_project(project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
    if group_idx >= len(project.proc_group_names):
        raise HTTPException(404, "Group not found")
    project.proc_group_names[group_idx] = body.name
    project_service.update_project(project_id, project)
    return {"group_index": group_idx, "name": body.name}


@router.delete("/projects/{project_id}/groups/{group_idx}")
async def delete_group(project_id: str, group_idx: int):
    """Delete a process group and all its subprocesses."""
    project = project_service.get_project(project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
    if group_idx >= len(project.proc_group_names):
        raise HTTPException(404, "Group not found")
    # Remove subprocesses belonging to this group (reverse order to keep indices valid)
    subprocess_indices = sorted(project.proc_groups[group_idx], reverse=True)
    for si in subprocess_indices:
        if si < len(project.processes):
            project.processes.pop(si)
    # Adjust subprocess indices in other groups
    for gi, group in enumerate(project.proc_groups):
        if gi == group_idx:
            continue
        new_group = []
        for si in group:
            offset = sum(1 for removed in subprocess_indices if removed < si)
            new_group.append(si - offset)
        project.proc_groups[gi] = new_group
    # Remove the group itself
    project.proc_group_names.pop(group_idx)
    project.proc_groups.pop(group_idx)
    if group_idx < len(project.proc_group_expanded):
        project.proc_group_expanded.pop(group_idx)
    if group_idx < len(project.proc_group_info_expanded):
        project.proc_group_info_expanded.pop(group_idx)
    # Remove group coordinates
    key = str(group_idx)
    project.proc_group_coordinates.pop(key, None)
    # Re-key remaining coordinates
    new_coords = {}
    for k, v in project.proc_group_coordinates.items():
        ki = int(k)
        if ki > group_idx:
            new_coords[str(ki - 1)] = v
        else:
            new_coords[k] = v
    project.proc_group_coordinates = new_coords
    project_service.update_project(project_id, project)
    return {"deleted": True}


# ---- Subprocesses ----

@router.post("/projects/{project_id}/groups/{group_idx}/procs")
async def add_subprocess(project_id: str, group_idx: int, node: ProcessNode | None = None):
    """Add a subprocess to a process group."""
    project = project_service.get_project(project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
    if group_idx >= len(project.proc_groups):
        raise HTTPException(404, "Group not found")
    if node is None:
        node = ProcessNode(level=1)
    node.level = 1
    new_idx = len(project.processes)
    project.processes.append(node)
    project.proc_groups[group_idx].append(new_idx)
    project_service.update_project(project_id, project)
    return {"process_index": new_idx, "node": node}


@router.put("/procs/{project_id}/{proc_idx}")
async def update_subprocess(project_id: str, proc_idx: int, node: ProcessNode):
    """Update a subprocess."""
    project = project_service.get_project(project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
    if proc_idx >= len(project.processes):
        raise HTTPException(404, "Process not found")
    project.processes[proc_idx] = node
    project_service.update_project(project_id, project)
    return {"process_index": proc_idx, "node": node}


@router.delete("/procs/{project_id}/{proc_idx}")
async def delete_subprocess(project_id: str, proc_idx: int):
    """Delete a subprocess."""
    project = project_service.get_project(project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
    if proc_idx >= len(project.processes):
        raise HTTPException(404, "Process not found")
    project.processes.pop(proc_idx)
    # Update group references
    for gi, group in enumerate(project.proc_groups):
        project.proc_groups[gi] = [
            (si - 1 if si > proc_idx else si) for si in group if si != proc_idx
        ]
    project_service.update_project(project_id, project)
    return {"deleted": True}


# ---- Children (sub-subprocesses) ----

@router.post("/procs/{project_id}/{proc_idx}/children")
async def add_child(project_id: str, proc_idx: int, node: ProcessNode | None = None):
    """Add a child node to a subprocess."""
    project = project_service.get_project(project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
    if proc_idx >= len(project.processes):
        raise HTTPException(404, "Process not found")
    parent = project.processes[proc_idx]
    if node is None:
        child_level = parent.level + 1
        node = ProcessNode(level=child_level, name=f"Sub-subprocess {len(parent.children) + 1}")
    parent.children.append(node)
    project_service.update_project(project_id, project)
    return {"child_index": len(parent.children) - 1, "node": node}


@router.delete("/procs/{project_id}/{proc_idx}/children/{child_idx}")
async def delete_child(project_id: str, proc_idx: int, child_idx: int):
    """Delete a child node from a subprocess."""
    project = project_service.get_project(project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
    if proc_idx >= len(project.processes):
        raise HTTPException(404, "Process not found")
    parent = project.processes[proc_idx]
    if child_idx >= len(parent.children):
        raise HTTPException(404, "Child not found")
    parent.children.pop(child_idx)
    project_service.update_project(project_id, project)
    return {"deleted": True}


# ---- Geocoding ----

class GeoQuery(BaseModel):
    query: str


@router.post("/geo/search")
async def geo_search(body: GeoQuery):
    """Proxy to Nominatim geocoding."""
    try:
        results = geocode_address(body.query)
        return {"results": results}
    except Exception as e:
        raise HTTPException(502, f"Geocoding failed: {e}")
