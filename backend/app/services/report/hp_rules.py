"""Which heat pumps the report shows: a port of the Potential Analysis page's rules."""

from __future__ import annotations
import math
from decimal import ROUND_HALF_UP, Decimal
from types import SimpleNamespace
from typing import Any, List, Optional, Tuple


def _q_source(p: Any) -> float:
    """Source duty of an integration point: what the evaporator draws."""
    return p.Q_demand * (p.COP - 1) / p.COP if p.COP else 0.0


# --- Which heat pumps to show -------------------------------------------------
#
# A function-for-function port of frontend/src/components/analysis/hpRules.ts,
# the rules the Potential Analysis page applies. Both implementations are tested
# against contracts/hp_rules.json, so a rule changed on one side and not the
# other fails a test instead of the report quietly disagreeing with the page.
#
# The report has no filter controls, so it applies the page's defaults: every
# filter on 'All', archetypes shown, off-profile points hidden from the chart.

def _beats(p: Any, best: Optional[Any]) -> bool:
    """Most duty delivered, higher COP breaks a tie."""
    return best is None or p.Q_demand > best.Q_demand or (
        p.Q_demand == best.Q_demand and p.COP > best.COP)


def _best(points: List[Any]) -> Optional[Any]:
    best = None
    for p in points:
        if _beats(p, best):
            best = p
    return best


def _is_same_point(a: Any, b: Any) -> bool:
    return (a.refrigerant == b.refrigerant and a.medium_sink == b.medium_sink
            and a.T_sink == b.T_sink and a.T_source == b.T_source)


def _js_round(x: float) -> int:
    """JavaScript's Math.round: halves go up. Python's round() sends them to the
    even neighbour, which put 50.5 in a different thinning bucket than the page."""
    return math.floor(x + 0.5)


def _js_fixed2(x: float) -> str:
    """JavaScript's toFixed(2), which rounds an exact half up where Python's
    format rounds it to even (0.125 → '0.13', not '0.12'). Sink temperatures
    are positive, where half-up and JavaScript's 'larger n' agree."""
    return str(Decimal(x).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _chart_points(points: List[Any]) -> List[Any]:
    """chartPointsOf, with both off-profile boxes unticked.

    Source-limited points miss the sink profile and demand-limited ones the
    source profile, so the page keeps them off the chart unless asked. If
    nothing is on profile, it shows everything rather than an empty chart.
    """
    on_profile = [p for p in points if not p.source_limited and not p.demand_limited]
    return on_profile if on_profile else points


def _default_highlight(chart_points: List[Any], max_q: Optional[Any]) -> Optional[Any]:
    """defaultHighlightOf: the pump highlighted before anything is clicked.

    The backend's max-Q point if it is a real machine and visible; otherwise
    the best real machine on the chart, else the best point at all. Carnot
    wins on COP at the top duty and would otherwise always take the box.
    """
    if (max_q is not None and not max_q.theoretical
            and any(_is_same_point(p, max_q) for p in chart_points)):
        return max_q
    best_real = _best([p for p in chart_points if not p.theoretical])
    return best_real if best_real is not None else _best(chart_points)


def _table_rows(points: List[Any], selected: List[Any]) -> List[Any]:
    """tableRowsOf with archetypes shown, then the page's default sort.

    The best real machine per refrigerant type — off-profile ones included,
    the page keeps those in the table. Archetypes by technology: Carnot as the
    ceiling, and of the rest only the one with the most duty. Picked pumps are
    added. Rows come out in the order the page opens the table in
    (DEFAULT_TABLE_SORT): most duty first, then COP, exact ties in the order
    they were built.
    """
    by_type: Dict[str, Any] = {}
    by_technology: Dict[str, Any] = {}
    for p in points:
        group, k = (by_technology, p.refrigerant) if p.theoretical else (by_type, p.refrigerant_type)
        if _beats(p, group.get(k)):
            group[k] = p

    archetypes = list(by_technology.values())
    carnot = next((p for p in archetypes if p.refrigerant == "Carnot"), None)
    others = sorted((p for p in archetypes if p.refrigerant != "Carnot"),
                    key=lambda p: (-p.Q_demand, -p.COP))
    rows = [p for p in (carnot, others[0] if others else None) if p] + list(by_type.values())

    for sp in selected:
        if not any(p.refrigerant == sp.refrigerant and p.T_sink == sp.T_sink for p in rows):
            rows.insert(0, sp)
    return sorted(rows, key=lambda p: (-p.Q_demand, -p.COP))


def _thinned_cloud(points: List[Any], highlight: Optional[Any],
                   selected: List[Any]) -> Tuple[List[Any], List[Any]]:
    """thinnedCloudOf: the points the chart draws, as (real, theoretical).

    Real machines keep the best COP per sink temperature and refrigerant type;
    archetypes per sink temperature and technology. Both are then thinned by
    duty — on a steep stretch dozens of points stack at practically one power,
    so each 2%-of-span step keeps its coolest sink, the cheapest lift for that
    duty. Whatever is highlighted stays in the cloud it belongs to.
    """
    def collapse(pts: List[Any]) -> List[Any]:
        qs = [p.Q_demand for p in pts]
        span = (max(qs) - min(qs)) if qs else 0
        if span <= 0:
            return pts
        step = span * 0.02
        per_bucket: Dict[str, Any] = {}
        for p in pts:
            k = f"{_js_round(p.Q_demand / step)}_{p.refrigerant}"
            cur = per_bucket.get(k)
            if cur is None or p.T_sink < cur.T_sink or (p.T_sink == cur.T_sink and p.COP > cur.COP):
                per_bucket[k] = p
        return list(per_bucket.values())

    def active_key(p: Any) -> str:
        return f"{p.refrigerant}_{_js_fixed2(p.T_sink)}"

    active_keys = {active_key(p) for p in (selected or ([highlight] if highlight else []))}

    def keep_active(pts: List[Any], thinned: List[Any]) -> List[Any]:
        have = {active_key(p) for p in thinned}
        return thinned + [p for p in pts if active_key(p) in active_keys and active_key(p) not in have]

    def best_cop_per(pts: List[Any], group: str) -> List[Any]:
        best: Dict[str, Any] = {}
        for p in pts:
            k = f"{_js_fixed2(p.T_sink)}_{getattr(p, group)}"
            if k not in best or p.COP > best[k].COP:
                best[k] = p
        return list(best.values())

    real = best_cop_per([p for p in points if not p.theoretical], "refrigerant_type")
    theoretical = best_cop_per([p for p in points if p.theoretical], "refrigerant")
    return keep_active(real, collapse(real)), keep_active(theoretical, collapse(theoretical))


def _active_points(highlight: Optional[Any], selected: List[Any]) -> List[Any]:
    """activePointsOf: the default highlight plus whatever was clicked."""
    out = [highlight] if highlight else []
    for sp in selected:
        if not any(p.refrigerant == sp.refrigerant and abs(p.T_sink - sp.T_sink) < 0.01
                   and abs(p.T_source - sp.T_source) < 0.01 for p in out):
            out.append(sp)
    return out


def _box_point(active: List[Any]) -> Optional[Any]:
    """boxPointOf: the best machine at the last-clicked sink temperature."""
    if not active:
        return None
    last = active[-1].T_sink
    return _best([p for p in active if abs(p.T_sink - last) < 0.01])


def _hp_view(opt: Any, selected: List[Any]) -> SimpleNamespace:
    """Everything the report draws about heat pumps, from the page's rules."""
    points = list(getattr(opt, "feasible_points", None) or [])
    chart = _chart_points(points)
    highlight = _default_highlight(chart, getattr(opt, "max_q_point", None))
    active = _active_points(highlight, selected)
    real, theoretical = _thinned_cloud(chart, highlight, selected)
    return SimpleNamespace(
        chart_points=chart, highlight=highlight, active=active, box=_box_point(active),
        cloud_real=real, cloud_theoretical=theoretical, table=_table_rows(points, selected),
    )
