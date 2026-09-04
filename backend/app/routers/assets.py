"""
Assets router — serve process models and example files.
"""

import json
from fastapi import APIRouter, HTTPException
from app.config import PROCESS_MODELS_PATH, EXAMPLES_DIR

router = APIRouter()


@router.get("/models")
async def get_process_models():
    """Return the process model hierarchy from process_models.json."""
    try:
        with open(PROCESS_MODELS_PATH, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(404, "Process models file not found")


@router.get("/examples")
async def list_examples():
    """List available example files."""
    if not EXAMPLES_DIR.exists():
        return {"examples": []}
    files = [f.name for f in EXAMPLES_DIR.iterdir() if f.suffix == ".json"]
    return {"examples": files}


@router.get("/examples/{filename}")
async def get_example(filename: str):
    """Get a specific example file."""
    # `filename` comes straight from the URL. Without resolving it and checking
    # it is still inside EXAMPLES_DIR, a name containing ".." walks up out of
    # the directory and serves any .json file on the server's disk.
    examples_dir = EXAMPLES_DIR.resolve()
    filepath = (examples_dir / filename).resolve()
    if not filepath.is_relative_to(examples_dir):
        raise HTTPException(404, "Example not found")
    if not filepath.is_file() or filepath.suffix != ".json":
        raise HTTPException(404, "Example not found")
    with open(filepath, "r") as f:
        return json.load(f)
