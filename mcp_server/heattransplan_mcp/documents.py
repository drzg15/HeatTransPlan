"""Text and tables out of the documents a user hands over (Word, PowerPoint,
Excel, CSV), so any agent can read them, not only those that open Office
files themselves. Office files are zipped XML: the standard library does."""

from __future__ import annotations

import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, List

MAX_ROWS = 500  # per sheet; enough for stream lists, not a data dump


def _name(el: ET.Element) -> str:
    return el.tag.rsplit("}", 1)[-1]


def _text(el: ET.Element) -> str:
    return "".join(t.text or "" for t in el.iter() if _name(t) == "t").strip()


def _blocks(el: ET.Element, out: List[Any]) -> None:
    """Paragraphs as strings and tables as row lists, in document order.
    Word (w:) and PowerPoint (a:) use the same names: p, t, tbl, tr, tc."""
    for child in el:
        kind = _name(child)
        if kind == "tbl":
            rows = [[_text(c) for c in tr if _name(c) == "tc"] for tr in child if _name(tr) == "tr"]
            out.append({"table": rows})
        elif kind == "p":
            if text := _text(child):
                out.append(text)
        else:
            _blocks(child, out)


def _docx(z: zipfile.ZipFile) -> Dict[str, Any]:
    content: List[Any] = []
    _blocks(ET.fromstring(z.read("word/document.xml")), content)
    return {"content": content}


def _pptx(z: zipfile.ZipFile) -> Dict[str, Any]:
    names = [n for n in z.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)]
    slides = []
    for n in sorted(names, key=lambda n: int(re.search(r"\d+", n.rsplit("/", 1)[1]).group())):
        content: List[Any] = []
        _blocks(ET.fromstring(z.read(n)), content)
        slides.append({"slide": len(slides) + 1, "content": content})
    return {"slides": slides}


def _col(ref: str) -> int:
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group():
        n = n * 26 + ord(ch) - 64
    return n - 1


def _xlsx(z: zipfile.ZipFile) -> Dict[str, Any]:
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    rel = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        shared = [_text(si) for si in ET.fromstring(z.read("xl/sharedStrings.xml"))]
    targets = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    sheets = []
    for sheet in ET.fromstring(z.read("xl/workbook.xml")).iterfind("m:sheets/m:sheet", ns):
        target = targets[sheet.get(rel)].lstrip("/")
        path = target if target.startswith("xl/") else f"xl/{target}"
        rows: List[List[Any]] = []
        total = 0
        for row in ET.fromstring(z.read(path)).iterfind(".//m:row", ns):
            total += 1
            if len(rows) >= MAX_ROWS:
                continue
            cells: List[Any] = []
            for c in row.iterfind("m:c", ns):
                i = _col(c.get("r")) if c.get("r") else len(cells)
                v = c.find("m:v", ns)
                kind = c.get("t")
                if kind == "s" and v is not None:
                    value: Any = shared[int(v.text)]
                elif kind == "inlineStr":
                    value = _text(c)
                elif v is None or v.text is None:
                    value = None
                elif kind in ("str", "e", "b"):
                    value = v.text
                else:
                    value = float(v.text)
                    value = int(value) if value.is_integer() else value
                cells.extend([None] * (i - len(cells)))
                cells.append(value)
            rows.append(cells)
        sheets.append({"sheet": sheet.get("name"), "rows": rows, "total_rows": total})
    return {"sheets": sheets}


READERS = {".docx": _docx, ".pptx": _pptx, ".xlsx": _xlsx, ".xlsm": _xlsx}


def read(file_path: str) -> Dict[str, Any]:
    path = Path(file_path).expanduser()
    suffix = path.suffix.lower()
    if suffix in (".csv", ".txt", ".md", ".tsv", ".json"):
        return {"file": path.name, "text": path.read_text(encoding="utf-8", errors="replace")}
    if suffix not in READERS:
        raise ValueError(f"Cannot read {suffix or 'this'} files; Word (.docx), PowerPoint (.pptx), "
                         "Excel (.xlsx) and text/CSV work. Save older .doc/.ppt/.xls in the new "
                         "format; read PDFs and images yourself if you can.")
    with zipfile.ZipFile(path) as z:
        return {"file": path.name, **READERS[suffix](z)}
