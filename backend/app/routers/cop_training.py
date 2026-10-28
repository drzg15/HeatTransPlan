"""
COP training router — upload heat pump data, map its columns, train a COP
network. Only mounted while the module is switched on (COP_TRAINING_ENABLED).
"""

import json
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import ValidationError

from app.models.cop_training import ColumnMapping
from app.services.cop_training import data as cop_data
from app.services.cop_training import model as cop_model

router = APIRouter()


@router.post("/inspect")
async def inspect_data(file: UploadFile = File(...), sheet: Optional[str] = Form(None)):
    """The uploaded table's columns, row count, a preview, and a first guess
    of which column holds what. For Excel: its sheets and the one read
    (`sheet`, or the first with a COP column)."""
    content = await file.read()
    name = file.filename or ""
    try:
        sheet = sheet or cop_data.default_sheet(name, content)
        df = cop_data.read_table(name, content, sheet)
        return cop_data.inspect(df, cop_data.sheets(name, content), sheet)
    except cop_data.DataError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/train")
def train_model(
    file: UploadFile = File(...),
    mapping: str = Form(...),
    name: str = Form("My COP model"),
    model_type: str = Form("nn"),
    degree: int = Form(2),
    sheet: Optional[str] = Form(None),
):
    """Train a COP model on the mapped columns: a neural network ("nn"), a
    polynomial ("poly", degree 2 or 3) or a linear regression ("linear").
    Up to 10,000 rows, 20 % held back for the test. Returns the model as
    plain numbers (with the formula for a regression), its test metrics and
    predicted-vs-actual points."""
    try:
        cols = ColumnMapping(**json.loads(mapping))
    except (ValueError, ValidationError) as exc:
        raise HTTPException(422, f"Column mapping: {exc}") from exc
    content = file.file.read()
    try:
        df = cop_data.read_table(file.filename or "", content, sheet)
        return cop_model.train(df, cols, name[:60], model_type, degree)
    except cop_data.DataError as exc:
        raise HTTPException(400, str(exc)) from exc
