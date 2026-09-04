"""
I/O router — import/export JSON state, CSV, and HTML report.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from io import BytesIO, StringIO
from datetime import datetime
import json
import csv

from app.models.project import ProjectState
from app.services import project_service

router = APIRouter()


# ---- JSON Import/Export ----

@router.post("/import-json")
async def import_json(file: UploadFile = File(...)):
    """
    Import a project state from a JSON file (same format as save_app_state()).
    Creates a new project and returns its ID.
    """
    try:
        content = await file.read()
        data = json.loads(content.decode("utf-8"))
        state = ProjectState(**data)
        project_id, project = project_service.create_project(state)
        return {"project_id": project_id, "state": project}
    except Exception as e:
        raise HTTPException(400, f"Failed to import JSON: {e}")


@router.post("/import-json-body")
async def import_json_body(state: ProjectState):
    """
    Import a project state from JSON body (for example loading).
    Creates a new project and returns its ID.
    """
    project_id, project = project_service.create_project(state)
    return {"project_id": project_id, "state": project}


@router.get("/export-json/{project_id}")
async def export_json(project_id: str):
    """Export the full project state as a JSON download."""
    project = project_service.get_project(project_id)
    if project is None:
        raise HTTPException(404, "Project not found")
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

@router.get("/export-csv/{project_id}")
async def export_csv(project_id: str):
    """
    Export all process data as CSV (one row per stream).
    Mirrors export_to_csv() from data_collection.py.
    """
    project = project_service.get_project(project_id)
    if project is None:
        raise HTTPException(404, "Project not found")

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

@router.post("/import-csv/{project_id}")
async def import_csv(project_id: str, file: UploadFile = File(...)):
    """Import process data from CSV."""
    project = project_service.get_project(project_id)
    if project is None:
        raise HTTPException(404, "Project not found")

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

        project.processes = procs
        project_service.update_project(project_id, project)
        return {"imported_processes": len(procs)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"CSV import failed: {e}")


# ---- HTML Report ----

@router.get("/export-report/{project_id}")
async def export_report(project_id: str):
    """
    Generate and download an HTML report.
    This is a simplified version — the full report generation from
    potential_analysis.py can be ported here progressively.
    """
    project = project_service.get_project(project_id)
    if project is None:
        raise HTTPException(404, "Project not found")

    html = _generate_report_html(project)
    buf = BytesIO(html.encode("utf-8"))
    filename = f"heattransplan_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
    return StreamingResponse(
        buf,
        media_type="text/html",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _generate_report_html(project: ProjectState) -> str:
    """Generate a basic HTML report from project state."""
    procs_html = ""
    for gi, gname in enumerate(project.proc_group_names):
        procs_html += f"<h3>{gname}</h3>"
        if gi < len(project.proc_groups):
            for si in project.proc_groups[gi]:
                if si < len(project.processes):
                    p = project.processes[si]
                    p_dict = p.model_dump() if hasattr(p, "model_dump") else dict(p)
                    procs_html += f"<h4>{p_dict.get('name', f'Subprocess {si+1}')}</h4>"
                    procs_html += "<table border='1' cellpadding='4' cellspacing='0'>"
                    procs_html += "<tr><th>Stream</th><th>Type</th><th>Tin</th><th>Tout</th><th>ṁ</th><th>cp</th></tr>"
                    for s in p_dict.get("streams", []):
                        sv = s.get("stream_values", {})
                        procs_html += (
                            f"<tr><td>{s.get('name','')}</td><td>{s.get('type','')}</td>"
                            f"<td>{sv.get('Tin', s.get('temp_in',''))}</td>"
                            f"<td>{sv.get('Tout', s.get('temp_out',''))}</td>"
                            f"<td>{sv.get('ṁ', s.get('mdot',''))}</td>"
                            f"<td>{sv.get('cp', s.get('cp',''))}</td></tr>"
                        )
                    procs_html += "</table>"

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>HeatTransPlan Report</title>
<style>
body {{ font-family: Arial, sans-serif; margin: 40px; font-size: 12px; }}
h1 {{ color: #2b8cbe; }} h2 {{ color: #333; }} h3 {{ color: #228b22; }}
h4 {{ color: #22228b; }}
table {{ border-collapse: collapse; margin: 10px 0; }}
th {{ background: #f0f0f0; }}
</style></head><body>
<h1>HeatTransPlan Report</h1>
<p>Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
<h2>Project Notes</h2>
<p>{project.project_notes or '(none)'}</p>
<h2>Process Data</h2>
{procs_html}
<h2>Analysis Notes</h2>
<p>{project.pinch_notes or '(none)'}</p>
</body></html>"""
