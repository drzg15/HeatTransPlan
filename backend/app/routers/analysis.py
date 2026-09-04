"""
Analysis router — pinch, HPI, status quo, report endpoints.
"""

import math

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from app.models.analysis import (
    PinchRequest, PinchResult,
    HPIRequest, HPIResult,
    StatusQuoRequest, StatusQuoResult,
    HPIOptimizationRequest, HPIOptimizationResult,
    CopFormulaValidateRequest, CopFormulaValidateResult,
)
from app.models.report import ReportRequest
from app.services.analysis_service import run_pinch, run_hpi, run_status_quo
from app.services.optimization_service import run_hpi_optimization
from app.utils.cop_formula import (
    ALLOWED_FUNCS,
    FORMULA_VARIABLES,
    FormulaError,
    cop_from_formula,
)
from app.services.report_service import generate_html_report

router = APIRouter()


@router.post("/pinch", response_model=PinchResult)
async def pinch_analysis(request: PinchRequest):
    """Run pinch analysis on provided streams."""
    return run_pinch(request)


@router.post("/hpi", response_model=HPIResult)
async def heat_pump_integration(request: HPIRequest):
    """Run heat pump integration analysis."""
    return run_hpi(request)


@router.post("/hpi-optimization", response_model=HPIOptimizationResult)
async def heat_pump_integration_optimization(request: HPIOptimizationRequest):
    """Run data-driven heat pump integration optimization."""
    try:
        return run_hpi_optimization(request)
    except FormulaError as exc:
        # A bad formula is the caller's mistake, not a server fault.
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/cop-formula/validate", response_model=CopFormulaValidateResult)
async def validate_cop_formula(request: CopFormulaValidateRequest):
    """Check a user COP formula and evaluate it at one sample point.

    Called as the user types, so it must stay cheap — it never touches the
    optimisation. Always returns 200: an invalid formula is a normal state of
    a field being edited, reported in `error` rather than as an HTTP failure.
    """
    common = {
        "variables": FORMULA_VARIABLES,
        "functions": sorted(ALLOWED_FUNCS),
    }
    try:
        cop = cop_from_formula(request.expression, request.T_source, request.T_sink)
        value = float(cop)
    except FormulaError as exc:
        return CopFormulaValidateResult(valid=False, error=str(exc), **common)

    if not math.isfinite(value):
        return CopFormulaValidateResult(
            valid=False,
            error="The formula is undefined at this operating point.",
            **common,
        )
    return CopFormulaValidateResult(valid=True, cop=value, **common)


@router.post("/status-quo", response_model=StatusQuoResult)
async def status_quo_comparison(request: StatusQuoRequest):
    """Compare current energy demands against pinch minimum."""
    return run_status_quo(request)


@router.post("/report")
async def generate_report(request: ReportRequest):
    """Generate an HTML report and return it as a downloadable file."""
    html = generate_html_report(request)
    return HTMLResponse(
        content=html,
        headers={
            "Content-Disposition": "attachment; filename=heat_integration_report.html"
        },
    )


@router.post("/map-preview")
async def get_map_preview(request: ReportRequest):
    """Generate process map with drawn streams."""
    from app.services.map_service import generate_process_map_b64
    b64 = generate_process_map_b64(request)
    return {"map_b64": b64}
