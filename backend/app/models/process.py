"""
Process node data model. Field names mirror the original Streamlit
create_process_node() payload so existing project JSON keeps loading.
Recursive: a ProcessNode can contain children which are also ProcessNode instances.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field

from app.models.stream import StreamModel


class ExtraInfo(BaseModel):
    """Extended process metadata."""
    air_tin: str = ""
    air_tout: str = ""
    air_mdot: str = ""
    air_cp: str = ""
    water_content_in: str = ""
    water_content_out: str = ""
    density: str = ""
    pressure: str = ""
    notes: str = ""

    model_config = {"extra": "allow"}


class ProcessModelSelection(BaseModel):
    """Category selection from process_models.json."""
    level1: Optional[str] = None
    level2: Optional[str] = None


class ProcessParams(BaseModel):
    """Process parameters for thermal power calculation."""
    tin: str = ""
    tout: str = ""
    time: str = ""
    cp: str = ""
    mass_flow: Optional[Union[str, float, None]] = None
    thermal_power: Optional[Union[str, float, None]] = None


class ProcessNode(BaseModel):
    """
    A node in the process hierarchy. Exactly mirrors create_process_node().

    Level 0 = Process group (green boxes)
    Level 1 = Subprocess (blue boxes)
    Level 2 = Sub-subprocess (purple boxes)
    Level 3+ = deeper levels
    """
    name: str = ""
    level: int = 0
    next: str = ""
    conntemp: str = ""           # Product Tin connection
    product_tout: str = ""       # Product Tout connection
    connm: str = ""              # Product mass flow connection
    conncp: str = ""             # Product cp connection
    streams: List[StreamModel] = Field(default_factory=list)
    children: List[ProcessNode] = Field(default_factory=list)
    lat: Optional[Union[str, float, None]] = None
    lon: Optional[Union[str, float, None]] = None
    box_scale: Optional[Union[str, float]] = 1.0
    extra_info: ExtraInfo = Field(default_factory=ExtraInfo)
    expanded: bool = False
    info_expanded: bool = False
    model: ProcessModelSelection = Field(default_factory=ProcessModelSelection)
    params: ProcessParams = Field(default_factory=ProcessParams)
    params_requested: bool = False
    hours: str = ""

    model_config = {"extra": "allow"}
