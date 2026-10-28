"""The Potential Analysis page's chain on a stored project: read the selected
streams, then pinch, heat pump integration, optimization and, if asked, the
economic analysis. What the page computes in the browser, for callers
without one (the MCP server working on project files).

stream_info is the same as frontend/src/utils/streamUtils.ts getStreamInfo;
tests/test_project_analysis.py holds the two to the same answers.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

from app.models.analysis import (
    HPIOptimizationRequest,
    HPIRequest,
    PinchRequest,
    PinchStream,
)
from app.models.project import ProjectState
from app.services.analysis_service import run_hpi, run_pinch
from app.services.economics import DEFAULTS as ECON_DEFAULTS, economics, economics_payload
from app.services.optimization import run_hpi_optimization


def _js_truthy(v: Any) -> bool:
    if v is None or v is False or v == "" or v == 0:
        return False
    return not (isinstance(v, float) and math.isnan(v))


def _to_float(v: Any) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        n = float(v.strip()) if isinstance(v, str) else float(v)
    except (TypeError, ValueError):
        return None
    return n if math.isfinite(n) else None


def _temp(val: Optional[float], unit: Optional[str]) -> Optional[float]:
    if val is None:
        return None
    if unit == "°F":
        return ((val - 32) * 5) / 9
    if unit == "K":
        return val - 273.15
    return val  # default °C


def _mdot(val: Optional[float], unit: Optional[str]) -> Optional[float]:
    if val is None:
        return None
    return {
        "kg/min": lambda v: v / 60,
        "kg/h": lambda v: v / 3600,
        "t/min": lambda v: (v * 1000) / 60,
        "t/h": lambda v: (v * 1000) / 3600,
        "t/d": lambda v: (v * 1000) / (24 * 3600),
    }.get(unit or "", lambda v: v)(val)  # default kg/s


def _cp(val: Optional[float], unit: Optional[str]) -> Optional[float]:
    if val is None:
        return None
    return val / 1000 if unit == "J/(kg·K)" else val  # default kJ/(kg·K)


def _cp_direct(val: Optional[float], unit: Optional[str]) -> Optional[float]:
    if val is None:
        return None
    return val / 1000 if unit == "W/K" else val  # default kW/K


def stream_info(stream: Dict[str, Any]) -> Dict[str, Any]:
    """Inlet/outlet temperature (°C), mass flow (kg/s), cp (kJ/kg·K), CP (kW/K)
    and duty Q (kW) of a stream, whichever way it was entered."""
    sv = stream.get("stream_values") or {}
    properties = stream.get("properties") or {}
    values = stream.get("values") or {}
    units = stream.get("stream_units") or {}

    tin = _temp(_to_float(sv.get("Tin")), units.get("Tin"))
    tout = _temp(_to_float(sv.get("Tout")), units.get("Tout"))
    mdot = _mdot(_to_float(sv.get("ṁ")), units.get("ṁ"))
    cp_val = _cp(_to_float(sv.get("cp")), units.get("cp"))
    cp_direct = _cp_direct(_to_float(sv.get("CP")), units.get("CP"))

    for pk, pname in properties.items():
        v = values.get(pk.replace("prop", "val"), "")
        if pname == "Tin" and _js_truthy(v) and tin is None:
            tin = _temp(_to_float(v), units.get("Tin"))
        elif pname == "Tout" and _js_truthy(v) and tout is None:
            tout = _temp(_to_float(v), units.get("Tout"))
        elif pname == "ṁ" and _js_truthy(v) and mdot is None:
            mdot = _mdot(_to_float(v), units.get("ṁ"))
        elif pname == "cp" and _js_truthy(v) and cp_val is None:
            cp_val = _cp(_to_float(v), units.get("cp"))
        elif pname == "CP" and _js_truthy(v) and cp_direct is None:
            cp_direct = _cp_direct(_to_float(v), units.get("CP"))

    if tin is None and _js_truthy(stream.get("temp_in")):
        tin = _temp(_to_float(stream.get("temp_in")), units.get("Tin"))
    if tout is None and _js_truthy(stream.get("temp_out")):
        tout = _temp(_to_float(stream.get("temp_out")), units.get("Tout"))
    if mdot is None and _js_truthy(stream.get("mdot")):
        mdot = _mdot(_to_float(stream.get("mdot")), units.get("ṁ"))
    if cp_val is None and _js_truthy(stream.get("cp")):
        cp_val = _cp(_to_float(stream.get("cp")), units.get("cp"))

    kind = None
    if tin is not None and tout is not None:
        kind = "Hot stream (Heat Source)" if tin > tout else "Cold stream (Heat sink)"
    CP = cp_direct if cp_direct is not None else (mdot * cp_val if mdot is not None and cp_val is not None else None)
    Q = abs(CP * (tout - tin)) if CP is not None and tin is not None and tout is not None else None
    return {"tin": tin, "tout": tout, "mdot": mdot, "cp": cp_val, "CP": CP, "Q": Q, "type": kind}


def stream_keys(state: ProjectState) -> List[str]:
    return [f"stream_{pi}_{si}" for pi, p in enumerate(state.processes) for si in range(len(p.streams or []))]


def selected_streams(state: ProjectState, selection: Dict[str, bool]) -> List[Dict[str, Any]]:
    """The streams the analysis runs on, named and valued as the page does."""
    out = []
    for key, on in selection.items():
        if not on or not key.startswith("stream_"):
            continue
        parts = key.split("_")
        try:
            pi, si = int(parts[1]), int(parts[2])
        except (IndexError, ValueError):
            continue
        if pi >= len(state.processes):
            continue
        proc = state.processes[pi]
        streams = proc.streams or []
        if si >= len(streams):
            continue
        stream = streams[si].model_dump() if hasattr(streams[si], "model_dump") else streams[si]
        info = stream_info(stream)
        if info["tin"] is None or info["tout"] is None or info["CP"] is None:
            continue
        out.append({
            "key": key,
            "name": f"{proc.name or f'Subprocess {pi + 1}'} - {stream.get('name') or f'Stream {si + 1}'}",
            "CP": info["CP"],
            "Tin": info["tin"],
            "Tout": info["tout"],
            "Q": info["Q"] if info["Q"] is not None else 0,
            "type": "Hot" if info["tin"] > info["tout"] else "Cold",
        })
    return out


def analyse_project(
    state: ProjectState,
    selection: Optional[Dict[str, bool]] = None,
    t_min: Optional[float] = None,
    profile_mode: str = "net_load",
    recovery_pct: float = 100.0,
    cop_model: str = "4t",
    cop_formula: Any = None,
    economics_form: Optional[Dict[str, float]] = None,
    ref_type: str = "gas",
    selected_points: Optional[List[Any]] = None,
    lang: str = "en",
) -> Dict[str, Any]:
    """The whole chain. No selection anywhere means every stream."""
    sel = selection or state.selected_streams or {k: True for k in stream_keys(state)}
    streams = selected_streams(state, sel)
    t_min = state.t_min if t_min is None else t_min
    out: Dict[str, Any] = {"selection": sel, "streams": streams, "t_min": t_min}
    if len(streams) < 2:
        out["message"] = "At least two streams with inlet, outlet temperature and CP are needed."
        return out
    pinch = run_pinch(PinchRequest(
        streams=[PinchStream(name=s["name"], CP=s["CP"], T_supply=s["Tin"], T_target=s["Tout"]) for s in streams],
        T_min=t_min,
    ))
    out["pinch"] = pinch
    out["hpi"] = run_hpi(HPIRequest(pinch_result=pinch, profile_mode=profile_mode))
    opt = run_hpi_optimization(HPIOptimizationRequest(
        pinch_result=pinch, profile_mode=profile_mode, recovery_pct=recovery_pct,
        cop_model=cop_model, cop_formula=cop_formula, lang=lang,
    ))
    out["optimization"] = opt
    if economics_form is not None:
        out["economics"] = economics_payload(
            economics({**ECON_DEFAULTS, **economics_form}, ref_type, selected_points or [], opt)
        )
    return out
