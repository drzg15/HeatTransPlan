"""HeatTransPlan as MCP tools: everything the app's pages do, for an AI.
INSTRUCTIONS below is what the model is told when it connects."""

from __future__ import annotations

import base64
import json
import logging
import mimetypes
import os
import re
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from mcp.server.mcpserver import MCPServer

from heattransplan_mcp import documents, project_edit as edit
from heattransplan_mcp.api import Api, ApiError

INSTRUCTIONS = """\
HeatTransPlan screens an industrial site for heat recovery and heat pumps.
Where the site cools something hot and heats something else, it buys that
heat twice. The app finds the least heating and cooling the site must buy
(pinch analysis), which heat pump could lift the remaining waste heat to
where it is needed (heat pump integration and optimization), and whether
that pays (economic analysis). The results are a potential for a detailed
study, not a design: piping, timing (do two streams run at the same time?)
and equipment sizing are not checked. Say so when you report.

THE PHYSICS IN SHORT (explain(topic) has the full method)
- A stream is a flow to be cooled or heated. Hot stream: t_in > t_out, it
  gives heat (a source). Cold stream: t_in < t_out, it needs heat (a demand).
  CP = mass_flow * cp [kW/K]; its duty Q = CP * |t_in - t_out| [kW].
- Pinch analysis: a hot stream can heat a cold one if it is at least ΔTmin
  warmer (t_min, default 10 K). Hot temperatures are shifted down by ΔTmin/2,
  cold ones up by ΔTmin/2, and heat is cascaded through the temperature
  intervals. Results: the minimum heating and cooling still needed after all
  possible internal recovery, and the pinch temperature. Above the pinch the
  site needs heat, below it has heat to spare.
- A heat pump pays off across the pinch: its evaporator takes waste heat
  below the pinch (source), its condenser delivers it above (sink).
  Q_sink = Q_source + P_el, COP = Q_sink / P_el. The COP falls as the lift
  (T_sink - T_source) grows. The grand composite curve (GCC) shows the
  surplus below and the demand above by temperature.
- profile_mode "net_load" (default): the pump sees what is left after
  internal heat recovery (heat_recovery_pct: how much of it is in place).
  "composite": no recovery, the pump sees the raw streams.
- Heat pump optimization: for each real refrigerant machine (COP from a
  neural network trained on manufacturer data; the 4-temperature model is
  the standard) and each theoretical archetype (Stirling, VHTHP, SHP/HTHP,
  R717, 50 % Carnot), a grid over source and sink temperature finds where the
  waste heat available matches what the pump needs. Each point has COP,
  T_source, T_sink, Q_sink, Q_source. "source_limited": too little waste heat
  to cover the demand; "demand_limited": less demand than the pump could
  serve. Both lie off the profiles and are hidden by default.
- Economics (VDI 4646 / VDI 2067): the heat pump plus the old heater for the
  rest, against the reference heater (gas, oil or electric boiler), over the
  years: investment, energy costs, NPV, dynamic payback, IRR, cost of heat,
  CO2 saving, and the electricity price up to which the pump wins.

READING RESULTS
- No minimum heating (min_heating_kW 0) or no heat below the pinch means
  nothing for a heat pump to do: say so rather than force one.
- Recommend real machines; theoretical archetypes are yardsticks. The best
  point is the largest duty, not always the best COP or NPV: compare a few
  (list_heat_pumps, economic_analysis with pumps=[...]); the economics
  answer also names the economic optimum by size.
- Sinks above about 180 °C: no machine on the market. A lift above about
  100 K means a low COP.
- Results depend on ΔTmin, the stream selection and profile_mode: say which
  you used.

STEPS
Without a page (project files):
1. create_project (empty, an example from list_examples, or a JSON file).
2. Data: add_process (a plant area: a box on the map, lat/lon) ->
   add_subprocess (a machine or step; streams live here) -> add_stream
   (t_in, t_out and mass_flow + cp, or CP). update_* sets positions,
   operating hours and the process flow (next). get_project shows indices
   and stream keys.
3. analyse_project: pinch, heat pump integration, optimization and the
   economics of the best pump, for the streams chosen (selected_streams).
4. list_heat_pumps; economic_analysis to price another pump or change
   inputs (economics_defaults lists them).
5. generate_report; save_project_file (the user opens it in the app).
With the open page (live): live_sessions gives the session the user
connected ("Connect AI"); live_view shows what the page shows. Navigate,
then select streams, set the analysis, pick pumps, set economics, save
scenarios, make the report: the live_* tools and live_command. The
session's project_id works with every project tool and edits appear on the
page at once. Prefer live when the user has the page open: they see it.

WORKING WITH THE USER
- Documents (Word, PowerPoint, Excel, CSV): read_document gives their text
  and tables. Loose numbers in the chat work too. Pull out the streams, show
  them back as a table (name, hot/cold, t_in, t_out, flow and cp or CP or
  duty, hours) with what you assumed, and enter them once confirmed.
- Guided study: go page by page, as the app does: guide("start"), then
  "data", "analysis", "economics", "report". Each gives the questions for
  that step. Ask a few at a time, only what the documents do not answer,
  offer the default when the user does not know, and sum up before moving
  on. Never invent a value: an assumption is said as one.

CONVENTIONS
- process: index of a process; subprocess: index into the project's
  subprocess list (get_project shows both); stream key
  stream_<subprocess>_<stream>. All 0-based.
- Units: °C, kW, kW/K, kg/s, kJ/(kg·K); add_stream takes other units
  per value. Economics: prices in ct/kWh, rates and shares in %.
- Errors say what is wrong and how to fix it; read them.

Set HEATTRANSPLAN_URL (default http://localhost:8000) and, if the server
requires one, HEATTRANSPLAN_API_KEY.
"""

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


# ── The method ──────────────────────────────────────────────────────────────

# The app's own documentation, read where the repository has it.
DOCS = Path(os.getenv("HEATTRANSPLAN_DOCS") or Path(__file__).resolve().parents[2] / "docs")
TOPICS = {
    "overview": "index.md",
    "pinch": "pinch_analysis.md",
    "heat_pump_integration": "heat_pump_integration.md",
    "optimization": "heat_pump_optimization.md",
    "economics": "economic_analysis.md",
    "refrigerants": "refrigerant_limits.md",
    "api": "api_and_mcp.md",
}


@mcp.tool()
async def explain(topic: Literal["overview", "pinch", "heat_pump_integration", "optimization",
                                 "economics", "refrigerants", "api"]) -> str:
    """How HeatTransPlan computes things, with the equations: overview (what
    the app does, the workflow), pinch (ΔTmin shift, problem table, cascade,
    composite curves, GCC), heat_pump_integration (technology windows, COP
    regressions, the integration walk), optimization (COP models, archetypes,
    grid search, source/demand-limited points, trained models), economics
    (inputs, NPV, payback, break-even price, VDI 4646), refrigerants
    (operating limits), api (REST API and these tools). Read it before
    explaining a result to the user or when a result surprises you."""
    path = DOCS / TOPICS[topic]
    if not path.exists():
        raise ApiError(f"The documentation is not at {DOCS}; set HEATTRANSPLAN_DOCS to the repository's docs folder.")
    text = path.read_text(encoding="utf-8")
    # The source-code toggles are for engineers auditing the code, not for this.
    text = re.sub(r"<details>.*?</details>", "", text, flags=re.S)
    text = re.sub(r"```\{(literalinclude|toctree)\}.*?```", "", text, flags=re.S)
    return re.sub(r"\n{3,}", "\n\n", text)


GUIDE = {
    "start": """\
Before any data:
- What is the site and what should the study answer (cut gas use, CO2,
  replace a boiler, use a waste heat source)? Where is it (address for
  search_address and the map)?
- Which documents or measurements exist? Ask for them (read_document).
- Is the app open? Then ask for the session code of "Connect AI" and work
  live (live_sessions); otherwise work on a project file.
Next: guide("data").""",
    "data": """\
Data Collection page: processes (plant areas) -> subprocesses (machines or
steps) -> streams. Per plant area: its name and where it is on the site.
Per machine or step: name, operating hours (e.g. "2 shifts, Mon-Fri" or
h/a), and what follows it in the process. Per stream:
- What flows (water, air, steam, product)? Is it cooled (hot stream, a heat
  source) or heated (cold stream, a demand)?
- Inlet and outlet temperature [°C].
- Mass flow [kg/s, t/h] and specific heat [kJ/(kg·K)], or CP [kW/K]. With
  only the duty Q [kW] known: CP = Q / |t_in - t_out|. Typical cp: water
  4.19, air 1.0. Volume flows need the density.
- Do streams run at the same time? The analysis assumes they do; note the
  ones that do not.
Often missed sources: compressor and chiller condensers, exhaust air and
flue gas, waste water, cooling towers. Sinks: process and cleaning water
(CIP), drying, boiler feed water, space heating.
Show the stream table back before entering it. Next: guide("analysis").""",
    "analysis": """\
Potential Analysis page:
- Which streams belong in the study (all, or one area)?
- ΔTmin: the smallest temperature difference a heat exchanger can work
  with. Default 10 K; about 5 K liquid-liquid, 20 K or more with gases.
- How much of the possible heat recovery exists already (heat_recovery_pct;
  0 if the site has no heat exchangers between these streams)?
- Limits on the heat pump: the sink medium (water, steam), the highest
  supply temperature, refrigerants allowed or excluded (R717 is toxic,
  hydrocarbons flammable, synthetic ones may face phase-out)?
Then analyse_project and report: minimum heating and cooling, the pinch,
whether a heat pump has anything to do, then a few real machines with COP,
duty and temperatures. Ask which to price. Next: guide("economics").""",
    "economics": """\
Economic Analysis: compare economics_defaults with what the user knows.
- What heats today: gas, oil or electric boiler (reference_heater), and its
  efficiency?
- Prices now: fuel and electricity [ct/kWh], CO2 price [€/t], and expected
  yearly increases [%].
- Full-load hours per year, interest rate [%], lifetime [years].
- Investment: specific cost [€/kW] if a quote exists, otherwise the
  default; funding or subsidies [%]; maintenance.
- Today's heat and cooling demand [kW] for the status quo (energy_demands).
Report NPV, payback, cost of heat, CO2 saving and the break-even
electricity price, with the inputs used. Next: guide("report").""",
    "report": """\
- Which language (en, de), and where should the report go? Then
  generate_report or live_generate_report. Save the project too (save_project_file) so the user
  can open it in the app.
- Sum up in plain words: what was found, which pump and why, what it costs
  and saves, what was assumed, and what a detailed study must check
  (timing of the streams, piping distances, space, the real machine).""",
}


@mcp.tool()
async def guide(step: Literal["start", "data", "analysis", "economics", "report"] = "start") -> str:
    """The questions to ask the user at each step of a guided study, page by
    page as the app goes: start, data (Data Collection), analysis (Potential
    Analysis), economics, report. Ask only what the user's documents do not
    already answer."""
    return GUIDE[step]


@mcp.prompt()
def guided_study() -> str:
    """Make a heat pump study with HeatTransPlan step by step, asking questions."""
    return ("Guide me through a HeatTransPlan study page by page. Start with guide('start'), "
            "ask me a few questions at a time, read any documents I give you with "
            "read_document, and sum up before each next step.")


@mcp.tool()
async def read_document(file_path: str) -> Dict[str, Any]:
    """Text and tables of a document the user gives: Word (.docx, paragraphs
    and tables in order), PowerPoint (.pptx, per slide), Excel (.xlsx, rows
    per sheet, first 500 rows) or text/CSV. Use it to find streams,
    temperatures, flows, hours and prices."""
    try:
        return documents.read(file_path)
    except (ValueError, KeyError, zipfile.BadZipFile) as exc:
        raise ApiError(str(exc) if isinstance(exc, ValueError) else f"Could not read {file_path}: {exc}") from exc


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
                            box_scale: Optional[float] = None, notes: Optional[str] = None,
                            density: Optional[str] = None, pressure: Optional[str] = None,
                            water_content_in: Optional[str] = None,
                            water_content_out: Optional[str] = None) -> Dict[str, Any]:
    """Set a subprocess's name, position, operating hours, following
    subprocess(es) (comma separated names), box size on the map, or its
    "Parameters & notes" (notes, density, pressure, water content in/out:
    free text, as typed on the page)."""
    return await _edit(project_id, lambda s: edit.update_subprocess(
        s, subprocess, name=name, lat=lat, lon=lon, hours=hours, next=next, box_scale=box_scale,
        notes=notes, density=density, pressure=pressure, water_content_in=water_content_in,
        water_content_out=water_content_out))


@mcp.tool()
async def delete_subprocess(project_id: str, subprocess: int) -> Dict[str, Any]:
    """Delete a subprocess (the last one takes its process along), as on the page."""
    return await _edit(project_id, lambda s: edit.delete_subprocess(s, subprocess))


@mcp.tool()
async def add_stream(project_id: str, subprocess: int, name: str,
                     t_in: Optional[float] = None, t_out: Optional[float] = None,
                     mass_flow: Optional[float] = None, cp: Optional[float] = None,
                     CP: Optional[float] = None, units: Optional[Dict[str, str]] = None,
                     stream_type: Literal["product", "steam", "air", "water"] = "product",
                     extra: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
    """Add a stream to a subprocess: inlet and outlet temperature plus either
    mass flow and specific heat (cp) or the heat capacity rate CP directly.
    Defaults: °C, kg/s, kJ/(kg·K), kW/K. Other units by variable, e.g.
    {"Tin": "K", "Tout": "K", "ṁ": "t/h", "cp": "J/(kg·K)", "CP": "W/K"}.
    extra: further values the stream editor offers: "Density" (kg/m³ or
    g/cm³), "Water Content In" / "Water Content Out" (%, g/kg, kg/kg),
    "Pressure" (bar, Pa, atm); they are recorded, the analysis does not use
    them. A stream is hot (a heat source) when t_in > t_out."""
    values = {"Tin": t_in, "Tout": t_out, "ṁ": mass_flow, "cp": cp, "CP": CP, **(extra or {})}
    return await _edit(project_id, lambda s: {
        "stream": edit.add_stream(s, subprocess, edit.make_stream(name, values, units, stream_type))})


@mcp.tool()
async def update_stream(project_id: str, subprocess: int, stream: int, name: Optional[str] = None,
                        t_in: Optional[float] = None, t_out: Optional[float] = None,
                        mass_flow: Optional[float] = None, cp: Optional[float] = None,
                        CP: Optional[float] = None, units: Optional[Dict[str, str]] = None,
                        stream_type: Optional[Literal["product", "steam", "air", "water"]] = None,
                        extra: Optional[Dict[str, float]] = None, clear: Optional[List[str]] = None,
                        show: Optional[List[str]] = None) -> Dict[str, Any]:
    """Change a stream; only the values given change. extra: as add_stream.
    clear: variables to empty, e.g. ["CP"] so ṁ·cp counts again. A new
    stream_type shows that type's fields, as on the page; show sets the
    fields shown (Tin, Tout, ṁ, cp, CP, Density, Water Content In, Water
    Content Out, Pressure)."""
    values = {k: v for k, v in {"Tin": t_in, "Tout": t_out, "ṁ": mass_flow, "cp": cp, "CP": CP,
                                **(extra or {})}.items() if v is not None}
    values.update({k: "" for k in clear or []})
    return await _edit(project_id, lambda s: edit.update_stream(
        s, subprocess, stream, name, values, units, stream_type, show))


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
                  locked: Optional[bool] = None, bearing: Optional[float] = None) -> Dict[str, Any]:
    """Set the map's centre [lat, lon], zoom, base layer, lock or bearing
    (degrees clockwise from north; 0 faces north)."""
    def change(s):
        if center is not None:
            s["map_center"] = center
        if zoom is not None:
            s["map_zoom"] = zoom
        if bearing is not None:
            s["map_bearing"] = bearing % 360
        if base is not None:
            s["current_base"] = base
        if locked is not None:
            s["map_locked"] = locked
    return await _edit(project_id, change)


@mcp.tool()
async def search_address(query: str) -> Any:
    """Find a place by address (OpenStreetMap), as the map's search box:
    candidates with lat/lon, for set_map(center=...) and placing processes."""
    return (await api.post("/api/geo/search", json={"query": query}))["results"]


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
                          custom_model: Optional[str] = None,
                          energy_demands: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """Run the Potential Analysis on a project: pinch, heat pump integration,
    heat pump optimization and the economic analysis of the best pump.

    selected_streams: stream keys (stream_<subprocess>_<stream>, see
    get_project); default the project's selection, or all streams.
    heat_recovery_pct: share of the possible heat recovery already in place
    (0–100, net_load only). cop_model "4t" (standard) scores pumps with all
    four temperatures, "2t" with source return and sink supply only. cop_formula: {"name", "expression", ...} adds a custom COP
    correlation (check it first with validate_cop_formula). custom_model: the
    name of a model from train_cop_model, offered next to the shipped one.
    economics_inputs: see economics_defaults; the reference heater's own
    values (efficiency, fuel price, CO2) are filled in as on the page unless
    given. energy_demands: what the site uses today, for the status quo
    comparison: [{"heat_demand": kW, "cooling_demand": kW,
    "selected_heat_streams": [names], "selected_cooling_streams": [names]}]
    (default the project's). The streams, ΔTmin and demands given are saved
    to the project, as the page does. Results are kept for list_heat_pumps,
    economic_analysis and generate_report."""
    state = await _load(project_id)
    sel = {k: True for k in selected_streams} if selected_streams is not None else None
    changed = {k: v for k, v in {"selected_streams": sel, "t_min": t_min,
                                  "energy_demands": energy_demands}.items() if v is not None}
    if changed:
        state = await _save(project_id, {**state, **changed})
    economics_inputs = {**await _preset(reference_heater), **(economics_inputs or {})}
    out = await api.post("/api/analysis/project", json={
        "state": state, "selected_streams": sel, "t_min": t_min, "profile_mode": profile_mode,
        "recovery_pct": heat_recovery_pct, "cop_model": cop_model, "cop_formula": cop_formula,
        "custom_cop_model": _model(custom_model) if custom_model else None,
        "economics_form": economics_inputs, "ref_type": reference_heater,
    })
    _analysis[project_id] = {**out, "economics_inputs": economics_inputs, "reference_heater": reference_heater,
                             "selected_points": []}
    summary = _summary(out)
    demands = state.get("energy_demands") or []
    if "pinch" in out and any(d.get("heat_demand") or d.get("cooling_demand") for d in demands):
        # As the page: today's demands against the pinch minimum.
        summary["status_quo"] = await api.post("/api/analysis/status-quo", json={
            "current_demands": [{"stream_name": "", "heating_kW": d.get("heat_demand") or 0,
                                 "cooling_kW": d.get("cooling_demand") or 0} for d in demands],
            "pinch_hot_utility": out["pinch"]["hot_utility"],
            "pinch_cold_utility": out["pinch"]["cold_utility"],
        })
    return summary


async def _preset(reference_heater: str) -> Dict[str, float]:
    """The reference heater's own inputs, which picking it on the page sets."""
    return (await api.get("/api/analysis/economics/defaults"))["presets"][reference_heater]


def _model(name: str) -> Dict[str, Any]:
    if name not in _models:
        raise ApiError(f"No trained model '{name}'; train one with train_cop_model ({', '.join(_models) or 'none yet'}).")
    return _models[name]


@mcp.tool()
async def inspect_cop_data(file_path: str, sheet: Optional[str] = None) -> Dict[str, Any]:
    """Read a heat pump data file before train_cop_model, as the page's
    dialog does: its sheets (Excel), columns, numeric columns, row count,
    the first rows, and a guess of which column is which (the mapping to
    check and pass on)."""
    path = Path(file_path).expanduser()
    return await api.request("POST", "/api/analysis/cop-model/inspect",
                             files={"file": (path.name, path.read_bytes())},
                             data={"sheet": sheet} if sheet else {})


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
    Inputs not given keep their last value; a new reference_heater brings its
    own efficiency, fuel price and CO2 factor, as on the page."""
    cache = _cached(project_id)
    opt = cache["optimization"]
    if reference_heater and reference_heater != cache["reference_heater"]:
        cache["economics_inputs"] = {**cache["economics_inputs"], **await _preset(reference_heater)}
        cache["reference_heater"] = reference_heater
    if inputs:
        cache["economics_inputs"] = {**cache["economics_inputs"], **inputs}
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
    set_heat_pump_filters {medium_sink, refrigerant_type, refrigerants,
    stages, show_theoretical, show_source_limited, show_demand_limited},
    select_filtered_heat_pumps,
    reset_heat_pumps, set_economics {form, ref_type}, reset_economics,
    save_scenario {name}, load_scenario {index}, rename_scenario {index, name},
    delete_scenario {index}, set_project_notes {notes}, set_pinch_notes
    {notes}, set_map_view {center, zoom, bearing, base, locked}, set_site_plan_bounds
    {bounds}, fit_site_plan_to_view, remove_site_plan, remove_subprocess_plan {key}, export_csv,
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
    (T_sink left out: every point of that refrigerant; refrigerant left out:
    everything at that sink temperature, as a click on the chart). add keeps
    the current picks; clear removes all."""
    return await _live(session_id, "select_heat_pumps", {"points": pumps or [], "add": add, "clear": clear})


@mcp.tool()
async def live_filter_heat_pumps(session_id: str, medium_sink: Optional[str] = None,
                                 refrigerant_type: Optional[str] = None,
                                 refrigerants: Optional[List[str]] = None, stages: Optional[List[str]] = None,
                                 show_theoretical: Optional[bool] = None,
                                 show_source_limited: Optional[bool] = None,
                                 show_demand_limited: Optional[bool] = None,
                                 select_all: bool = False) -> Any:
    """Set the optimization panel's filters, as its controls: sink medium and
    refrigerant type ("All" or one value), refrigerants and stages (lists;
    [] is all), and whether theoretical archetypes and source- or
    demand-limited points are shown. The answer lists the values each filter
    offers. select_all then picks every pump the filters leave, as "Select all"."""
    args = {k: v for k, v in {
        "medium_sink": medium_sink, "refrigerant_type": refrigerant_type, "refrigerants": refrigerants,
        "stages": stages, "show_theoretical": show_theoretical,
        "show_source_limited": show_source_limited, "show_demand_limited": show_demand_limited,
    }.items() if v is not None}
    out = await _live(session_id, "set_heat_pump_filters", args)
    if select_all:
        out["selected"] = (await _live(session_id, "select_filtered_heat_pumps"))["selected"]
    return out


@mcp.tool()
async def live_set_economics(session_id: str, inputs: Optional[Dict[str, float]] = None,
                             reference_heater: Optional[Literal["gas", "oil", "eboiler"]] = None) -> Any:
    """Change the economic analysis inputs on the page (see economics_defaults).
    A new reference_heater brings its own efficiency, fuel price and CO2
    factor, as picking it on the page does; inputs given win."""
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
