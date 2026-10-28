"""Economic analysis request model."""

from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from app.models.analysis import CopFormulaSpec, HPIOptimizationResult, OptimizedIntegrationPoint
from app.models.project import ProjectState


class ProjectAnalysisRequest(BaseModel):
    """Run the Potential Analysis page's chain on a project."""
    state: ProjectState
    # stream_<subprocess>_<stream> -> selected. None: the project's own
    # selection, or every stream when it has none.
    selected_streams: Optional[Dict[str, bool]] = None
    t_min: Optional[float] = Field(None, gt=0)
    profile_mode: Literal["net_load", "composite"] = "net_load"
    recovery_pct: float = Field(100.0, ge=0, le=100)
    cop_model: Literal["2t", "4t"] = "2t"
    cop_formula: Optional[CopFormulaSpec] = None
    # Given: the economic analysis runs too, with these inputs.
    economics_form: Optional[Dict[str, float]] = None
    ref_type: Literal["gas", "oil", "eboiler"] = "gas"
    selected_points: List[OptimizedIntegrationPoint] = Field(default_factory=list)
    lang: str = "en"


class EconomicsRequest(BaseModel):
    """Inputs as the page's input form holds them (prices in ct/kWh, rates and
    shares in %). Keys left out take the defaults (GET /economics/defaults)."""
    form: Dict[str, float] = Field(default_factory=dict)
    ref_type: Literal["gas", "oil", "eboiler"] = "gas"
    # Pumps picked on the optimization chart; empty means its default pump.
    selected_points: List[OptimizedIntegrationPoint] = Field(default_factory=list)
    optimization: Optional[HPIOptimizationResult] = None
    # Centre of the price-sensitivity heatmap, ct/kWh ({"fuel": .., "el": ..});
    # None centres it on the current prices.
    sens_base: Optional[Dict[str, float]] = None

    @field_validator("form")
    @classmethod
    def _positive_efficiency(cls, form: Dict[str, float]) -> Dict[str, float]:
        if "eta" in form and form["eta"] <= 0:
            raise ValueError("eta must be above 0 %")
        return form
