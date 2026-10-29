"""HeatTransPlan as MCP tools: everything the app's pages do, for an AI.
INSTRUCTIONS below is what the model is told when it connects."""

from __future__ import annotations

import base64
import functools
import inspect
import json
import logging
import mimetypes
import os
import re
import secrets
import time
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

import httpx
from mcp.server.mcpserver import MCPServer

from heattransplan_mcp import documents, files, project_edit as edit
from heattransplan_mcp.files import _deliver, _read_input
from heattransplan_mcp.texts import GUIDE, INSTRUCTIONS, MODES, RULES, TOPICS
from heattransplan_mcp.api import Api, ApiError


mcp = MCPServer(name="heattransplan", instructions=INSTRUCTIONS, version="3.0.0")
api = Api()

# Tools that only read: they are not listed in the page's AI activity.
READS = {"start", "get_project", "list_heat_pumps", "save_project_file", "export_csv", "live_view",
         "live_results", "live_wait"}
LIVE_READS = {"get_view", "get_results", "list_commands", "wait_idle", "get_project", "export_csv",
              "export_distances_csv"}
# Page commands that delete or replace: the user is asked first.
LIVE_CONFIRM = {"set_project", "remove_site_plan", "remove_subprocess_plan", "delete_scenario"}


async def _record(key: str, name: str, given: Dict[str, Any]) -> None:
    """Note a change in the page's AI activity list (and the server's log)."""
    if name == "live_command" and given.get("command") in LIVE_READS:
        return
    parts, fields = [], []
    for k, v in given.items():
        if v is None:
            continue
        fields.append(k)
        text = "…" if k in ("content", "state") else v if isinstance(v, str) else json.dumps(
            v, ensure_ascii=False, default=str)
        parts.append(f"{k}={text[:60] + '…' if len(text) > 60 else text}")
    try:
        await api.post(f"/api/live/pages/{key}/log",
                       json={"tool": name, "detail": ", ".join(parts)[:500], "fields": fields})
    except ApiError:
        pass  # the change is made; a missing log line must not undo it


def tool(fn):
    """Register a tool. Its calls that change the open page (they carry its
    code) appear in the page's AI activity list and the server's log."""
    signature = inspect.signature(fn)

    @functools.wraps(fn)
    async def call(*args, **kwargs):
        result = await fn(*args, **kwargs)
        if fn.__name__ not in READS:
            given = dict(signature.bind(*args, **kwargs).arguments)
            key = given.pop("session_id", None) or given.pop("project_id", None)
            if key:
                await _record(key, fn.__name__, given)
        return result

    return mcp.tool()(call)

# Last analysis per project, so follow-up tools need not resend large results.
_analysis: Dict[str, Dict[str, Any]] = {}
# COP models trained with train_cop_model, by name.
_models: Dict[str, Dict[str, Any]] = {}


def _keep(cache: Dict[str, Any], key: str, value: Any, limit: int = 50) -> None:
    """Store, forgetting the oldest beyond `limit`: hosted, every connected
    page is a new project, so an unbounded cache only ever grows."""
    cache.pop(key, None)
    cache[key] = value
    while len(cache) > limit:
        cache.pop(next(iter(cache)))


def set_api(new: Api) -> None:
    """Point the tools at another backend (tests)."""
    global api
    api = new
    _analysis.clear()
    _models.clear()


async def _page_info(key: str) -> Dict[str, str]:
    """The page that is open and connected, by its Connect AI code or project
    id: its project_id and session_id. The AI works only on such a page, and
    not while the user has paused it: every project tool comes through here."""
    try:
        return await api.get(f"/api/live/pages/{key}")
    except ApiError as exc:
        if "(404)" in str(exc):
            raise ApiError("No open page is connected with this code. You work only on the page the "
                           "user has open: ask them to open HeatTransPlan, click Connect AI and "
                           "tell you the code.") from exc
        if "(423)" in str(exc):
            raise ApiError("The user has paused the AI on the page. Wait until they resume it; "
                           "do not try to get around it.") from exc
        raise


async def _page(key: str) -> str:
    return (await _page_info(key))["project_id"]


async def _confirm(key: str, kind: str, name: str = "") -> None:
    """Ask the user on the page before a change that cannot simply be redone
    (deleting, replacing). Raises unless they allow it."""
    session_id = (await _page_info(key))["session_id"]
    try:
        answer = await _live(session_id, "confirm_ai_action", {"kind": kind, "name": name}, timeout=120)
    except ApiError as exc:
        raise ApiError(f"The user was asked on the page but did not answer ({exc}). Nothing was "
                       "changed.") from exc
    if not (isinstance(answer, dict) and answer.get("allowed") is True):
        raise ApiError("The user declined this on the page. Nothing was changed; ask them what "
                       "they want instead.")


def _label(state: Dict[str, Any], process: Optional[int] = None, subprocess: Optional[int] = None,
           stream: Optional[int] = None) -> str:
    """The name of a process, subprocess or stream, for asking the user."""
    try:
        if process is not None:
            return state["proc_group_names"][process]
        node = state["processes"][subprocess]
        return node["streams"][stream]["name"] if stream is not None else node["name"]
    except (KeyError, IndexError, TypeError):
        return ""


async def _load(project_id: str) -> Dict[str, Any]:
    """The open page's project as it is now: while a page is connected it,
    not the backend's copy, is the truth."""
    return await _live((await _page_info(project_id))["session_id"], "get_project")


def _target(state: Dict[str, Any], focus: Optional[str]) -> Any:
    """What a step changed, as get_project shows it: a process (g<i>), a
    subprocess (s<i>) or a stream (its key)."""
    if not focus:
        return None
    for proc in edit.overview(state)["processes"]:
        if focus == f"g{proc['process']}":
            return proc
        for sub in proc["subprocesses"]:
            if focus == f"s{sub['subprocess']}":
                return sub
            for stream in sub["streams"]:
                if focus == stream["key"]:
                    return stream
    return None


async def _edit(project_id: str, label: str, change, focus=None) -> Dict[str, Any]:
    """One step on the open page: worked out on its project as it is now,
    then only the fields it changed are sent. The page applies them without
    touching its scenarios, economics or analysis settings, keeps the step
    for undo and highlights it. focus(result) names what changed (see
    _target). Returns the step's result and that changed object."""
    info = await _page_info(project_id)
    before = await _live(info["session_id"], "get_project")
    state = edit.clone(before)
    try:
        result = change(state)
    except edit.EditError as exc:
        raise ApiError(str(exc)) from exc
    changes = {k: v for k, v in state.items() if before.get(k) != v}
    key = focus(result) if callable(focus) else focus
    if changes:
        await _live(info["session_id"], "edit_project", {"changes": changes, "focus": key, "label": label})
    _analysis.pop(info["project_id"], None)
    return {"result": result, "changed": _target(state, key)}


# ── The method ──────────────────────────────────────────────────────────────

# The app's own documentation, read where the repository has it.
DOCS = Path(os.getenv("HEATTRANSPLAN_DOCS") or Path(__file__).resolve().parents[2] / "docs")
DOCS_URL = "https://raw.githubusercontent.com/drzg15/HeatTransPlan/main/docs"


@tool
async def explain(topic: Literal["overview", "pinch", "heat_pump_integration", "optimization",
                                 "economics", "refrigerants", "api", "architecture"]) -> str:
    """How HeatTransPlan computes things, with the equations: overview (what
    the app does, the workflow), pinch (ΔTmin shift, problem table, cascade,
    composite curves, GCC), heat_pump_integration (technology windows, COP
    regressions, the integration walk), optimization (COP models, archetypes,
    grid search, source/demand-limited points, trained models), economics
    (inputs, NPV, payback, break-even price, VDI 4646), refrigerants
    (operating limits), api (REST API and these tools), architecture (how
    the app is built, what you may do on the page, security). Read it before
    explaining a result to the user or when a result surprises you."""
    path = DOCS / TOPICS[topic]
    if path.exists():
        text = path.read_text(encoding="utf-8")
    else:
        # Installed from GitHub (uvx), not from a checkout: read the published docs.
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(f"{DOCS_URL}/{TOPICS[topic]}")
        if resp.status_code != 200:
            raise ApiError(f"The documentation is neither at {DOCS} nor at {DOCS_URL}; "
                           "set HEATTRANSPLAN_DOCS to the repository's docs folder.")
        text = resp.text
    # The source-code toggles are for engineers auditing the code, not for this.
    text = re.sub(r"<details>.*?</details>", "", text, flags=re.S)
    text = re.sub(r"```\{(literalinclude|toctree)\}.*?```", "", text, flags=re.S)
    return re.sub(r"\n{3,}", "\n\n", text)


@tool
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


@tool
async def read_document(file_path: Optional[str] = None, content: Optional[str] = None) -> Dict[str, Any]:
    """Text and tables of a document the user gives: Word (.docx, paragraphs
    and tables in order), PowerPoint (.pptx, per slide), Excel (.xlsx, rows
    per sheet, first 500 rows) or text/CSV. Use it to find streams,
    temperatures, flows, hours and prices. If you can read the document
    yourself (it is attached to the chat), you need not call this.
    file_path on this computer, or content (see "Files" in the instructions)."""
    name, data = _read_input(file_path, content)
    try:
        return documents.read(name, data)
    except (ValueError, KeyError, zipfile.BadZipFile) as exc:
        raise ApiError(str(exc) if isinstance(exc, ValueError) else f"Could not read {name}: {exc}") from exc


# ── Projects ────────────────────────────────────────────────────────────────


@tool
async def start(project_id: str) -> Dict[str, Any]:
    """Call this first, when the user gives you the code. What the open page
    holds now, the ways of working to offer and your standing rules. Open
    with `say`, offer `modes`, state `rules`, then do what the user picks."""
    view = await _live((await _page_info(project_id))["session_id"], "get_view")
    groups = view["project"]["groups"]
    subs = [sp for g in groups for sp in g["subprocesses"]]
    streams = sum(len(sp["streams"]) for sp in subs)
    scenarios = len(view.get("scenarios") or [])
    held = (f"{len(groups)} process{'es' if len(groups) != 1 else ''}, "
            f"{len(subs)} subprocess{'es' if len(subs) != 1 else ''}, "
            f"{streams} stream{'s' if streams != 1 else ''}"
            + (f", {scenarios} saved scenario{'s' if scenarios != 1 else ''}" if scenarios else ""))
    say = (f"Here is the current page: {held}. Continue with it or start fresh?" if groups else
           "The page is empty, so we start a new case.")
    return {"page": {"processes": len(groups), "subprocesses": len(subs), "streams": streams,
                     "scenarios": scenarios, "open": view.get("page")},
            "say": say, "modes": MODES, "rules": RULES}


@tool
async def undo(project_id: str) -> Dict[str, Any]:
    """Take back your last step on the page (add, change or delete of a
    process, subprocess or stream, site plan, analysis inputs). Up to 20
    steps; a whole case loaded with replace_project clears them."""
    return await _live((await _page_info(project_id))["session_id"], "undo")


@tool
async def save_text_file(file_path: str, content: str) -> str:
    """Save text you wrote for the user, e.g. a validation's differences as
    CSV. Locally into file_path (only in the case's folder unless the user
    agreed otherwise); online a download link for the user."""
    media = mimetypes.guess_type(file_path)[0] or "text/plain"
    return _deliver(file_path, Path(file_path).name, content.encode("utf-8"), media)


@tool
async def list_examples() -> List[str]:
    """Example projects that ship with HeatTransPlan."""
    return (await api.get("/api/assets/examples"))["examples"]


@tool
async def get_project(project_id: str, full: bool = False) -> Dict[str, Any]:
    """A project as an overview (processes, subprocesses, streams with their
    keys and values) or, with full=True, its complete JSON."""
    state = await _load(project_id)
    return state if full else edit.overview(state)


@tool
async def save_project_file(project_id: str, file_path: Optional[str] = None) -> str:
    """Save a project as JSON, the same file the page's Save button writes
    (the user opens it in the app). Online: a download link for the user."""
    state = await _load(project_id)
    data = json.dumps(state, ensure_ascii=False, indent=2).encode("utf-8")
    return _deliver(file_path, "heattransplan_project.json", data, "application/json")


@tool
async def replace_project(project_id: str, state: Optional[Dict[str, Any]] = None,
                          example: Optional[str] = None, file_path: Optional[str] = None,
                          content: Optional[str | Dict[str, Any]] = None,
                          empty: bool = False) -> Dict[str, Any]:
    """Load a whole case onto the open page, as loading a file there: a
    project JSON (state), an example (see list_examples), a saved project file
    (file_path, or its content), or empty=True to start fresh. Only for a
    new case; single changes have their own tools. Ask the user first: the
    page asks them too, and the old case's scenarios go with it."""
    given = [x for x in (state, example, file_path or content) if x is not None]
    if len(given) + bool(empty) != 1:
        raise ApiError("Give one of state, example, a file (file_path or content) or empty=True.")
    if empty:
        await _confirm(project_id, "replace_project", "an empty project")
        await _live((await _page_info(project_id))["session_id"], "set_project", {"state": None})
        return edit.overview(await _load(project_id))
    if example:
        state = await api.get(f"/api/assets/examples/{example}")
    elif state is None:
        state = json.loads(_read_input(file_path, content)[1].decode("utf-8"))
    await _confirm(project_id, "replace_project", example or (Path(file_path).name if file_path else ""))
    # A whole case: the page drops the old one's scenarios and undo steps with it.
    await _live((await _page_info(project_id))["session_id"], "set_project", {"state": state})
    return edit.overview(await _load(project_id))


@tool
async def add_process(project_id: str, name: Optional[str] = None, lat: Optional[float] = None,
                      lon: Optional[float] = None) -> Dict[str, Any]:
    """Add a process (a box on the map) with one empty subprocess, as the
    "Add process" button. Returns the new process index."""
    return await _edit(project_id, f"add process {name or ''}".strip(),
                       lambda s: {"process": edit.add_process(s, name, lat, lon)},
                       lambda r: f"g{r['process']}")


@tool
async def update_process(project_id: str, process: int, name: Optional[str] = None,
                         lat: Optional[float] = None, lon: Optional[float] = None,
                         hours: Optional[str] = None, box_scale: Optional[float] = None) -> Dict[str, Any]:
    """Rename a process or set its position (lat/lon), operating hours or box size."""
    return await _edit(project_id, f"change process {process}", lambda s: edit.update_process(
        s, process, name, lat=lat, lon=lon, hours=hours, box_scale=box_scale), f"g{process}")


@tool
async def delete_process(project_id: str, process: int) -> Dict[str, Any]:
    """Delete a process and its subprocesses; later indices and the stream
    selection move up, as on the page. The user is asked on the page first."""
    label = _label(await _load(project_id), process=process)
    await _confirm(project_id, "delete_process", label)
    return await _edit(project_id, f"delete process {label}", lambda s: edit.delete_process(s, process))


@tool
async def add_subprocess(project_id: str, process: int, name: Optional[str] = None) -> Dict[str, Any]:
    """Add a subprocess (where streams live) to a process. Returns its index."""
    return await _edit(project_id, f"add subprocess {name or ''}".strip(),
                       lambda s: {"subprocess": edit.add_subprocess(s, process, name)},
                       lambda r: f"s{r['subprocess']}")


@tool
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
    return await _edit(project_id, f"change subprocess {subprocess}", lambda s: edit.update_subprocess(
        s, subprocess, name=name, lat=lat, lon=lon, hours=hours, next=next, box_scale=box_scale,
        notes=notes, density=density, pressure=pressure, water_content_in=water_content_in,
        water_content_out=water_content_out), f"s{subprocess}")


@tool
async def delete_subprocess(project_id: str, subprocess: int) -> Dict[str, Any]:
    """Delete a subprocess (the last one takes its process along), as on the
    page. The user is asked on the page first."""
    label = _label(await _load(project_id), subprocess=subprocess)
    await _confirm(project_id, "delete_subprocess", label)
    return await _edit(project_id, f"delete subprocess {label}",
                       lambda s: edit.delete_subprocess(s, subprocess))


@tool
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
    return await _edit(project_id, f"add stream {name}", lambda s: {
        "stream": edit.add_stream(s, subprocess, edit.make_stream(name, values, units, stream_type))},
        lambda r: f"stream_{subprocess}_{r['stream']}")


@tool
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
    return await _edit(project_id, f"change stream {subprocess}/{stream}", lambda s: edit.update_stream(
        s, subprocess, stream, name, values, units, stream_type, show), f"stream_{subprocess}_{stream}")


@tool
async def delete_stream(project_id: str, subprocess: int, stream: int) -> Dict[str, Any]:
    """Delete a stream; later streams of the subprocess move up, selection
    too. The user is asked on the page first."""
    label = _label(await _load(project_id), subprocess=subprocess, stream=stream)
    await _confirm(project_id, "delete_stream", label)
    return await _edit(project_id, f"delete stream {label}",
                       lambda s: edit.delete_stream(s, subprocess, stream))


@tool
async def set_notes(project_id: str, project_notes: Optional[str] = None,
                    pinch_notes: Optional[str] = None) -> Dict[str, Any]:
    """Set the data collection notes and/or the analysis notes."""
    session_id = (await _page_info(project_id))["session_id"]
    if project_notes is not None:
        await _live(session_id, "set_project_notes", {"notes": project_notes})
    if pinch_notes is not None:
        await _live(session_id, "set_pinch_notes", {"notes": pinch_notes})
    return {"project_notes": project_notes, "pinch_notes": pinch_notes}


@tool
async def set_map(project_id: str, center: Optional[List[float]] = None, zoom: Optional[float] = None,
                  base: Optional[Literal["OpenStreetMap", "Satellite"]] = None,
                  locked: Optional[bool] = None, bearing: Optional[float] = None) -> Dict[str, Any]:
    """Set the map's centre [lat, lon], zoom, base layer, lock or bearing
    (degrees clockwise from north; 0 faces north)."""
    args = {"center": center, "zoom": zoom, "bearing": None if bearing is None else bearing % 360,
            "base": base, "locked": locked}
    return await _live((await _page_info(project_id))["session_id"], "set_map_view",
                       {k: v for k, v in args.items() if v is not None})


@tool
async def search_address(query: str) -> Any:
    """Find a place by address (OpenStreetMap), as the map's search box:
    candidates with lat/lon, for set_map(center=...) and placing processes."""
    return (await api.post("/api/geo/search", json={"query": query}))["results"]


@tool
async def set_site_plan(project_id: str, image_path: Optional[str] = None,
                        bounds: Optional[List[List[float]]] = None, subprocess_key: Optional[str] = None,
                        remove: bool = False, content: Optional[str] = None) -> Dict[str, Any]:
    """Put the user's own site plan (PNG or JPG: image_path, or base64
    content with image_path naming it) on the map in place of the map tiles,
    with bounds [[south, west], [north, east]] in map coordinates;
    or, with subprocess_key ("g<process>" or "s<subprocess>"), as the
    background of that diagram. remove=True takes it away. PDFs and placing
    the plan in the current view need the open page: live_load_site_plan."""
    image = None if remove or (image_path is None and content is None) else _read_input(image_path, content)
    if remove:
        await _confirm(project_id, "remove_site_plan", subprocess_key or "")

    def change(s):
        if remove:
            if subprocess_key:
                (s.get("canvas_plans") or {}).pop(subprocess_key, None)
            else:
                s["site_plan"] = None
            return
        if image is None:
            raise edit.EditError("image_path (or content) is needed")
        mime = mimetypes.guess_type(image[0])[0] or ""
        if mime not in ("image/png", "image/jpeg"):
            raise edit.EditError("Only PNG and JPG here; for PDF use live_load_site_plan.")
        url = f"data:{mime};base64,{base64.b64encode(image[1]).decode()}"
        if subprocess_key:
            s["canvas_plans"] = {**(s.get("canvas_plans") or {}), subprocess_key: url}
        else:
            if not bounds:
                raise edit.EditError("bounds [[south, west], [north, east]] are needed for the site plan")
            s["site_plan"] = {"url": url, "bounds": bounds}
    return await _edit(project_id, "remove site plan" if remove else "site plan", change)


@tool
async def export_csv(project_id: str, file_path: Optional[str] = None) -> str:
    """Write the project's streams as CSV (the backend's export). Online: a
    download link for the user."""
    project_id = await _page(project_id)
    # The page is the truth and syncs to the backend with a delay: hand the
    # backend the page's project first, so the export has the last edits.
    session_id = (await _page_info(project_id))["session_id"]
    await api.put(f"/api/projects/{project_id}", json=await _load(project_id),
                  headers={"X-Live-Session": session_id})
    text = await api.get(f"/api/io/export-csv/{project_id}")
    return _deliver(file_path, "streams.csv", text.encode("utf-8"), "text/csv")


@tool
async def import_csv(project_id: str, file_path: Optional[str] = None,
                     content: Optional[str] = None) -> Dict[str, Any]:
    """Load streams from a CSV file (file_path, or its text as content) into
    the project (the backend's import): it replaces the processes, so the
    user is asked on the page first."""
    project_id = await _page(project_id)
    name, data = _read_input(file_path, content)
    await _confirm(project_id, "import_csv", name)
    await api.request("POST", f"/api/io/import-csv/{project_id}",
                      files={"file": (name, data, "text/csv")})
    _analysis.pop(project_id, None)
    session_id = (await _page_info(project_id))["session_id"]
    await _live(session_id, "set_project", {"state": await api.get(f"/api/projects/{project_id}")})
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


@tool
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
    sel = {k: True for k in selected_streams} if selected_streams is not None else None
    changed = {k: v for k, v in {"selected_streams": sel, "t_min": t_min,
                                  "energy_demands": energy_demands}.items() if v is not None}
    if changed:
        await _edit(project_id, "analysis inputs", lambda s: s.update(changed))
    state = await _load(project_id)
    project_id = await _page(project_id)
    economics_inputs = {**await _preset(reference_heater), **(economics_inputs or {})}
    out = await api.post("/api/analysis/project", json={
        "state": state, "selected_streams": sel, "t_min": t_min, "profile_mode": profile_mode,
        "recovery_pct": heat_recovery_pct, "cop_model": cop_model, "cop_formula": cop_formula,
        "custom_cop_model": _model(custom_model) if custom_model else None,
        "economics_form": economics_inputs, "ref_type": reference_heater,
    })
    _keep(_analysis, project_id, {**out, "economics_inputs": economics_inputs,
                                  "reference_heater": reference_heater, "selected_points": []})
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


@tool
async def inspect_cop_data(file_path: Optional[str] = None, sheet: Optional[str] = None,
                           content: Optional[str] = None) -> Dict[str, Any]:
    """Read a heat pump data file before train_cop_model, as the page's
    dialog does: its sheets (Excel), columns, numeric columns, row count,
    the first rows, and a guess of which column is which (the mapping to
    check and pass on). file_path, or content with file_path naming it."""
    name, data = _read_input(file_path, content)
    return await api.request("POST", "/api/analysis/cop-model/inspect",
                             files={"file": (name, data)},
                             data={"sheet": sheet} if sheet else {})


@tool
async def train_cop_model(file_path: str, mapping: Dict[str, str], name: str = "My COP model",
                          model_type: Literal["nn", "poly", "linear"] = "nn",
                          degree: Literal[2, 3] = 2, sheet: Optional[str] = None,
                          valid_range: Optional[Dict[str, float]] = None,
                          content: Optional[str] = None) -> Dict[str, Any]:
    """Train a COP model on heat pump data, as the page's "Train from my
    data": a neural network ("nn", most accurate), a polynomial ("poly",
    degree 2 or 3) or a linear regression ("linear"); the regressions return
    their formula. file_path: CSV, Excel (sheet: which one; default the
    first with a COP column) or Parquet, one operating point per row; with
    content (the file, base64) file_path only names it. mapping: role → column name. Required: T_source_out
    (source outlet / return), T_sink_out (sink outlet / supply), COP.
    Optional: T_source_in and T_sink_in (both or neither: four-temperature
    model), medium, refrigerant, stages (number of compressors). Up to 10,000
    rows are used; 20 % are held back for the test metrics. The model is
    offered over the data's range with the sink capped at 180 °C; valid_range
    ({"T_source_min", "T_source_max", "T_sink_min", "T_sink_max"}) sets it. Use the model by
    name in analyse_project(custom_model=...) or live_use_cop_model; online
    the name gets a short suffix so users do not overwrite each other's.
    Only available when the server runs the COP training module."""
    file_name, data = _read_input(file_path, content)
    if files.HOSTED:
        name = f"{name} {secrets.token_hex(2)}"
    out = await api.request("POST", "/api/analysis/cop-model/train",
                            files={"file": (file_name, data)},
                            data={"mapping": json.dumps(mapping), "name": name,
                                  "model_type": model_type, "degree": str(degree),
                                  **({"sheet": sheet} if sheet else {})})
    spec = out["spec"]
    if valid_range:
        spec["envelope"] = {**spec["envelope"], **valid_range}
    _keep(_models, spec["name"], spec)
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


@tool
async def list_heat_pumps(project_id: str, real_only: bool = False, refrigerant: Optional[str] = None,
                          min_T_sink: Optional[float] = None, limit: int = 15,
                          include_limited: bool = False) -> List[Dict[str, Any]]:
    """The heat pumps the optimization found for the last analysis, best duty
    first (COP breaks ties). Source- and demand-limited points (off the
    profiles, hidden on the page by default) only with include_limited."""
    project_id = await _page(project_id)
    pts = _cached(project_id)["optimization"]["feasible_points"]
    pts = [p for p in pts if (include_limited or not (p.get("source_limited") or p.get("demand_limited")))
           and (not real_only or not p.get("theoretical"))
           and (refrigerant is None or p["refrigerant"].startswith(refrigerant))
           and (min_T_sink is None or p["T_sink"] >= min_T_sink)]
    pts.sort(key=lambda p: (-p["Q_demand"], -p["COP"]))
    return [_pump(p) for p in pts[:limit]]


@tool
async def economics_defaults() -> Dict[str, Any]:
    """The economic analysis inputs with their defaults (prices in ct/kWh,
    rates and shares in %), and the reference-heater presets."""
    return await api.get("/api/analysis/economics/defaults")


@tool
async def economic_analysis(project_id: str, inputs: Optional[Dict[str, float]] = None,
                            reference_heater: Optional[Literal["gas", "oil", "eboiler"]] = None,
                            pumps: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """Economic analysis (VDI 4646 / VDI 2067) of a pump from the last
    analysis against the reference heater. pumps: [{"refrigerant", "T_sink"}]
    to pick (the best of them is analysed); default the optimization's best.
    Inputs not given keep their last value; a new reference_heater brings its
    own efficiency, fuel price and CO2 factor, as on the page."""
    project_id = await _page(project_id)
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


@tool
async def validate_cop_formula(expression: str, T_source: float = 60, T_sink: float = 110) -> Dict[str, Any]:
    """Check a custom COP formula and evaluate it at one point. Variables and
    functions it may use are listed in the answer."""
    return await api.post("/api/analysis/cop-formula/validate",
                          json={"expression": expression, "T_source": T_source, "T_sink": T_sink})


@tool
async def generate_report(project_id: str, file_path: Optional[str] = None,
                          language: Literal["en", "de"] = "en") -> str:
    """Write the HTML report of the last analysis (data collection, maps,
    pinch, heat pumps); online, a download link for the user. The page's
    report also carries the economic charts: for that, use
    live_generate_report on a connected page."""
    project_id = await _page(project_id)
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
        "scenarios": [scenario], "created_by_ai": True,
    })
    return _deliver(file_path, "heattransplan_report.html", html.encode("utf-8"), "text/html")


# ── Live: the open page ─────────────────────────────────────────────────────


async def _live(session_id: str, name: str, args: Optional[Dict[str, Any]] = None, timeout: float = 60) -> Any:
    out = await api.post(f"/api/live/sessions/{session_id}/commands",
                         json={"name": name, "args": args or {}, "timeout": timeout})
    return out["result"]


@tool
async def live_view(session_id: str) -> Dict[str, Any]:
    """What the page shows right now: page, project tree, every analysis
    input, key results, economics inputs and scenarios."""
    return await _live(session_id, "get_view")


@tool
async def live_results(session_id: str) -> Dict[str, Any]:
    """The page's full current results (pinch, heat pump integration,
    optimization, status quo). Large."""
    return await _live(session_id, "get_results")


@tool
async def live_command(session_id: str, command: str, args: Optional[Dict[str, Any]] = None,
                       timeout: float = 60) -> Any:
    """Run any page command; "list_commands" lists those available now (some
    exist only while their page is open). Commands: navigate {page: home |
    data-collection | potential-analysis}, set_language {lang}, set_theme
    {theme}, select_streams {all|none|process|subprocess|keys[], value}, undo, set_t_min
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
    wait_idle {timeout}, get_view, get_results. set_project, remove_site_plan,
    remove_subprocess_plan and delete_scenario ask the user on the page first."""
    if command in LIVE_CONFIRM:
        await _confirm(session_id, command, json.dumps(args or {}, ensure_ascii=False)[:80])
    return await _live(session_id, command, args, timeout)


@tool
async def live_navigate(session_id: str, page: Literal["home", "data-collection", "potential-analysis"]) -> Any:
    """Open a page of the app."""
    return await _live(session_id, "navigate", {"page": page})


@tool
async def live_wait(session_id: str, timeout: float = 60) -> Dict[str, Any]:
    """Wait until the page's analyses have finished, then return its view."""
    return await _live(session_id, "wait_idle", {"timeout": timeout}, timeout + 5)


@tool
async def live_select_streams(session_id: str, keys: Optional[List[str]] = None, value: bool = True,
                              all: bool = False, none: bool = False, process: Optional[int] = None,
                              subprocess: Optional[int] = None) -> Any:
    """Tick streams for the analysis. all or none first, then every stream
    of a process, of a subprocess, and the listed keys
    (stream_<subprocess>_<stream>), each set to value. Streams not named
    keep their tick. E.g. none=True, process=0: only process 0's streams.
    Returns the selected keys; a bad index or key says what exists."""
    args: Dict[str, Any] = {"value": value, "all": all, "none": none}
    for name, given in (("keys", keys), ("process", process), ("subprocess", subprocess)):
        if given is not None:
            args[name] = given
    return await _live(session_id, "select_streams", args)


@tool
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


@tool
async def live_select_heat_pumps(session_id: str, pumps: Optional[List[Dict[str, Any]]] = None,
                                 add: bool = False, clear: bool = False) -> Any:
    """Pick heat pumps on the optimization chart: [{"refrigerant": ..., "T_sink": ...}]
    (T_sink left out: every point of that refrigerant; refrigerant left out:
    everything at that sink temperature, as a click on the chart). add keeps
    the current picks; clear removes all."""
    return await _live(session_id, "select_heat_pumps", {"points": pumps or [], "add": add, "clear": clear})


@tool
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


@tool
async def live_set_economics(session_id: str, inputs: Optional[Dict[str, float]] = None,
                             reference_heater: Optional[Literal["gas", "oil", "eboiler"]] = None) -> Any:
    """Change the economic analysis inputs on the page (see economics_defaults).
    A new reference_heater brings its own efficiency, fuel price and CO2
    factor, as picking it on the page does; inputs given win."""
    args: Dict[str, Any] = {"form": inputs or {}}
    if reference_heater:
        args["ref_type"] = reference_heater
    return await _live(session_id, "set_economics", args)


@tool
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


@tool
async def live_save_scenario(session_id: str, name: Optional[str] = None) -> Any:
    """Save the current selection and results as a scenario for comparison."""
    return await _live(session_id, "save_scenario", {"name": name} if name else {})


@tool
async def live_generate_report(session_id: str, file_path: Optional[str] = None) -> str:
    """The page's full HTML report, economics included, written to a file;
    online, a download link for the user. The page has to be on
    potential-analysis."""
    out = await _live(session_id, "generate_report", timeout=180)
    return _deliver(file_path, "heattransplan_report.html", out["html"].encode("utf-8"), "text/html")


@tool
async def live_load_site_plan(session_id: str, file_path: str, subprocess_key: Optional[str] = None,
                              content: Optional[str] = None) -> Any:
    """Load a site plan (PNG, JPG or PDF) onto the page's map, placed to fill
    the view, or with subprocess_key ("g<process>" / "s<subprocess>") as that
    diagram's background. The page has to be on data-collection. With
    content (the file, base64) file_path only names it. The user can also
    load it on the page themselves."""
    name, data = _read_input(file_path, content)
    args: Dict[str, Any] = {
        "data": base64.b64encode(data).decode(),
        "filename": name,
        "mime": mimetypes.guess_type(name)[0] or "",
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
