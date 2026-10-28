"""Number formatting shared by the report sections."""

from typing import Any


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
