"""
Report request/response models.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.models.analysis import PinchResult, HeatPumpEntry, HPIOptimizationResult


class ReportStream(BaseModel):
    """Stream data for report generation."""
    name: str = ""
    Tin: float = 0.0
    Tout: float = 0.0
    CP: float = 0.0
    Q: float = 0.0
    type: str = ""


class ReportEnergyDemand(BaseModel):
    """Current energy demand entry."""
    heat_demand: float = 0.0
    cooling_demand: float = 0.0


class ReportProcess(BaseModel):
    """Subprocess data for the data-collection table."""
    name: str = ""
    streams: List[Dict[str, Any]] = Field(default_factory=list)


class ScenarioReportData(BaseModel):
    """Data for a single scenario in the report."""
    name: str
    selected_streams: List[ReportStream] = Field(default_factory=list)
    pinch_result: Optional[PinchResult] = None
    heat_pumps: List[HeatPumpEntry] = Field(default_factory=list)
    hpi_optimization_result: Optional[HPIOptimizationResult] = None
    energy_demands: List[ReportEnergyDemand] = Field(default_factory=list)
    t_min: float = 10.0


class ReportRequest(BaseModel):
    """Input for report generation."""
    language: str = "en"
    # Project metadata
    project_notes: str = ""
    pinch_notes: str = ""
    map_snapshots_encoded: Dict[str, str] = Field(default_factory=dict)
    map_center: List[float] = Field(default_factory=list)
    map_zoom: float = 17.5
    current_base: str = "OpenStreetMap"

    # Process data for the data table
    processes: List[ReportProcess] = Field(default_factory=list)
    proc_groups: List[List[int]] = Field(default_factory=list)
    proc_group_names: List[str] = Field(default_factory=list)
    proc_group_coordinates: Dict[str, Any] = Field(default_factory=dict)

    # Analysis data
    selected_streams: List[ReportStream] = Field(default_factory=list)
    pinch_result: Optional[PinchResult] = None
    heat_pumps: List[HeatPumpEntry] = Field(default_factory=list)
    hpi_optimization_result: Optional[HPIOptimizationResult] = None
    energy_demands: List[ReportEnergyDemand] = Field(default_factory=list)
    t_min: float = 10.0

    # Scenarios for comparison
    scenarios: List[ScenarioReportData] = Field(default_factory=list)
