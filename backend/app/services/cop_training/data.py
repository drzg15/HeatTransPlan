"""Reading the uploaded table: CSV (comma or semicolon, decimal point or
comma), Excel (any sheet) or Parquet, and guessing which column is which."""

from __future__ import annotations

import io
import re
from typing import Any, Dict, List, Optional

import pandas as pd

MAX_FILE_BYTES = 20 * 1024 * 1024
# Rows used for training. A small network with 2–4 temperature inputs stops
# improving well before this (the shipped model saw 3,468), and it keeps a
# training run to seconds. Larger files are sampled down, not rejected.
MAX_ROWS = 10_000
MIN_ROWS = 30


class DataError(ValueError):
    pass


def _numeric(col: pd.Series) -> pd.Series:
    """Numbers as written, with a decimal comma allowed."""
    if col.dtype.kind in "if":
        return col.astype(float)
    text = col.astype(str).str.strip().str.replace(" ", "", regex=False)
    if text.str.contains(r"^-?\d{1,3}(?:\.\d{3})*,\d+$|^-?\d+,\d+$", regex=True).any():
        text = text.str.replace(".", "", regex=False).str.replace(",", ".", regex=False)
    return pd.to_numeric(text, errors="coerce")


EXCEL = (".xlsx", ".xlsm")


def sheets(filename: str, content: bytes) -> List[str]:
    """The sheets of an Excel file; empty for other files."""
    if not filename.lower().endswith(EXCEL):
        return []
    try:
        return pd.ExcelFile(io.BytesIO(content)).sheet_names
    except Exception as exc:  # noqa: BLE001 - any parser failure is the file's
        raise DataError(f"The file could not be read: {exc}") from exc


def default_sheet(filename: str, content: bytes) -> Optional[str]:
    """The first sheet with a COP column (parameter studies often keep their
    inputs on the first sheet and the results on another), else the first."""
    names = sheets(filename, content)
    for name in names:
        head = pd.read_excel(io.BytesIO(content), sheet_name=name, nrows=0)
        if any(re.search(r"\bcop\b", str(c).lower()) for c in head.columns):
            return name
    return names[0] if names else None


def read_table(filename: str, content: bytes, sheet: Optional[str] = None) -> pd.DataFrame:
    if len(content) > MAX_FILE_BYTES:
        raise DataError(f"The file is larger than {MAX_FILE_BYTES // (1024 * 1024)} MB.")
    name = filename.lower()
    try:
        if name.endswith(EXCEL):
            df = pd.read_excel(io.BytesIO(content), sheet_name=sheet or default_sheet(filename, content))
        elif name.endswith((".csv", ".txt", ".tsv")):
            df = pd.read_csv(io.BytesIO(content), sep=None, engine="python", encoding_errors="replace")
        elif name.endswith(".parquet"):
            df = pd.read_parquet(io.BytesIO(content))
        else:
            raise DataError("Upload a CSV, Excel (.xlsx) or Parquet file.")
    except DataError:
        raise
    except Exception as exc:  # noqa: BLE001 - any parser failure is the file's
        raise DataError(f"The file could not be read: {exc}") from exc
    df.columns = [str(c).strip() for c in df.columns]
    if df.empty or len(df.columns) < 3:
        raise DataError("The table needs at least three columns: two temperatures and the COP.")
    return df


# Name patterns per role, for a first guess of the mapping.
_GUESS = {
    "COP": [r"^cop$", r"\bcop\b"],
    "T_source_out": [r"r(ü|ue)cklauf.*quelle", r"source.*(out|return)", r"evap.*out", r"t_?src"],
    "T_sink_out": [r"vorlauf.*senke", r"sink.*(out|supply)", r"cond.*out", r"t_?sink"],
    "T_source_in": [r"vorlauf.*quelle", r"source.*(in|supply)", r"evap.*in"],
    "T_sink_in": [r"r(ü|ue)cklauf.*senke", r"sink.*(in|return)", r"cond.*in"],
    "medium": [r"medium", r"senke.*medium"],
    "refrigerant": [r"k(ä|ae)ltemittel", r"refrigerant", r"fluid"],
    "stages": [r"stufe", r"stage", r"compressor", r"verdichter"],
}


def guess_mapping(columns) -> Dict[str, Optional[str]]:
    taken, out = set(), {}
    for role, patterns in _GUESS.items():
        out[role] = None
        for pat in patterns:
            hit = next((c for c in columns if c not in taken and re.search(pat, c.lower())), None)
            if hit:
                out[role] = hit
                taken.add(hit)
                break
    return out


def inspect(df: pd.DataFrame, sheet_names: Optional[List[str]] = None,
            sheet: Optional[str] = None) -> Dict[str, Any]:
    # Numbers in (nearly) every row; a units row like "°C" does not spoil it.
    numeric = [c for c in df.columns if _numeric(df[c]).notna().mean() > 0.9]
    return {
        "sheets": sheet_names or [],
        "sheet": sheet,
        "columns": list(df.columns),
        "numeric_columns": numeric,
        "rows": len(df),
        "max_rows": MAX_ROWS,
        "min_rows": MIN_ROWS,
        # Empty cells as "", so the preview is valid JSON (no NaN).
        "preview": df.head(8).map(lambda v: "" if pd.isna(v) else str(v)).to_dict(orient="records"),
        "guess": guess_mapping(list(df.columns)),
    }
