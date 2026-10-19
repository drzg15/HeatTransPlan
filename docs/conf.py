import json
import sys
from pathlib import Path

DOCS = Path(__file__).resolve().parent
sys.path.insert(0, str(DOCS / "_ext"))

# -- Project information -------------------------------------------------------
project = "HeatTransPlan"
copyright = "2024, HeatTransPlan Contributors"
author = "HeatTransPlan Contributors"

# -- General configuration -----------------------------------------------------
extensions = [
    "myst_parser",
    "sphinx_togglebutton",
    "sphinx_copybutton",
    "sphinxcontrib.mermaid",
    "codelinks",  # {code}`path#symbol` → GitHub, at the symbol's current line
]

# MyST options
myst_enable_extensions = [
    "dollarmath",       # inline $...$ and display $$...$$ LaTeX
    "colon_fence",      # ::: directives
    "deflist",          # definition lists
]
myst_fence_as_directive = ["mermaid"]
# Anchors for headings down to ###, so pages can link to a section.
myst_heading_anchors = 3


# Source file suffixes
source_suffix = {
    ".rst": "restructuredtext",
    ".md": "markdown",
}

# -- HTML output ---------------------------------------------------------------
html_theme = "sphinx_book_theme"
html_title = "HeatTransPlan — Calculation Logic"
html_theme_options = {
    "repository_url": "https://github.com/drzg15/HeatTransPlan",
    "use_repository_button": True,
    "show_toc_level": 2,
    "navigation_with_keys": True,
}
html_static_path = ["_static"]
html_css_files = ["custom.css"]

# Toggle-button defaults: collapsed by default, show "▶ Show code" hint
togglebutton_hint = "Show implementation"
togglebutton_hint_hide = "Hide implementation"

# Code copy button — skip the prompt character
copybutton_prompt_text = r">>> |\.\.\. "
copybutton_prompt_is_regexp = True

# Don't complain about missing includes from backend source
exclude_patterns = ["_build", "_generated", "Thumbs.db", ".DS_Store"]


# -- Generated pages -----------------------------------------------------------
# The refrigerant limits come from the same file the optimizer loads, so the
# table can never disagree with what the app actually uses.

def _write_refrigerant_table(app):
    ranges = json.loads((DOCS.parent / "models" / "cop" / "cop_ranges.json").read_text(encoding="utf-8"))
    header = (
        "| Name | Medium sink | Refrigerant type | HP stages | $T_{src\\,min}$ (°C) | $T_{src\\,max}$ (°C) "
        "| $T_{sink\\,min}$ (°C) | $T_{sink\\,max}$ (°C) | $COP_{min}$ | $COP_{max}$ |\n"
        "|---|---|---|---|---|---|---|---|---|---|\n"
    )
    rows = "".join(
        f"| {a['name']} | {a['medium_sink']} | {a['refrigerant_type']} | {a['hp_level']} "
        f"| {a['T_src_min']:.1f} | {a['T_src_max']:.1f} | {a['T_sink_min']:.1f} | {a['T_sink_max']:.1f} "
        f"| {a['cop_min']:.3f} | {a['cop_max']:.3f} |\n"
        for a in ranges["alternatives"]
    )
    out = DOCS / "_generated"
    out.mkdir(exist_ok=True)
    (out / "refrigerant_limits_table.md").write_text(header + rows, encoding="utf-8")


def setup(app):
    app.connect("builder-inited", _write_refrigerant_table)
