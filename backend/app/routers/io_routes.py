"""
I/O router — import/export JSON state and CSV.

Stateless, like the analysis endpoints: each call gets the project (or the
file) in the request and answers with the result. Nothing is kept on the
server.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from io import BytesIO, StringIO
from datetime import datetime
import json
import csv

from app.models.project import ProjectState

router = APIRouter()


# ---- JSON Import/Export ----

@router.post("/import-json")
async def import_json(file: UploadFile = File(...)):
    """
    Read a project file (same format as save_app_state()) and return it as a
    checked project state. Nothing is kept.
    """
    try:
        content = await file.read()
        data = json.loads(content.decode("utf-8"))
        return {"state": ProjectState(**data)}
    except Exception as e:
        raise HTTPException(400, f"Failed to import JSON: {e}")


@router.post("/import-json-body")
async def import_json_body(state: ProjectState):
    """Check a project state sent as the JSON body and return it. Nothing is
    kept."""
    return {"state": state}


@router.post("/export-json")
async def export_json(project: ProjectState):
    """The project sent, as a JSON download."""
    data = project.model_dump()
    content = json.dumps(data, indent=2).encode("utf-8")
    buf = BytesIO(content)
    filename = f"heattransplan_state_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    return StreamingResponse(
        buf,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---- CSV Export ----

@router.post("/export-csv")
async def export_csv(project: ProjectState):
    """
    The process data of the project sent, as CSV (one row per stream).
    Mirrors export_to_csv() from data_collection.py.
    """
    output = StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Process", "Subprocess", "Process Latitude", "Process Longitude", "Process Hours",
        "Next Connection", "Stream", "Stream Type",
        "Stream Tin (°C)", "Stream Tout (°C)", "Stream mdot", "Stream cp", "Stream CP",
        "Stream Water Content In", "Stream Water Content Out",
        "Stream Density", "Stream Pressure",
        "Notes",
    ])

    # Build subprocess → group mapping
    subprocess_to_group = {}
    for gi, group in enumerate(project.proc_groups):
        for si in group:
            subprocess_to_group[si] = gi

    for si, subprocess in enumerate(project.processes):
        sub_dict = subprocess.model_dump() if hasattr(subprocess, "model_dump") else dict(subprocess)
        sub_name = sub_dict.get("name") or f"Subprocess {si+1}"
        next_conn = sub_dict.get("next", "")

        # Process group info
        gi = subprocess_to_group.get(si)
        if gi is not None and gi < len(project.proc_group_names):
            proc_name = project.proc_group_names[gi]
            coords = project.proc_group_coordinates.get(str(gi), {})
            if hasattr(coords, "model_dump"):
                coords = coords.model_dump()
            proc_lat = coords.get("lat", "")
            proc_lon = coords.get("lon", "")
            proc_hours = coords.get("hours", "")
        else:
            proc_name, proc_lat, proc_lon, proc_hours = "", "", "", ""

        streams = sub_dict.get("streams", [])
        if not streams:
            writer.writerow([proc_name, sub_name, proc_lat, proc_lon, proc_hours, next_conn,
                             "", "", "", "", "", "", "", "", "", "", "", ""])
        else:
            for stream in streams:
                s = stream if isinstance(stream, dict) else dict(stream)
                sv = s.get("stream_values", {})
                writer.writerow([
                    proc_name, sub_name, proc_lat, proc_lon, proc_hours, next_conn,
                    s.get("name", ""), s.get("type", ""),
                    sv.get("Tin", s.get("temp_in", "")),
                    sv.get("Tout", s.get("temp_out", "")),
                    sv.get("ṁ", s.get("mdot", "")),
                    sv.get("cp", s.get("cp", "")),
                    sv.get("CP", ""),
                    sv.get("Water Content In", ""),
                    sv.get("Water Content Out", ""),
                    sv.get("Density", ""),
                    sv.get("Pressure", ""),
                    s.get("extra_info", {}).get("notes", "") if isinstance(s.get("extra_info"), dict) else "",
                ])

    content = output.getvalue().encode("utf-8")
    buf = BytesIO(content)
    filename = f"heattransplan_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---- CSV Import ----

@router.post("/import-csv")
async def import_csv(file: UploadFile = File(...)):
    """Read process data from CSV and return the processes; the caller puts
    them into its project. Nothing is kept."""
    try:
        import pandas as pd
        import io as _io

        content = await file.read()
        text = content.decode("utf-8")
        df = pd.read_csv(_io.StringIO(text))

        required = {"name", "next", "conntemp", "connm", "conncp", "stream_no", "mdot", "temp_in", "temp_out", "cp"}
        if not required.issubset(df.columns):
            raise HTTPException(400, f"CSV missing required columns. Need: {required}")

        from app.models.process import ProcessNode
        from app.models.stream import StreamModel

        proc_lookup = {}
        procs = []
        for _, row in df.iterrows():
            key = (row["name"], row["next"], row["conntemp"], row.get("product_tout", ""), row["connm"], row["conncp"])
            if key not in proc_lookup:
                p = ProcessNode(
                    name=str(row.get("name", "")),
                    level=1,
                    next=str(row.get("next", "")),
                    conntemp=str(row.get("conntemp", "")),
                    product_tout=str(row.get("product_tout", "")),
                    connm=str(row.get("connm", "")),
                    conncp=str(row.get("conncp", "")),
                )
                procs.append(p)
                proc_lookup[key] = p
            stream_no = row.get("stream_no")
            if pd.notna(stream_no):
                proc_lookup[key].streams.append(StreamModel(
                    mdot=str(row.get("mdot", "")),
                    temp_in=str(row.get("temp_in", "")),
                    temp_out=str(row.get("temp_out", "")),
                    cp=str(row.get("cp", "")),
                ))

        return {"imported_processes": len(procs),
                "processes": [p.model_dump() for p in procs]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"CSV import failed: {e}")
