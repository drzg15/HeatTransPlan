"""HeatTransPlan as MCP tools: everything the app's pages do, for an AI.

Two ways of working, freely mixed:

- Projects (files): create or load a project on the backend, edit it, run the
  analysis, save it to a file. Nothing has to be open in a browser.
- Live: the user clicks "Connect AI" on the page and gives you the session
  code. You then see what the page shows and drive it: navigate, select
  streams, move sliders, pick heat pumps, set economics inputs, save
  scenarios, make the report, load a site plan. The session's project_id
  works with every project tool too, and edits appear on the page at once.

Set HEATTRANSPLAN_URL (default http://localhost:8000) and, if the server
requires one, HEATTRANSPLAN_API_KEY.
"""

from __future__ import annotations

import base64
import json
import logging
import mimetypes
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from mcp.server.mcpserver import MCPServer

from heattransplan_mcp import project_edit as edit
from heattransplan_mcp.api import Api, ApiError

INSTRUCTIONS = __doc__

mcp = MCPServer(name="heattransplan", instructions=INSTRUCTIONS, version="3.0.0")
api = Api()

# Last analysis per project, so follow-up tools need not resend large results.
_analysis: Dict[str, Dict[str, Any]] = {}
# COP models trained with train_cop_model, by name.
_models: Dict[str, Dict[str, Any]] = {}


def set_api(new: Api) -> None:
    """Point the tools at another backend (tests)."""
    global api
    api = new
    _analysis.clear()
    _models.clear()


async def _load(project_id: str) -> Dict[str, Any]:
    return await api.get(f"/api/projects/{project_id}")


async def _save(project_id: str, state: Dict[str, Any]) -> Dict[str, Any]:
    _analysis.pop(project_id, None)
    return await api.put(f"/api/projects/{project_id}", json=state)


async def _edit(project_id: str, change) -> Dict[str, Any]:
    """Load, change, save; returns the change's result and the new overview."""
    state = await _load(project_id)
    try:
        result = change(state)
    except edit.EditError as exc:
        raise ApiError(str(exc)) from exc
    saved = await _save(project_id, state)
    return {"result": result, "project": edit.overview(saved)}


# ── Projects ────────────────────────────────────────────────────────────────


@mcp.tool()
async def list_examples() -> List[str]:
    """Example projects that ship with HeatTransPlan."""
    return (await api.get("/api/assets/examples"))["examples"]


@mcp.tool()
async def create_project(example: Optional[str] = None, file_path: Optional[str] = None) -> Dict[str, Any]:
    """Create a project on the backend: empty, from an example (see
    list_examples) or from a saved project JSON file. Returns its project_id
    and an overview."""
    if example and file_path:
        raise ApiError("Give either example or file_path, not both.")
    state = None
    if example:
        state = await api.get(f"/api/assets/examples/{example}")
    elif file_path:
        state = json.loads(Path(file_path).expanduser().read_text(encoding="utf-8"))
    created = await api.post("/api/projects", json=state)
    return {"project_id": created["project_id"], "project": edit.overview(created["state"])}


@mcp.tool()
async def list_projects() -> Dict[str, str]:
    """Projects on the backend: project_id → last change."""
    return await api.get("/api/projects")


@mcp.tool()
async def get_project(project_id: str, full: bool = False) -> Dict[str, Any]:
    """A project as an overview (processes, subprocesses, streams with their
    keys and values) or, with full=True, its complete JSON."""
    state = await _load(project_id)
    return state if full else edit.overview(state)


@mcp.tool()
async def save_project_file(project_id: str, file_path: str) -> str:
    """Save a project as JSON, the same file the page's Save button writes."""
    state = await _load(project_id)
    path = Path(file_path).expanduser()
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    return f"Saved to {path}"


@mcp.tool()
async def replace_project(project_id: str, state: Dict[str, Any]) -> Dict[str, Any]:
    """Replace a project's whole JSON (as loading a file on the page)."""
    return edit.overview(await _save(project_id, state))


@mcp.tool()
async def delete_project(project_id: str) -> str:
    """Delete a project from the backend."""
    await api.delete(f"/api/projects/{project_id}")
    _analysis.pop(project_id, None)
    return "Deleted"


@mcp.tool()
async def add_process(project_id: str, name: Optional[str] = None, lat: Optional[float] = None,
                      lon: Optional[float] = None) -> Dict[str, Any]:
    """Add a process (a box on the map) with one empty subprocess, as the
    "Add process" button. Returns the new process index."""
    return await _edit(project_id, lambda s: {"process": edit.add_process(s, name, lat, lon)})


@mcp.tool()
async def update_process(project_id: str, process: int, name: Optional[str] = None,
                         lat: Optional[float] = None, lon: Optional[float] = None,
                         hours: Optional[str] = None, box_scale: Optional[float] = None) -> Dict[str, Any]:
    """Rename a process or set its position (lat/lon), operating hours or box size."""
    return await _edit(project_id, lambda s: edit.update_process(
        s, process, name, lat=lat, lon=lon, hours=hours, box_scale=box_scale))


@mcp.tool()
async def delete_process(project_id: str, process: int) -> Dict[str, Any]:
    """Delete a process and its subprocesses; later indices and the stream
    selection move up, as on the page."""
    return await _edit(project_id, lambda s: edit.delete_process(s, process))


@mcp.tool()
async def add_subprocess(project_id: str, process: int, name: Optional[str] = None) -> Dict[str, Any]:
    """Add a subprocess (where streams live) to a process. Returns its index."""
    return await _edit(project_id, lambda s: {"subprocess": edit.add_subprocess(s, process, name)})


@mcp.tool()
async def update_subprocess(project_id: str, subprocess: int, name: Optional[str] = None,
                            lat: Optional[float] = None, lon: Optional[float] = None,
                            hours: Optional[str] = None, next: Optional[str] = None,
                            notes: Optional[str] = None) -> Dict[str, Any]:
    """Set a subprocess's name, position, operating hours, following
    subprocess(es) (comma separated names) or notes."""
    return await _edit(project_id, lambda s: edit.update_subprocess(
        s, subprocess, name=name, lat=lat, lon=lon, hours=hours, next=next, notes=notes))


@mcp.tool()
async def delete_subprocess(project_id: str, subprocess: int) -> Dict[str, Any]:
    """Delete a subprocess (the last one takes its process along), as on the page."""
    return await _edit(project_id, lambda s: edit.delete_subprocess(s, subprocess))


@mcp.tool()
async def add_stream(project_id: str, subprocess: int, name: str,
                     t_in: Optional[float] = None, t_out: Optional[float] = None,
                     mass_flow: Optional[float] = None, cp: Optional[float] = None,
                     CP: Optional[float] = None, units: Optional[Dict[str, str]] = None,
                     stream_type: Literal["product", "steam", "air", "water"] = "product") -> Dict[str, Any]:
    """Add a stream to a subprocess: inlet and outlet temperature plus either
    mass flow and specific heat (cp) or the heat capacity rate CP directly.
    Defaults: °C, kg/s, kJ/(kg·K), kW/K. Other units by variable, e.g.
    {"Tin": "K", "Tout": "K", "ṁ": "t/h", "cp": "J/(kg·K)", "CP": "W/K"}.
    A stream is hot (a heat source) when t_in > t_out."""
    values = {"Tin": t_in, "Tout": t_out, "ṁ": mass_flow, "cp": cp, "CP": CP}
    return await _edit(project_id, lambda s: {
        "stream": edit.add_stream(s, subprocess, edit.make_stream(name, values, units, stream_type))})


@mcp.tool()
async def update_stream(project_id: str, subprocess: int, stream: int, name: Optional[str] = None,
                        t_in: Optional[float] = None, t_out: Optional[float] = None,
                        mass_flow: Optional[float] = None, cp: Optional[float] = None,
                        CP: Optional[float] = None, units: Optional[Dict[str, str]] = None,
                        stream_type: Optional[Literal["product", "steam", "air", "water"]] = None) -> Dict[str, Any]:
    """Change a stream; only the values given change."""
    values = {k: v for k, v in {"Tin": t_in, "Tout": t_out, "ṁ": mass_flow, "cp": cp, "CP": CP}.items() if v is not None}
    return await _edit(project_id, lambda s: edit.update_stream(s, subprocess, stream, name, values, units, stream_type))


@mcp.tool()
async def delete_stream(project_id: str, subprocess: int, stream: int) -> Dict[str, Any]:
    """Delete a stream; later streams of the subprocess move up, selection too."""
    return await _edit(project_id, lambda s: edit.delete_stream(s, subprocess, stream))


@mcp.tool()
async def set_notes(project_id: str, project_notes: Optional[str] = None,
                    pinch_notes: Optional[str] = None) -> Dict[str, Any]:
    """Set the data collection notes and/or the analysis notes."""
    def change(s):
        if project_notes is not None:
            s["project_notes"] = project_notes
        if pinch_notes is not None:
            s["pinch_notes"] = pinch_notes
    return await _edit(project_id, change)


@mcp.tool()
async def set_map(project_id: str, center: Optional[List[float]] = None, zoom: Optional[float] = None,
                  base: Optional[Literal["OpenStreetMap", "Satellite"]] = None,
                  locked: Optional[bool] = None) -> Dict[str, Any]:
    """Set the map's centre [lat, lon], zoom, base layer or lock."""
    def change(s):
        if center is not None:
            s["map_center"] = center
        if zoom is not None:
            s["map_zoom"] = zoom
        if base is not None:
            s["current_base"] = base
        if locked is not None:
            s["map_locked"] = locked
    return await _edit(project_id, change)


@mcp.tool()
async def set_site_plan(project_id: str, image_path: Optional[str] = None,
                        bounds: Optional[List[List[float]]] = None, subprocess_key: Optional[str] = None,
                        remove: bool = False) -> Dict[str, Any]:
    """Put the user's own site plan (PNG or JPG) on the map in place of the
    map tiles, with bounds [[south, west], [north, east]] in map coordinates;
    or, with subprocess_key ("g<process>" or "s<subprocess>"), as the
    background of that diagram. remove=True takes it away. PDFs and placing
    the plan in the current view need the open page: live_load_site_plan."""
    def change(s):
        if remove:
            if subprocess_key:
                (s.get("canvas_plans") or {}).pop(subprocess_key, None)
            else:
                s["site_plan"] = None
            return
        if not image_path:
            raise edit.EditError("image_path is needed")
        path = Path(image_path).expanduser()
        mime = mimetypes.guess_type(path.name)[0] or ""
        if mime not in ("image/png", "image/jpeg"):
            raise edit.EditError("Only PNG and JPG here; for PDF use live_load_site_plan.")
        url = f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"
        if subprocess_key:
            s["canvas_plans"] = {**(s.get("canvas_plans") or {}), subprocess_key: url}
        else:
            if not bounds:
                raise edit.EditError("bounds [[south, west], [north, east]] are needed for the site plan")
            s["site_plan"] = {"url": url, "bounds": bounds}
    return await _edit(project_id, change)


@mcp.tool()
async def export_csv(project_id: str, file_path: str) -> str:
    """Write the project's streams as CSV (the backend's export)."""
    text = await api.get(f"/api/io/export-csv/{project_id}")
    path = Path(file_path).expanduser()
    path.write_text(text, encoding="utf-8")
    return f"Saved to {path}"


@mcp.tool()
async def import_csv(project_id: str, file_path: str) -> Dict[str, Any]:
    """Load streams from a CSV file into the project (the backend's import)."""
    path = Path(file_path).expanduser()
    await api.request("POST", f"/api/io/import-csv/{project_id}",
                      files={"file": (path.name, path.read_bytes(), "text/csv")})
    _analysis.pop(project_id, None)
    return edit.overview(await _load(project_id))


# ── Analysis on a project ───────────────────────────────────────────────────


def _pump(p: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "refrigerant": p["refrigerant"],
        "kind": "theoretical" if p.get("theoretical") else "real",
        "type": p.get("refrigerant_type"),
        "medium_sink": p.get("medium_sink"),
        "stages": p.get("hp_level"),
        "COP": round(p["COP"], 3),
        "T_source": round(p["T_source"], 2),
        "T_sink": round(p["T_sink"], 2),
        "Q_sink_kW": round(p["Q_demand"], 2),
        "Q_source_kW": round(p["Q_source"], 2),
        "P_el_kW": round(p["Q_demand"] / p["COP"], 2) if p["COP"] else None,
        "source_limited": p.get("source_limited", False),
        "demand_limited": p.get("demand_limited", False),
    }


def _summary(out: Dict[str, Any]) -> Dict[str, Any]:
    s: Dict[str, Any] = {"streams": out["streams"], "t_min": out["t_min"]}
    if "message" in out:
        s["message"] = out["message"]
        return s
    p = out["pinch"]
    hot = sum(x["Q"] for x in out["streams"] if x["type"] == "Hot")
    s["pinch"] = {
        "pinch_temperature": p["pinch_temperature"],
        "min_heating_kW": p["hot_utility"],
        "min_cooling_kW": p["cold_utility"],
        "heat_recovery_kW": hot - p["cold_utility"],
    }
    s["heat_pump_types"] = [
        {k: h.get(k) for k in ("name", "available", "cop", "t_source", "t_sink", "q_sink", "reason")}
        for h in out["hpi"]["heat_pumps"] + out["hpi"]["excluded_heat_pumps"]
    ]
    opt = out["optimization"]
    s["optimization"] = {
        "feasible_points": len(opt["feasible_points"]),
        "best": _pump(opt["max_q_point"]) if opt.get("max_q_point") else None,
        "messages": opt["diagnostics"]["messages"],
    }
    if out.get("economics"):
        s["economics"] = _econ_summary(out["economics"])
    return s


def _econ_summary(e: Dict[str, Any]) -> Dict[str, Any]:
    r = e["results"][0]
    return {
        "pump": _pump(e["pump"]),
        "investment_eur": e["variants"][0]["capex"],
        "specific_investment_eur_per_kW": e["specTotal"],
        "npv_eur": r["npv"],
        "payback_years": r["payback"],
        "static_payback_years": r["paybackStatic"],
        "irr": r["irr"],
        "saving_year1_eur": r["saving1"],
        "co2_saving_t_per_year": r["co2Saving"],
        "energy_saving_kWh_per_year": r["energySaving"],
        "lcoh_heat_pump_eur_per_kWh": r["lcohHp"],
        "lcoh_reference_eur_per_kWh": r["lcohRef"],
        "break_even_el_price_eur_per_kWh": e["breakEven"][0],
        "economic_optimum": e["size"]["optimum"] and {
            "pump": _pump(e["size"]["optimum"]["point"]), "npv_eur": e["size"]["optimum"]["npv"]},
        "reference": e["refSys"],
    }


@mcp.tool()
async def analyse_project(project_id: str, selected_streams: Optional[List[str]] = None,
                          t_min: Optional[float] = None,
                          profile_mode: Literal["net_load", "composite"] = "net_load",
                          heat_recovery_pct: float = 100, cop_model: Literal["2t", "4t"] = "4t",
                          cop_formula: Optional[Dict[str, Any]] = None,
                          economics_inputs: Optional[Dict[str, float]] = None,
                          reference_heater: Literal["gas", "oil", "eboiler"] = "gas",
                          custom_model: Optional[str] = None) -> Dict[str, Any]:
    """Run the Potential Analysis on a project: pinch, heat pump integration,
    heat pump optimization and the economic analysis of the best pump.

    selected_streams: stream keys (stream_<subprocess>_<stream>, see
    get_project); default the project's selection, or all streams.
    heat_recovery_pct: share of the possible heat recovery already in place
    (0–100, net_load only). cop_model "4t" (standard) scores pumps with all
    four temperatures, "2t" with source return and sink supply only. cop_formula: {"name", "expression", ...} adds a custom COP
    correlation (check it first with validate_cop_formula). custom_model: the
    name of a model from train_cop_model, offered next to the shipped one.
    economics_inputs:
    see economics_defaults. Results are kept for list_heat_pumps,
    economic_analysis and generate_report."""
    state = await _load(project_id)
    sel = {k: True for k in selected_streams} if selected_streams is not None else None
    out = await api.post("/api/analysis/project", json={
        "state": state, "selected_streams": sel, "t_min": t_min, "profile_mode": profile_mode,
        "recovery_pct": heat_recovery_pct, "cop_model": cop_model, "cop_formula": cop_formula,
        "custom_cop_model": _model(custom_model) if custom_model else None,
        "economics_form": economics_inputs or {}, "ref_type": reference_heater,
    })
    _analysis[project_id] = {**out, "economics_inputs": economics_inputs or {}, "reference_heater": reference_heater,
                             "selected_points": []}
    return _summary(out)


def _model(name: str) -> Dict[str, Any]:
    if name not in _models:
        raise ApiError(f"No trained model '{name}'; train one with train_cop_model ({', '.join(_models) or 'none yet'}).")
    return _models[name]


@mcp.tool()
async def train_cop_model(file_path: str, mapping: Dict[str, str], name: str = "My COP model",
                          model_type: Literal["nn", "poly", "linear"] = "nn",
                          degree: Literal[2, 3] = 2, sheet: Optional[str] = None,
                          valid_range: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
    """Train a COP model on heat pump data, as the page's "Train from my
    data": a neural network ("nn", most accurate), a polynomial ("poly",
    degree 2 or 3) or a linear regression ("linear"); the regressions return
    their formula. file_path: CSV, Excel (sheet: which one; default the
    first with a COP column) or Parquet, one operating point per row. mapping: role → column name. Required: T_source_out
    (source outlet / return), T_sink_out (sink outlet / supply), COP.
    Optional: T_source_in and T_sink_in (both or neither: four-temperature
    model), medium, refrigerant, stages (number of compressors). Up to 10,000
    rows are used; 20 % are held back for the test metrics. The model is
    offered over the data's range with the sink capped at 180 °C; valid_range
    ({"T_source_min", "T_source_max", "T_sink_min", "T_sink_max"}) sets it. Use the model by
    name in analyse_project(custom_model=...) or live_use_cop_model.
    Only available when the server runs the COP training module."""
    path = Path(file_path).expanduser()
    out = await api.request("POST", "/api/analysis/cop-model/train",
                            files={"file": (path.name, path.read_bytes())},
                            data={"mapping": json.dumps(mapping), "name": name,
                                  "model_type": model_type, "degree": str(degree),
                                  **({"sheet": sheet} if sheet else {})})
    spec = out["spec"]
    if valid_range:
        spec["envelope"] = {**spec["envelope"], **valid_range}
    _models[spec["name"]] = spec
    return {
        "name": spec["name"], "type": spec["kind"], "formula": spec.get("formula") or None,
        "test_metrics": spec["metrics"], "rows_used": out["rows_used"],
        "rows_dropped": out["rows_dropped"], "sampled_from": out["sampled_from"],
        "inputs": spec["temps"] + spec["cats"], "heat_pumps_added": len(spec["combos"]),
        "valid_range": spec["envelope"],
    }


def _cached(project_id: str) -> Dict[str, Any]:
    if project_id not in _analysis or "optimization" not in _analysis[project_id]:
        raise ApiError("Run analyse_project on this project first.")
    return _analysis[project_id]


@mcp.tool()
async def list_heat_pumps(project_id: str, real_only: bool = False, refrigerant: Optional[str] = None,
                          min_T_sink: Optional[float] = None, limit: int = 15,
                          include_limited: bool = False) -> List[Dict[str, Any]]:
    """The heat pumps the optimization found for the last analysis, best duty
    first (COP breaks ties). Source- and demand-limited points (off the
    profiles, hidden on the page by default) only with include_limited."""
    pts = _cached(project_id)["optimization"]["feasible_points"]
    pts = [p for p in pts if (include_limited or not (p.get("source_limited") or p.get("demand_limited")))
           and (not real_only or not p.get("theoretical"))
           and (refrigerant is None or p["refrigerant"].startswith(refrigerant))
           and (min_T_sink is None or p["T_sink"] >= min_T_sink)]
    pts.sort(key=lambda p: (-p["Q_demand"], -p["COP"]))
    return [_pump(p) for p in pts[:limit]]


@mcp.tool()
async def economics_defaults() -> Dict[str, Any]:
    """The economic analysis inputs with their defaults (prices in ct/kWh,
    rates and shares in %), and the reference-heater presets."""
    return await api.get("/api/analysis/economics/defaults")


@mcp.tool()
async def economic_analysis(project_id: str, inputs: Optional[Dict[str, float]] = None,
                            reference_heater: Optional[Literal["gas", "oil", "eboiler"]] = None,
                            pumps: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """Economic analysis (VDI 4646 / VDI 2067) of a pump from the last
    analysis against the reference heater. pumps: [{"refrigerant", "T_sink"}]
    to pick (the best of them is analysed); default the optimization's best.
    Inputs not given keep their last value."""
    cache = _cached(project_id)
    opt = cache["optimization"]
    if inputs:
        cache["economics_inputs"] = {**cache["economics_inputs"], **inputs}
    if reference_heater:
        cache["reference_heater"] = reference_heater
    if pumps is not None:
        chosen = []
        for spec in pumps:
            hit = [p for p in opt["feasible_points"] if p["refrigerant"] == spec["refrigerant"]
                   and ("T_sink" not in spec or abs(p["T_sink"] - spec["T_sink"]) < 0.05)]
            if not hit:
                raise ApiError(f"No pump {spec} in the results; see list_heat_pumps.")
            chosen.append(hit[0])
        cache["selected_points"] = chosen
    e = await api.post("/api/analysis/economics", json={
        "form": cache["economics_inputs"], "ref_type": cache["reference_heater"],
        "selected_points": cache["selected_points"], "optimization": opt,
    })
    cache["economics"] = e
    return _econ_summary(e) if e else {"message": "No heat pump to analyse."}


@mcp.tool()
async def validate_cop_formula(expression: str, T_source: float = 60, T_sink: float = 110) -> Dict[str, Any]:
    """Check a custom COP formula and evaluate it at one point. Variables and
    functions it may use are listed in the answer."""
    return await api.post("/api/analysis/cop-formula/validate",
                          json={"expression": expression, "T_source": T_source, "T_sink": T_sink})


@mcp.tool()
async def generate_report(project_id: str, file_path: str, language: Literal["en", "de"] = "en") -> str:
    """Write the HTML report of the last analysis (data collection, maps,
    pinch, heat pumps). The page's report also carries the economic charts:
    for that, use live_generate_report on a connected page."""
    cache = _cached(project_id)
    state = await _load(project_id)
    streams = [{k: s[k] for k in ("name", "Tin", "Tout", "CP", "Q", "type")} for s in cache["streams"]]
    scenario = {
        "name": "All streams", "selected_streams": streams, "pinch_result": cache["pinch"],
        "heat_pumps": cache["hpi"]["heat_pumps"], "hpi_optimization_result": cache["optimization"],
        "selected_hp_points": cache["selected_points"], "energy_demands": [], "t_min": cache["t_min"],
    }
    html = await api.post("/api/analysis/report", json={
        "language": language, "project_notes": state.get("project_notes", ""),
        "pinch_notes": state.get("pinch_notes", ""), "map_snapshots_encoded": state.get("map_snapshots_encoded") or {},
        "map_center": state.get("map_center") or [], "map_zoom": state.get("map_zoom", 17.5),
        "current_base": state.get("current_base", "OpenStreetMap"),
        "processes": [{"name": p.get("name", ""), "streams": p.get("streams", [])} for p in state.get("processes", [])],
        "proc_groups": state.get("proc_groups", []), "proc_group_names": state.get("proc_group_names", []),
        "proc_group_coordinates": state.get("proc_group_coordinates", {}),
        "selected_streams": streams, "pinch_result": cache["pinch"], "heat_pumps": cache["hpi"]["heat_pumps"],
        "hpi_optimization_result": cache["optimization"], "energy_demands": [], "t_min": cache["t_min"],
        "scenarios": [scenario],
    })
    path = Path(file_path).expanduser()
    path.write_text(html, encoding="utf-8")
    return f"Saved to {path}"


# ── Live: the open page ─────────────────────────────────────────────────────


async def _live(session_id: str, name: str, args: Optional[Dict[str, Any]] = None, timeout: float = 60) -> Any:
    out = await api.post(f"/api/live/sessions/{session_id}/commands",
                         json={"name": name, "args": args or {}, "timeout": timeout})
    return out["result"]


@mcp.tool()
async def live_sessions() -> List[Dict[str, Any]]:
    """Pages connected for AI control (the user clicks "Connect AI"; the code
    shown there is the session_id). Each has a project_id for the project tools."""
    return await api.get("/api/live/sessions")


@mcp.tool()
async def live_view(session_id: str) -> Dict[str, Any]:
    """What the page shows right now: page, project tree, every analysis
    input, key results, economics inputs and scenarios."""
    return await _live(session_id, "get_view")


@mcp.tool()
async def live_results(session_id: str) -> Dict[str, Any]:
    """The page's full current results (pinch, heat pump integration,
    optimization, status quo). Large."""
    return await _live(session_id, "get_results")


@mcp.tool()
async def live_command(session_id: str, command: str, args: Optional[Dict[str, Any]] = None,
                       timeout: float = 60) -> Any:
    """Run any page command; "list_commands" lists those available now (some
    exist only while their page is open). Commands: navigate {page: home |
    data-collection | potential-analysis}, set_language {lang}, set_theme
    {theme}, select_streams {all|none|keys[]|process, value}, set_t_min
    {value}, set_show_shifted {value}, set_recovery_pct {value},
    set_profile_mode {mode}, set_energy_demands {demands}, reset_pinch,
    set_cop_model {model}, set_cop_formula {formula}, set_custom_cop_model
    {model, enabled}, set_hp_types {types},
    select_heat_pumps {points: [{refrigerant, T_sink}], add, clear},
    reset_heat_pumps, set_economics {form, ref_type}, reset_economics,
    save_scenario {name}, load_scenario {index}, rename_scenario {index, name},
    delete_scenario {index}, set_project_notes {notes}, set_pinch_notes
    {notes}, set_map_view {center, zoom, base, locked}, set_site_plan_bounds
    {bounds}, remove_site_plan, remove_subprocess_plan {key}, export_csv,
    export_distances_csv {metric}, get_project, set_project {state},
    generate_report, load_site_plan {data, filename, mime, subprocess},
    wait_idle {timeout}, get_view, get_results."""
    return await _live(session_id, command, args, timeout)


@mcp.tool()
async def live_navigate(session_id: str, page: Literal["home", "data-collection", "potential-analysis"]) -> Any:
    """Open a page of the app."""
    return await _live(session_id, "navigate", {"page": page})


@mcp.tool()
async def live_wait(session_id: str, timeout: float = 60) -> Dict[str, Any]:
    """Wait until the page's analyses have finished, then return its view."""
    return await _live(session_id, "wait_idle", {"timeout": timeout}, timeout + 5)


@mcp.tool()
async def live_select_streams(session_id: str, keys: Optional[List[str]] = None, value: bool = True,
                              all: bool = False, none: bool = False,
                              subprocess: Optional[int] = None) -> Any:
    """Tick streams for the analysis: all, none, every stream of a
    subprocess, or listed keys (stream_<subprocess>_<stream>)."""
    args: Dict[str, Any] = {"value": value, "all": all, "none": none}
    if keys is not None:
        args["keys"] = keys
    if subprocess is not None:
        args["process"] = subprocess
    return await _live(session_id, "select_streams", args)


@mcp.tool()
async def live_set_analysis(session_id: str, t_min: Optional[float] = None,
                            heat_recovery_pct: Optional[float] = None,
                            profile_mode: Optional[Literal["net_load", "composite"]] = None,
                            cop_model: Optional[Literal["2t", "4t"]] = None,
                            show_shifted: Optional[bool] = None, wait: bool = True) -> Dict[str, Any]:
    """Set the analysis inputs on the page (ΔTmin, the heat recovery slider,
    profile mode, COP model, shifted curves) and, with wait, return the view
    once the analysis has rerun."""
    if t_min is not None:
        await _live(session_id, "set_t_min", {"value": t_min})
    if profile_mode is not None:
        await _live(session_id, "set_profile_mode", {"mode": profile_mode})
    if heat_recovery_pct is not None:
        await _live(session_id, "set_recovery_pct", {"value": heat_recovery_pct})
    if cop_model is not None:
        await _live(session_id, "set_cop_model", {"model": cop_model})
    if show_shifted is not None:
        await _live(session_id, "set_show_shifted", {"value": show_shifted})
    return await _live(session_id, "wait_idle" if wait else "get_view", {"timeout": 60}, 65)


@mcp.tool()
async def live_select_heat_pumps(session_id: str, pumps: Optional[List[Dict[str, Any]]] = None,
                                 add: bool = False, clear: bool = False) -> Any:
    """Pick heat pumps on the optimization chart: [{"refrigerant": ..., "T_sink": ...}]
    (T_sink left out picks every point of that refrigerant). add keeps the
    current picks; clear removes all."""
    return await _live(session_id, "select_heat_pumps", {"points": pumps or [], "add": add, "clear": clear})


@mcp.tool()
async def live_set_economics(session_id: str, inputs: Optional[Dict[str, float]] = None,
                             reference_heater: Optional[Literal["gas", "oil", "eboiler"]] = None) -> Any:
    """Change the economic analysis inputs on the page (see economics_defaults)."""
    args: Dict[str, Any] = {"form": inputs or {}}
    if reference_heater:
        args["ref_type"] = reference_heater
    return await _live(session_id, "set_economics", args)


@mcp.tool()
async def live_use_cop_model(session_id: str, name: Optional[str] = None, enabled: Optional[bool] = None) -> Any:
    """Put a model from train_cop_model into the page's optimization (name),
    switch the page's trained model off or on (enabled), or remove it
    (name="" ). The optimization reruns by itself."""
    args: Dict[str, Any] = {}
    if name is not None:
        args["model"] = _model(name) if name else None
    if enabled is not None:
        args["enabled"] = enabled
    return await _live(session_id, "set_custom_cop_model", args)


@mcp.tool()
async def live_save_scenario(session_id: str, name: Optional[str] = None) -> Any:
    """Save the current selection and results as a scenario for comparison."""
    return await _live(session_id, "save_scenario", {"name": name} if name else {})


@mcp.tool()
async def live_generate_report(session_id: str, file_path: str) -> str:
    """The page's full HTML report, economics included, written to a file.
    The page has to be on potential-analysis."""
    out = await _live(session_id, "generate_report", timeout=180)
    path = Path(file_path).expanduser()
    path.write_text(out["html"], encoding="utf-8")
    return f"Saved to {path}"


@mcp.tool()
async def live_load_site_plan(session_id: str, file_path: str, subprocess_key: Optional[str] = None) -> Any:
    """Load a site plan (PNG, JPG or PDF) onto the page's map, placed to fill
    the view, or with subprocess_key ("g<process>" / "s<subprocess>") as that
    diagram's background. The page has to be on data-collection."""
    path = Path(file_path).expanduser()
    args: Dict[str, Any] = {
        "data": base64.b64encode(path.read_bytes()).decode(),
        "filename": path.name,
        "mime": mimetypes.guess_type(path.name)[0] or "",
    }
    if subprocess_key:
        args["subprocess"] = subprocess_key
    return await _live(session_id, "load_site_plan", args, 120)


def main() -> None:
    # httpx logs every request at INFO; the client's log is no place for that.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    mcp.run()


if __name__ == "__main__":
    main()
