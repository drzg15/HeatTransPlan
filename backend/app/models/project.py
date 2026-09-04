"""
Project state model — exact mirror of save_app_state() / load_app_state()
in data_collection.py. This is the top-level container.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.models.process import ProcessNode


class GroupCoordinates(BaseModel):
    """Coordinates and metadata for a process group on the map."""
    lat: Optional[Any] = None
    lon: Optional[Any] = None
    box_scale: Optional[Any] = 1.5
    hours: Optional[str] = ""

    model_config = {"extra": "allow"}


class ProjectState(BaseModel):
    """
    Complete project state. Matches save_app_state() output exactly.
    This is what gets serialized to/from JSON files.
    """
    timestamp: Optional[str] = None
    map_locked: bool = False
    map_center: List[float] = [51.707937580921694, 8.772205607882668]
    map_zoom: float = 17.5
    current_base: str = "OpenStreetMap"
    processes: List[ProcessNode] = Field(default_factory=list)
    proc_groups: List[List[int]] = Field(default_factory=list)
    proc_group_names: List[str] = Field(default_factory=list)
    proc_group_expanded: List[bool] = Field(default_factory=list)
    proc_group_coordinates: Dict[str, GroupCoordinates] = Field(default_factory=dict)
    proc_group_info_expanded: List[bool] = Field(default_factory=list)
    # Notes
    project_notes: str = ""
    # Potential Analysis State
    selected_streams: Dict[str, bool] = Field(default_factory=dict)
    energy_demands: List[Dict[str, Any]] = Field(default_factory=list)
    t_min: float = 10.0

    model_config = {"extra": "allow"}
