"""
Stream data model. Field names mirror the original Streamlit create_stream()
payload so existing project JSON keeps loading.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from enum import Enum


class StreamType(str, Enum):
    product = "product"
    steam = "steam"
    air = "air"
    water = "water"


class StreamProperties(BaseModel):
    """Legacy property labels (prop1..prop4)."""
    prop1: str = "Tin"
    prop2: str = "Tout"
    prop3: str = "ṁ"
    prop4: str = "cp"


class StreamValues(BaseModel):
    """Legacy property values (val1..val4)."""
    val1: str = ""
    val2: str = ""
    val3: str = ""
    val4: str = ""


class StreamModel(BaseModel):
    """
    A single energy stream. Matches create_stream() output exactly.
    Both legacy fields (mdot, temp_in, temp_out, cp) and the new
    flexible stream_values dict are kept for backward compatibility.
    """
    name: str = ""
    type: StreamType = StreamType.product
    properties: StreamProperties = Field(default_factory=StreamProperties)
    values: StreamValues = Field(default_factory=StreamValues)
    # New flexible key-value store for all variables
    stream_values: Dict[str, str] = Field(default_factory=dict)
    # Unit each entry in stream_values was entered in, keyed the same way.
    # Declared rather than left to `extra: allow` — the frontend relies on it
    # surviving a project round-trip to convert values correctly.
    stream_units: Dict[str, str] = Field(default_factory=dict)
    # Which variables the user chose to display
    display_vars: Optional[List[str]] = None
    # Legacy scalar fields
    mdot: str = ""
    temp_in: str = ""
    temp_out: str = ""
    cp: str = ""

    model_config = {"extra": "allow"}
