"""Number formatting and markup shared by the report sections."""

from html import escape
from typing import Any, Dict


def _part(n: int, texts: Dict[str, str], note: str = "", anchor: str = "") -> str:
    """The banner of one of the app's numbered steps, as the page shows it:
    number, title, and what it takes as input (or a note, e.g. the pump)."""
    sub = escape(note) if note else texts[f'part_{n}_in']
    id_attr = f" id='{anchor}'" if anchor else ""
    return (f"<div class='part'{id_attr}><span class='part-num'>{n}</span>"
            f"<h2>{texts[f'part_{n}']}</h2><span class='part-in'>{sub}</span></div>")


def _fmt(val: Any, decimals: int = 2) -> str:
    """Format a numeric value, return '' if None."""
    if val is None or val == '':
        return ''
    try:
        return f"{float(val):.{decimals}f}"
    except (ValueError, TypeError):
        return str(val)


def _de(val: float) -> str:
    """Whole number German-style, as the page shows it: 1.234.567."""
    return f"{val:,.0f}".replace(",", ".")
