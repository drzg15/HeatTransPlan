"""Economic analysis of a heat pump (VDI 4646 / VDI 2067), as numbers."""

from dataclasses import asdict
from typing import Any, Dict, Optional

from app.services.economics.formulas import PAYBACK_HORIZON, el_price, fuel_price, vdi_specific_cost
from app.services.economics.model import DEFAULTS, PRESETS, economics


def economics_payload(out: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """The numbers as JSON for the page, the report and the MCP server."""
    if out is None:
        return None
    core = out["core"]
    inp = core["inp"]
    size = out["size"]
    return {
        "pump": core["pump"],
        "points": core["points"],
        "inputs": asdict(inp),
        "refSys": asdict(core["refSys"]),
        "ref": core["ref"],
        "specTotal": core["specTotal"],
        "variants": [asdict(v) for v in core["variants"]],
        "results": core["results"],
        "breakEven": core["breakEven"],
        # VDI 4646 cost function at the pump's size, for comparison.
        "vdiSpecificCost": [vdi_specific_cost(p.Q_demand) for p in core["points"]],
        # Price paths for years 0..T, €/kWh.
        "prices": {
            "fuel": [fuel_price(inp, k) for k in range(inp.T + 1)],
            "el": [el_price(inp, k) for k in range(inp.T + 1)],
        },
        "horizon": PAYBACK_HORIZON,
        "sensitivity": out["sensitivity"],
        "size": {
            "sizes": [{"point": s["p"], "npv": s["npv"]} for s in size["sizes"]],
            "optimum": {"point": size["optimum"]["p"], "npv": size["optimum"]["npv"]} if size["optimum"] else None,
        },
        "npv": out["npv"],
    }


__all__ = ["DEFAULTS", "PRESETS", "economics", "economics_payload"]
