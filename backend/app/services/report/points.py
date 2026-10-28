"""Which heat pumps the report shows: the same picks the Potential Analysis
page makes for its chart and table."""

from typing import Any, Dict, List, Optional


def _q_source(p: Any) -> float:
    """Source duty of an integration point: what the evaporator draws."""
    return p.Q_demand * (p.COP - 1) / p.COP if p.COP else 0.0


def _on_profile(points: List[Any]) -> List[Any]:
    """The points the page plots with both limit filters off, which is its default.

    Source-limited points deliver less than the demand above T_sink, so they miss
    the sink profile; demand-limited ones leave waste heat unused at T_source, so
    they miss the source profile. Either way they sit off the curves and turn the
    chart into a cloud. If nothing is on profile, show everything rather than an
    empty chart — the same fallback the page makes.
    """
    on = [p for p in points if not p.source_limited and not p.demand_limited]
    return on or points


def _best(points: List[Any]) -> Optional[Any]:
    """Most duty delivered, higher COP breaks a tie."""
    best = None
    for p in points:
        if best is None or p.Q_demand > best.Q_demand or (p.Q_demand == best.Q_demand and p.COP > best.COP):
            best = p
    return best


def _same_point(a: Any, b: Any) -> bool:
    return (a.refrigerant == b.refrigerant
            and abs(a.T_sink - b.T_sink) < 0.01
            and abs(a.T_source - b.T_source) < 0.01)


def _active_points(opt: Any, selected: List[Any]) -> List[Any]:
    """The pumps the chart highlights: the default one, plus whatever was clicked.

    The page keeps the default highlighted alongside the selection rather than
    replacing it, so the source-to-sink link never disappears from the chart.
    """
    points = _on_profile(getattr(opt, "feasible_points", None) or [])
    default = (_best([p for p in points if not p.theoretical])
               or _best(points)
               or getattr(opt, "max_q_point", None))
    active = [default] if default else []
    for p in selected:
        if not any(_same_point(p, a) for a in active):
            active.append(p)
    return active


def _headline_point(opt: Any, selected: List[Any]) -> Optional[Any]:
    """The pump that gets the box, the legs and the readouts.

    A click appends every machine at that sink temperature, so the last entry's
    temperature is the one just clicked; the best machine there represents it.
    """
    active = _active_points(opt, selected)
    if not active:
        return None
    last_temp = active[-1].T_sink
    return _best([p for p in active if abs(p.T_sink - last_temp) < 0.01])


def _table_points(opt: Any, selected: List[Any] = ()) -> List[Any]:
    """The heat pumps the page's optimization table lists.

    The best real machine per refrigerant type, plus the archetypes: Carnot as
    the thermodynamic ceiling, and the best of the rest. Listing every
    technology that fits at some sink temperature buries the table. A pump
    picked on the chart goes to the top, even when these rules would leave it
    out — it is the one being asked about.
    """
    points = _on_profile(getattr(opt, "feasible_points", None) or [])
    real = [p for p in points if not p.theoretical]
    rows = [_best([p for p in real if p.refrigerant_type == rt])
            for rt in dict.fromkeys(p.refrigerant_type for p in real)]

    theoretical = [p for p in points if p.theoretical]
    archetypes = [_best([p for p in theoretical if p.refrigerant == name])
                  for name in dict.fromkeys(p.refrigerant for p in theoretical)]
    carnot = next((p for p in archetypes if p and p.refrigerant == 'Carnot'), None)
    other = _best([p for p in archetypes if p and p.refrigerant != 'Carnot'])

    rows += [p for p in (carnot, other) if p]
    rows = [p for p in rows if p]
    rows.sort(key=lambda p: (p.Q_demand, p.COP), reverse=True)

    picked = [p for p in selected
              if not any(p.refrigerant == r.refrigerant and abs(p.T_sink - r.T_sink) < 0.01
                         for r in rows)]
    return picked + rows


def _thin_points(points: List[Any], keep: Optional[Any]) -> List[Any]:
    """Port of the chart's thinning on the Potential Analysis page.

    Dozens of candidates stack into a near-vertical line on a steep stretch of
    the sink profile, where tens of degrees of lift buy only a few kW. Keep the
    best COP per sink temperature, then one point per 2%-of-span duty bucket —
    the coolest sink temperature in each, i.e. the cheapest lift for that duty.
    """
    best: Dict[str, Any] = {}
    for p in points:
        key = f"{p.T_sink:.2f}_{p.refrigerant_type}" if not p.theoretical else f"{p.T_sink:.2f}_{p.refrigerant}"
        cur = best.get(key)
        if cur is None or p.COP > cur.COP:
            best[key] = p
    short_list = list(best.values())

    qs = [p.Q_demand for p in short_list]
    span = (max(qs) - min(qs)) if qs else 0
    if span <= 0:
        return short_list
    step = span * 0.02

    buckets: Dict[str, Any] = {}
    for p in short_list:
        key = f"{round(p.Q_demand / step)}_{p.refrigerant}"
        cur = buckets.get(key)
        if cur is None or p.T_sink < cur.T_sink or (p.T_sink == cur.T_sink and p.COP > cur.COP):
            buckets[key] = p
    thinned = list(buckets.values())

    # The active point is drawn on top regardless, so it must not be thinned
    # out of the cloud it belongs to and left standing alone.
    if keep is not None:
        k = f"{keep.refrigerant}_{keep.T_sink:.2f}"
        if all(f"{p.refrigerant}_{p.T_sink:.2f}" != k for p in thinned):
            match = [p for p in short_list if f"{p.refrigerant}_{p.T_sink:.2f}" == k]
            thinned += match
    return thinned
