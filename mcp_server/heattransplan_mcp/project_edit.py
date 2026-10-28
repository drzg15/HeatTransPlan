"""Project edits, each the same change the Data Collection page makes for the
same action (DataCollectionPage.tsx, ProcessGroupList.tsx, SubprocessCard.tsx,
utils/processIndex.ts). They work on the project JSON; the caller saves it.

Words: a "process" is a group on the map (proc_group_names / proc_groups);
a "subprocess" is an entry of `processes`, the thing that holds streams.
"""

from __future__ import annotations

import copy
import re
from typing import Any, Dict, List, Optional

from heattransplan_mcp.api import ApiError

State = Dict[str, Any]


class EditError(ApiError):
    """An edit the project does not allow (missing index, unknown unit, ...)."""


def _check_process(state: State, process: int) -> None:
    if not 0 <= process < len(state.get("proc_group_names", [])):
        raise EditError(f"There is no process {process}; there are {len(state.get('proc_group_names', []))}.")


def _check_subprocess(state: State, sub: int) -> None:
    if not 0 <= sub < len(state.get("processes", [])):
        raise EditError(f"There is no subprocess {sub}; there are {len(state.get('processes', []))}.")


def _new_subprocess(index: int, name: Optional[str] = None) -> Dict[str, Any]:
    return {
        "name": name or f"Subprocess {index + 1}",
        "lat": "",
        "lon": "",
        "box_scale": 1.5,
        "next": "",
        "hours": "",
        "extra_info": {"notes": ""},
        "streams": [],
        "children": [],
    }


def add_process(state: State, name: Optional[str] = None, lat: Any = None, lon: Any = None) -> int:
    """A new process with one empty subprocess, as the "Add process" button."""
    processes, groups, names = state.setdefault("processes", []), state.setdefault("proc_groups", []), state.setdefault("proc_group_names", [])
    new_idx = len(processes)
    processes.append(_new_subprocess(new_idx))
    groups.append([new_idx])
    names.append(name or f"Process {len(groups)}")
    gi = len(groups) - 1
    if lat is not None or lon is not None:
        coords = state.setdefault("proc_group_coordinates", {})
        coords[str(gi)] = {**coords.get(str(gi), {}), **({"lat": lat} if lat is not None else {}), **({"lon": lon} if lon is not None else {})}
    return gi


def update_process(state: State, process: int, name: Optional[str] = None, **coords: Any) -> None:
    """Rename a process or set its map fields (lat, lon, hours, box_scale)."""
    _check_process(state, process)
    if name is not None:
        state["proc_group_names"][process] = name
    fields = {k: v for k, v in coords.items() if v is not None}
    if fields:
        all_coords = state.setdefault("proc_group_coordinates", {})
        all_coords[str(process)] = {**all_coords.get(str(process), {}), **fields}


def _shift_key(key: str, drop: set, shift) -> Optional[str]:
    m = re.match(r"^stream_(\d+)(_.*)?$", key)
    if not m:
        return key
    p = int(m.group(1))
    return None if p in drop else f"stream_{shift(p)}{m.group(2) or ''}"


def _remove_subprocesses(state: State, removed: List[int], groups_after: List[List[int]]) -> None:
    """removeProcesses: drop the nodes, shift later indices in the groups, the
    stream selection and the per-subprocess diagram plans."""
    drop = set(removed)

    def shift(i: int) -> int:
        return i - sum(1 for r in removed if r < i)

    state["processes"] = [p for i, p in enumerate(state["processes"]) if i not in drop]
    state["proc_groups"] = [[shift(i) for i in g if i not in drop] for g in groups_after]
    sel = state.get("selected_streams") or {}
    state["selected_streams"] = {
        nk: v for k, v in sel.items() if (nk := _shift_key(k, drop, shift)) is not None
    }
    plans = state.get("canvas_plans") or {}
    if plans:
        moved = {}
        for k, v in plans.items():
            m = re.match(r"^s(\d+)$", k)
            if not m:
                moved[k] = v
            elif int(m.group(1)) not in drop:
                moved[f"s{shift(int(m.group(1)))}"] = v
        state["canvas_plans"] = moved


def delete_process(state: State, process: int) -> None:
    """Delete a process with all its subprocesses, as its delete button."""
    _check_process(state, process)
    groups = state["proc_groups"]
    removed = list(groups[process])
    groups_after = [g for i, g in enumerate(groups) if i != process]
    _remove_subprocesses(state, removed, groups_after)
    state["proc_group_names"] = [n for i, n in enumerate(state["proc_group_names"]) if i != process]
    coords = state.get("proc_group_coordinates") or {}
    state["proc_group_coordinates"] = {
        str(int(k) - 1 if int(k) > process else int(k)): v for k, v in coords.items() if int(k) != process
    }
    plans = state.get("canvas_plans") or {}
    if plans:
        moved = {}
        for k, v in plans.items():
            m = re.match(r"^g(\d+)$", k)
            if not m:
                moved[k] = v
            elif int(m.group(1)) != process:
                g = int(m.group(1))
                moved[f"g{g - 1 if g > process else g}"] = v
        state["canvas_plans"] = moved


def add_subprocess(state: State, process: int, name: Optional[str] = None) -> int:
    """A new subprocess in a process, as the "Add subprocess" button."""
    _check_process(state, process)
    new_idx = len(state["processes"])
    state["processes"].append(_new_subprocess(new_idx, name))
    state["proc_groups"][process] = [*state["proc_groups"][process], new_idx]
    return new_idx


def update_subprocess(state: State, sub: int, **fields: Any) -> None:
    """Set a subprocess's fields (name, lat, lon, hours, next, notes, ...)."""
    _check_subprocess(state, sub)
    node = state["processes"][sub]
    for k, v in fields.items():
        if v is None:
            continue
        if k == "notes":
            node.setdefault("extra_info", {})["notes"] = v
        else:
            node[k] = v


def delete_subprocess(state: State, sub: int) -> None:
    """Delete a subprocess; the last one in a process takes the process along."""
    _check_subprocess(state, sub)
    gi = next((i for i, g in enumerate(state["proc_groups"]) if sub in g), None)
    if gi is not None and len(state["proc_groups"][gi]) == 1:
        delete_process(state, gi)
        return
    groups_after = [[i for i in g if i != sub] for g in state["proc_groups"]]
    _remove_subprocesses(state, [sub], groups_after)


# Units the page offers per variable; the first is the default.
UNITS = {
    "Tin": ["°C", "°F", "K"],
    "Tout": ["°C", "°F", "K"],
    "ṁ": ["kg/s", "kg/min", "kg/h", "t/min", "t/h", "t/d"],
    "cp": ["kJ/(kg·K)", "J/(kg·K)"],
    "CP": ["kW/K", "W/K"],
}
STREAM_TYPES = ["product", "steam", "air", "water"]


def make_stream(name: str, values: Dict[str, Any], units: Optional[Dict[str, str]] = None,
                stream_type: str = "product") -> Dict[str, Any]:
    """A stream as the stream editor stores it: values as text by variable
    (Tin, Tout, ṁ, cp, CP), units only where they differ from the default."""
    if stream_type not in STREAM_TYPES:
        raise EditError(f"type must be one of {', '.join(STREAM_TYPES)}")
    sv = {}
    for k, v in values.items():
        if k not in UNITS:
            raise EditError(f"Unknown stream variable {k}; use {', '.join(UNITS)}")
        if v is not None:
            sv[k] = str(v)
    su = {}
    for k, u in (units or {}).items():
        if k not in UNITS or u not in UNITS[k]:
            raise EditError(f"Unit {u} for {k} is not offered; use {', '.join(UNITS.get(k, []))}")
        su[k] = u
    display = [k for k in ("Tin", "Tout", "ṁ", "cp") if k in sv or "CP" not in sv] + (["CP"] if "CP" in sv else [])
    return {"name": name, "type": stream_type, "display_vars": display, "stream_values": sv,
            **({"stream_units": su} if su else {})}


def add_stream(state: State, sub: int, stream: Dict[str, Any]) -> int:
    _check_subprocess(state, sub)
    streams = state["processes"][sub].setdefault("streams", [])
    streams.append(stream)
    return len(streams) - 1


def update_stream(state: State, sub: int, index: int, name: Optional[str] = None,
                  values: Optional[Dict[str, Any]] = None, units: Optional[Dict[str, str]] = None,
                  stream_type: Optional[str] = None) -> None:
    _check_subprocess(state, sub)
    streams = state["processes"][sub].get("streams", [])
    if not 0 <= index < len(streams):
        raise EditError(f"Subprocess {sub} has no stream {index}; it has {len(streams)}.")
    s = streams[index]
    merged = make_stream(
        name if name is not None else s.get("name", ""),
        {**(s.get("stream_values") or {}), **(values or {})},
        {**(s.get("stream_units") or {}), **(units or {})},
        stream_type or s.get("type", "product"),
    )
    s.update({k: v for k, v in merged.items() if k != "display_vars"})
    shown = set(s.get("display_vars") or []) | set(merged["display_vars"])
    s["display_vars"] = [k for k in ("Tin", "Tout", "ṁ", "cp", "CP") if k in shown]


def delete_stream(state: State, sub: int, index: int) -> None:
    """Delete a stream; later streams of the subprocess move up, selection too."""
    _check_subprocess(state, sub)
    streams = state["processes"][sub].get("streams", [])
    if not 0 <= index < len(streams):
        raise EditError(f"Subprocess {sub} has no stream {index}; it has {len(streams)}.")
    streams.pop(index)
    sel = state.get("selected_streams") or {}
    out = {}
    for k, v in sel.items():
        m = re.match(rf"^stream_{sub}_(\d+)$", k)
        if not m:
            out[k] = v
        elif int(m.group(1)) != index:
            si = int(m.group(1))
            out[f"stream_{sub}_{si - 1 if si > index else si}"] = v
    state["selected_streams"] = out


def stream_summary(s: Dict[str, Any]) -> Dict[str, Any]:
    """A stream's name, type and entered values with units, as typed in.
    (Older projects keep values in properties/values or legacy fields.)"""
    values = dict(s.get("stream_values") or {})
    for pk, var in (s.get("properties") or {}).items():
        v = (s.get("values") or {}).get(pk.replace("prop", "val"))
        if v not in (None, "") and var not in values:
            values[var] = v
    for var, legacy in (("Tin", "temp_in"), ("Tout", "temp_out"), ("ṁ", "mdot"), ("cp", "cp")):
        if var not in values and s.get(legacy) not in (None, ""):
            values[var] = s[legacy]
    units = {k: (s.get("stream_units") or {}).get(k, UNITS[k][0]) for k in values if k in UNITS}
    return {"name": s.get("name"), "type": s.get("type"), "values": values, "units": units}


def overview(state: State) -> Dict[str, Any]:
    """The project as a tree an AI can read: processes, subprocesses, streams
    with their keys (for selecting them) and values."""
    groups = []
    for gi, name in enumerate(state.get("proc_group_names", [])):
        coords = (state.get("proc_group_coordinates") or {}).get(str(gi), {})
        subs = []
        for pi in state.get("proc_groups", [])[gi] if gi < len(state.get("proc_groups", [])) else []:
            node = state["processes"][pi] if pi < len(state.get("processes", [])) else {}
            subs.append({
                "subprocess": pi,
                "name": node.get("name"),
                "lat": node.get("lat"),
                "lon": node.get("lon"),
                "streams": [
                    {"stream": si, "key": f"stream_{pi}_{si}", **stream_summary(s)}
                    for si, s in enumerate(node.get("streams") or [])
                ],
            })
        groups.append({"process": gi, "name": name, "lat": coords.get("lat"), "lon": coords.get("lon"),
                       "subprocesses": subs})
    return {
        "processes": groups,
        "selected_streams": [k for k, v in (state.get("selected_streams") or {}).items() if v],
        "t_min": state.get("t_min"),
        "notes": state.get("project_notes", ""),
        "has_site_plan": bool(state.get("site_plan")),
        "subprocess_plans": list((state.get("canvas_plans") or {}).keys()),
    }


def clone(state: State) -> State:
    return copy.deepcopy(state)
