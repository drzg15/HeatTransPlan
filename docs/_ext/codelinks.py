"""
Links from the documentation to the code it describes.

    {code}`backend/app/services/analysis_service.py#run_pinch`
    {code}`backend/app/modules/pinch/pinch.py#Pinch.construct_heat_cascade`
    {code}`frontend/src/components/analysis/hpRules.ts#tableRowsOf`
    {code}`the ranges file <models/cop/cop_ranges.json>`

renders a link to that file on GitHub, at the line where the symbol is
defined. The line is looked up when the docs are built, so it is right for
the code being documented however much the file has changed since the page
was written. On GitHub Actions the link pins the exact commit being built
(GITHUB_SHA); elsewhere it points at main.

A file or symbol that cannot be found is a build warning, and CI builds with
warnings as errors: renaming a function the docs point at fails the build
instead of leaving a dead link.
"""

import os
import re
from pathlib import Path

from docutils import nodes

REPO_URL = "https://github.com/drzg15/HeatTransPlan"
ROOT = Path(__file__).resolve().parents[2]
REF = os.environ.get("GITHUB_SHA") or "main"

_PY_FUNC = r"^\s*(?:async\s+)?def\s+{name}\b"
_PY_OTHER = (r"^\s*class\s+{name}\b", r"^{name}\s*(?::[^=]*)?=")
_TS_FUNC = r"^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+{name}\b"
_TS_OTHER = (r"^\s*(?:export\s+)?(?:const|let|type|interface|class)\s+{name}\b",)


def _find(lines, patterns, name, start=0):
    for pattern in patterns:
        rx = re.compile(pattern.format(name=re.escape(name)))
        for i in range(start, len(lines)):
            if rx.search(lines[i]):
                return i
    return None


def find_symbol(path: Path, symbol: str):
    """(1-based line, is_callable) of `symbol` in `path`, or (None, False).

    `Class.method` finds the class, then the method after it.
    """
    lines = path.read_text(encoding="utf-8").splitlines()
    func, other = (_PY_FUNC, _PY_OTHER) if path.suffix == ".py" else (_TS_FUNC, _TS_OTHER)
    start = 0
    *owners, name = symbol.split(".")
    for owner in owners:
        i = _find(lines, other, owner, start)
        if i is None:
            return None, False
        start = i + 1
    i = _find(lines, (func,), name, start)
    if i is not None:
        return i + 1, True
    i = _find(lines, other, name, start)
    return (i + 1, False) if i is not None else (None, False)


def code_role(name, rawtext, text, lineno, inliner, options=None, content=None):
    m = re.match(r"^(.*?)\s*<([^<>]+)>$", text)
    title, target = (m.group(1), m.group(2)) if m else (None, text)
    path, _, symbol = target.partition("#")
    file = ROOT / path

    messages = []
    url = f"{REPO_URL}/blob/{REF}/{path}"
    label = title or path
    if not file.exists():
        messages.append(inliner.reporter.warning(f"{{code}} link to a missing file: {path}", line=lineno))
    elif symbol:
        line, is_callable = find_symbol(file, symbol)
        if line is None:
            messages.append(inliner.reporter.warning(f"{{code}} link: '{symbol}' not found in {path}", line=lineno))
        else:
            url += f"#L{line}"
        label = title or (f"{symbol}()" if is_callable else symbol)

    node = nodes.reference(rawtext, "", refuri=url, classes=["code-link"])
    node += nodes.literal(label, label)
    return [node], messages


def setup(app):
    app.add_role("code", code_role)
    return {"parallel_read_safe": True, "parallel_write_safe": True}
