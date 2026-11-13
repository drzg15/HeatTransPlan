"""
Processes router — the address search for placing processes on the map.

Projects live in the page, never on the server; the MCP server's tools edit
them there, one step at a time. The per-item edit routes
that used to live here were unused and left the stream selection wrong after a
delete; they are in scratch/unused_code/backend/app/routers/.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.utils.geo_utils import geocode_address

router = APIRouter()


class GeoQuery(BaseModel):
    query: str


@router.post("/geo/search")
def geo_search(body: GeoQuery):
    """Proxy to Nominatim geocoding. Plain `def`: the lookup blocks for up to
    10 s, and in the thread pool it blocks no one else."""
    try:
        results = geocode_address(body.query)
        return {"results": results}
    except Exception as e:
        raise HTTPException(502, f"Geocoding failed: {e}")
