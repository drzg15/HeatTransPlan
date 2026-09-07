"""
Analysis request/response models for pinch analysis, HPI, and status quo comparison.
"""

from __future__ import annotations
from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field


# How much internal heat recovery is credited before the heat pump is placed.
#   net_load    pocket-free GCC split into source/sink (full recovery, default)
#   composite   hot/cold composite curves, no recovery at all
ProfileMode = Literal["net_load", "composite"]


# ---------------------------------------------------------------------------
# Pinch Analysis
# ---------------------------------------------------------------------------

class PinchStream(BaseModel):
    """A single stream for pinch analysis input."""
    name: str = ""
    CP: float                  # Heat capacity rate (kW/°C)
    T_supply: float            # Supply temperature (°C)
    T_target: float            # Target temperature (°C)


class PinchRequest(BaseModel):
    """Input to the pinch analysis endpoint."""
    streams: List[PinchStream]
    T_min: float               # Minimum temperature difference (°C)


class CompositeDiagramData(BaseModel):
    """H-T data for hot and cold composite curves."""
    hot: Dict[str, List[float]] = Field(default_factory=lambda: {"H": [], "T": []})
    cold: Dict[str, List[float]] = Field(default_factory=lambda: {"H": [], "T": []})


class PinchResult(BaseModel):
    """Full output of pinch analysis."""
    pinch_temperature: float
    hot_utility: float          # Minimum hot utility (kW)
    cold_utility: float         # Minimum cold utility (kW)
    T_min: float
    temperatures: List[float]   # Sorted shifted temperature intervals
    # Problem table
    problem_table: List[Dict[str, float]]
    # Heat cascade
    heat_cascade: List[Dict[str, float]]
    unfeasible_heat_cascade: List[Dict[str, float]]
    # Diagrams (lists of H, T values for plotting)
    shifted_composite_diagram: CompositeDiagramData = Field(default_factory=CompositeDiagramData)
    composite_diagram: CompositeDiagramData = Field(default_factory=CompositeDiagramData)
    grand_composite_curve: Dict[str, List[float]] = Field(default_factory=lambda: {"H": [], "T": []})
    # Stream info for labelling charts
    streams_data: List[Dict[str, Any]] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Heat Pump Integration
# ---------------------------------------------------------------------------

class HeatPumpEntry(BaseModel):
    """Detailed summary of an available heat pump."""
    name: str
    cop: Optional[float] = None
    t_source: Optional[float] = None
    t_sink: Optional[float] = None
    q_source: Optional[float] = None
    q_sink: Optional[float] = None
    coverage: Optional[float] = None
    available: bool = True
    reason: str = ""
    calculation_details: Optional[str] = None

class HPIRequest(BaseModel):
    """Input to the HPI endpoint."""
    pinch_result: PinchResult
    hp_types: List[str] = Field(
        default_factory=lambda: [
            "Prototypical Stirling",
            "VHTHP (HFC/HFO)",
            "SHP and HTHPs (HFC/HFO)",
            "SHP and HTHPs (R717)",
            "Carnot",
        ]
    )
    profile_mode: ProfileMode = "net_load"


class HPIntegrationResult(BaseModel):
    """Result for a single heat pump type."""
    hp_type: str
    COP: Optional[float] = None
    Q_ko: Optional[float] = None      # Condenser heat (kW)
    Q_ev: Optional[float] = None      # Evaporator heat (kW)
    T_source: Optional[float] = None
    T_sink: Optional[float] = None
    delta_T: Optional[float] = None
    feasible: bool = False
    # GCC integration points for charting
    source_points: Dict[str, List[float]] = Field(default_factory=lambda: {"H": [], "T": []})
    sink_points: Dict[str, List[float]] = Field(default_factory=lambda: {"H": [], "T": []})


class HPIResult(BaseModel):
    """Output of HPI analysis — one entry per HP type evaluated."""
    integrations: List[HPIntegrationResult] = Field(default_factory=list)
    heat_pumps: List[HeatPumpEntry] = Field(default_factory=list)
    excluded_heat_pumps: List[HeatPumpEntry] = Field(default_factory=list)
    gcc_data: Dict[str, List[float]] = Field(default_factory=lambda: {"H": [], "T": []})
    profile_mode: ProfileMode = "net_load"
    # Source/sink profiles the integration actually ran on
    source_profile: Dict[str, List[float]] = Field(default_factory=lambda: {"H": [], "T": []})
    sink_profile: Dict[str, List[float]] = Field(default_factory=lambda: {"H": [], "T": []})


# ---------------------------------------------------------------------------
# Status Quo Comparison
# ---------------------------------------------------------------------------

class EnergyDemand(BaseModel):
    """Current energy demand for one stream (user-entered)."""
    stream_name: str = ""
    heating_kW: float = 0.0
    cooling_kW: float = 0.0


class StatusQuoRequest(BaseModel):
    """Input to the status quo comparison endpoint."""
    current_demands: List[EnergyDemand]
    pinch_hot_utility: float
    pinch_cold_utility: float


class StatusQuoResult(BaseModel):
    """Comparison of current vs pinch-optimal demands."""
    total_current_heating: float
    total_current_cooling: float
    pinch_hot_utility: float
    pinch_cold_utility: float
    heating_savings_kW: float
    cooling_savings_kW: float
    heating_savings_pct: float
    cooling_savings_pct: float


# ---------------------------------------------------------------------------
# HPI Optimization
# ---------------------------------------------------------------------------

class OptimizedIntegrationPoint(BaseModel):
    T_source: float
    T_sink: float
    Q_source: float
    # Duty the heat pump actually delivers to the sink. Equal to Q_demand_total
    # when the source can cover it, otherwise limited by the available source
    # heat (source_limited = True).
    Q_demand: float
    COP: float
    refrigerant: str
    medium_sink: str
    refrigerant_type: str
    hp_level: str
    # Full sink requirement above T_sink, i.e. what a source-unlimited heat pump
    # would deliver. Kept next to Q_demand so partial coverage stays visible.
    Q_demand_total: Optional[float] = None
    source_limited: bool = False
    # True when the sink demand runs out before the source heat does: the pump
    # draws less than the waste heat available at T_source, so the point sits
    # off the source profile with the remainder left to cold utility.
    demand_limited: bool = False


class HPIOptimizationDiagnostics(BaseModel):
    """
    Why the optimization found little or nothing.

    Filled on every run, so an empty result set can explain itself instead of
    just being empty.
    """
    source_T_min: Optional[float] = None
    source_T_max: Optional[float] = None
    source_Q_max: Optional[float] = None
    sink_T_min: Optional[float] = None
    sink_T_max: Optional[float] = None
    sink_Q_max: Optional[float] = None
    # Lowest source / sink temperature any refrigerant in the COP model supports
    model_T_source_min: Optional[float] = None
    model_T_sink_min: Optional[float] = None
    # Candidate (refrigerant x sink temperature) combinations by outcome
    candidates_total: int = 0
    rejected_sink_range: int = 0
    rejected_source_range: int = 0
    rejected_no_demand: int = 0
    rejected_no_source_heat: int = 0
    accepted_full: int = 0
    accepted_source_limited: int = 0
    # Full-coverage points that still leave waste heat unused at T_source.
    accepted_demand_limited: int = 0
    # Source-limited points that would have covered a negligible share of the
    # demand and were left out of feasible_points.
    dropped_negligible: int = 0
    messages: List[str] = Field(default_factory=list)

class CopFormulaSpec(BaseModel):
    """A COP correlation typed in by the user instead of read from the model.

    The expression is never executed as written — app.utils.cop_formula parses
    it and whitelists every AST node first. The envelope mirrors the fields each
    entry in cop_ranges.json carries, so a custom pump flows through the
    optimisation loop exactly like a model-backed one.
    """
    name: str = Field(default="Custom formula", max_length=60)
    expression: str = Field(max_length=500)
    enabled: bool = True

    # Validity envelope. Outside it the pump is simply not offered, the same way
    # a model-backed alternative is rejected outside its trained range.
    T_source_min: float = 0.0
    T_source_max: float = 200.0
    T_sink_min: float = 0.0
    T_sink_max: float = 250.0
    cop_min: float = 1.0
    cop_max: float = 20.0

    # Shown in the results table so a custom entry is distinguishable at a glance.
    medium_sink: str = Field(default="Custom", max_length=40)
    hp_level: str = Field(default="1", max_length=10)


class CopFormulaValidateRequest(BaseModel):
    """Check a formula (and preview one value) without running the optimisation."""
    expression: str = Field(max_length=500)
    T_source: float = 60.0
    T_sink: float = 110.0


class CopFormulaValidateResult(BaseModel):
    valid: bool
    cop: Optional[float] = None
    error: Optional[str] = None
    #: Variable name -> human description, so the UI lists what may be used.
    variables: Dict[str, str] = Field(default_factory=dict)
    functions: List[str] = Field(default_factory=list)


class HPIOptimizationRequest(BaseModel):
    """Input to the HPI optimization endpoint."""
    pinch_result: PinchResult
    profile_mode: ProfileMode = "net_load"
    # Optional user-supplied correlation, evaluated alongside the trained model
    # so the two can be compared in the same chart and table.
    cop_formula: Optional[CopFormulaSpec] = None


class HPIOptimizationResult(BaseModel):
    feasible_points: List[OptimizedIntegrationPoint]
    max_q_point: Optional[OptimizedIntegrationPoint] = None
    original_gcc: Dict[str, List[float]] = Field(default_factory=lambda: {"H": [], "T": []})
    # Source/sink profiles the optimization ran on. Named "pocketless_*" for the
    # net_load mode they were introduced for; they hold whichever profiles the
    # selected profile_mode produced.
    pocketless_source: Dict[str, List[float]] = Field(default_factory=lambda: {"H": [], "T": []})
    pocketless_sink: Dict[str, List[float]] = Field(default_factory=lambda: {"H": [], "T": []})
    profile_mode: ProfileMode = "net_load"
    diagnostics: HPIOptimizationDiagnostics = Field(default_factory=HPIOptimizationDiagnostics)
