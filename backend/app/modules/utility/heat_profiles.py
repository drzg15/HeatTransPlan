"""
Source/sink heat profiles for heat pump integration.

Three levels of heat-recovery credit can be requested. They differ only in how
much internal heat exchange is assumed to happen before the heat pump is placed:

    net_load    Pocket-free GCC split into a source and a sink profile.
                Full internal recovery is credited, so the heat pump only sees
                the residual utility requirement. This is standard pinch
                practice and the default.

    uncascaded  Per-interval net loads straight from the problem table, with no
                cascading between intervals. Hot and cold streams are still
                netted *inside* an interval, but a surplus at a high temperature
                no longer covers a deficit further down. The difference against
                net_load is exactly the pocket heat.

    composite   Hot and cold composite curves, i.e. no recovery at all. Every
                stream duty has to be met by a utility (or the heat pump).

All curves use shifted temperatures and follow the orientation the
HeatPumpIntegration module expects from split_hot_and_cold():

    source   T descending, H rising   (heat available crossing T downward)
    sink     T descending, H falling  (heat still required below T)
"""

from __future__ import annotations

from typing import Any, Dict, List, Sequence, Tuple

PROFILE_MODES = ("net_load", "composite")

Curve = Dict[str, List[float]]


def _curve(T: Sequence[float], H: Sequence[float]) -> Curve:
    """Package a T/H pair the way split_hot_and_cold() returns it."""
    T = [float(t) for t in T]
    H = [float(h) for h in H]
    return {
        "T": T,
        "H": H,
        "deltaH": [H[i + 1] - H[i] for i in range(len(H) - 1)],
    }


def _trim_flat_ends(T: List[float], H: List[float], eps: float = 1e-9) -> Tuple[List[float], List[float]]:
    """
    Drop leading and trailing segments where H does not change.

    A source profile starts flat at 0 until the first surplus interval, and a
    sink profile ends flat at 0 below the last deficit interval. Those runs
    carry no duty and would only add degenerate points to the integration.
    """
    n = len(H)
    if n < 3:
        return T, H

    lo = 0
    while lo < n - 2 and abs(H[lo + 1] - H[lo]) <= eps:
        lo += 1

    hi = n - 1
    while hi > lo + 1 and abs(H[hi] - H[hi - 1]) <= eps:
        hi -= 1

    return T[lo:hi + 1], H[lo:hi + 1]


def _profiles_from_interval_loads(
    T: List[float],
    release: Sequence[float],
    need: Sequence[float],
) -> Tuple[Curve, Curve]:
    """
    Turn per-interval source releases and sink requirements into profiles.

    Both are accumulated the way the GCC reads: the source rises with falling
    temperature, the sink falls to zero.
    """
    source_H = [0.0]
    for r in release:
        source_H.append(source_H[-1] + r)

    sink_H = [float(sum(need))]
    for nd in need:
        sink_H.append(sink_H[-1] - nd)

    return (
        _curve(*_trim_flat_ends(T, source_H)),
        _curve(*_trim_flat_ends(T, sink_H)),
    )


def _uncascaded_profiles(pinch: Any) -> Tuple[Curve, Curve]:
    """
    Net heat loads per temperature interval, without cascading.

    Surplus intervals (deltaH > 0) build the source profile, deficit intervals
    (deltaH < 0) the sink profile. Where the other sign occurs the curve simply
    stays flat, so no heat is passed between intervals.
    """
    T = [float(t) for t in pinch._temperatures]            # descending
    dH = [float(row["deltaH"]) for row in pinch.problem_table]

    surplus = [max(h, 0.0) for h in dH]
    deficit = [max(-h, 0.0) for h in dH]

    return _profiles_from_interval_loads(T, surplus, deficit)


def _composite_curve(
    streams_data: Sequence[Dict[str, Any]],
    stream_type: str,
    tmin: float = 0.0,
) -> Tuple[List[float], List[float]]:
    """
    Build one composite curve using shifted temperatures.

    Returns (T ascending, H cumulative from the cold end).
    """
    segments: List[Tuple[float, float, float]] = []
    dt_shift = float(tmin) / 2.0
    for s in streams_data:
        if s.get("type") != stream_type:
            continue
        if "ss" in s and "st" in s and s["ss"] is not None and s["st"] is not None:
            ts, tt = float(s["ss"]), float(s["st"])
        else:
            ts_raw, tt_raw = float(s["ts"]), float(s["tt"])
            if stream_type == "HOT":
                ts, tt = ts_raw - dt_shift, tt_raw - dt_shift
            else:
                ts, tt = ts_raw + dt_shift, tt_raw + dt_shift
        lo, hi = min(ts, tt), max(ts, tt)
        if hi > lo:
            segments.append((lo, hi, float(s["cp"])))

    if not segments:
        return [], []

    bounds = sorted({b for lo, hi, _ in segments for b in (lo, hi)})

    H = [0.0]
    for i in range(len(bounds) - 1):
        lo, hi = bounds[i], bounds[i + 1]
        cp = sum(cp_i for a, b, cp_i in segments if a <= lo and b >= hi)
        H.append(H[-1] + cp * (hi - lo))

    return bounds, H


def _composite_profiles(pinch: Any) -> Tuple[Curve, Curve]:
    """
    Hot and cold composite curves as source/sink profiles — no recovery at all.

    All profiles use shifted temperatures (shifted down by Tmin/2 for HOT streams
    and shifted up by Tmin/2 for COLD streams).
    """
    streams_data = pinch.streams.streamsData
    tmin = float(getattr(pinch, "tmin", 0.0))

    hot_T, hot_H = _composite_curve(streams_data, "HOT", tmin=tmin)
    cold_T, cold_H = _composite_curve(streams_data, "COLD", tmin=tmin)

    if not hot_T or not cold_T:
        raise ValueError(
            "Composite profiles need at least one hot and one cold stream."
        )

    # Source: reverse to descending T and measure the duty released *above* T,
    # so H starts at 0 at the hottest point and grows to the full hot duty.
    hot_total = hot_H[-1]
    source_T = list(reversed(hot_T))
    source_H = [hot_total - h for h in reversed(hot_H)]

    # Sink: reverse to descending T. The cumulative cold duty already reads 0 at
    # the coldest point and the full duty at the hottest one.
    sink_T = list(reversed(cold_T))
    sink_H = list(reversed(cold_H))

    return _curve(source_T, source_H), _curve(sink_T, sink_H)


def _pocket_free(points: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
    """One side of the GCC without its pockets. `points` are (H, T) from the
    far end of that side to the pinch. Walking towards the pinch, the heat
    flow may only fall: where it rises again (a pocket: heat recovered inside
    it), the curve is cut off by a vertical step and rejoins at the exact
    temperature it gets back to that heat flow. The far end's vertical run
    (above the hot or below the cold utility) carries no duty and goes."""
    out = [points[0]]
    low = points[0][0]
    for (h0, t0), (h1, t1) in zip(points, points[1:]):
        if h1 > low:
            continue  # inside a pocket
        if h0 > low:
            out.append((low, t0 + (low - h0) * (t1 - t0) / (h1 - h0)))
        out.append((h1, t1))
        low = h1
    while len(out) > 1 and out[1][0] == out[0][0]:
        out.pop(0)
    return out if len(out) > 1 else []


def _net_load_profiles(pinch: Any) -> Tuple[Curve, Curve]:
    """The pocket-free GCC split at the pinch: the sink is the part above it,
    the source the part below. Split by side, never by the sign of a segment,
    so a pocket's heat can never turn up as a source above the pinch."""
    gcc = list(zip(pinch.grand_composite_curve["H"], pinch.grand_composite_curve["T"]))
    tp = float(pinch.pinch_temperature)
    sink = _pocket_free([p for p in gcc if p[1] >= tp])               # top -> pinch
    source = _pocket_free([p for p in reversed(gcc) if p[1] <= tp])[::-1]  # pinch -> bottom
    return (_curve([t for _, t in source], [h for h, _ in source]),
            _curve([t for _, t in sink], [h for h, _ in sink]))


def build_heat_profiles(pinch: Any, mode: str) -> Tuple[Curve, Curve]:
    """
    Build (source, sink) profiles for one of the non-cascaded modes.

    `pinch` is a solved Pinch instance (PinchMain.pinch_analyse).
    """
    if mode == "uncascaded":
        return _uncascaded_profiles(pinch)
    if mode == "composite":
        return _composite_profiles(pinch)
    raise ValueError(
        f"build_heat_profiles() does not handle mode '{mode}'. "
        "Use resolve_profiles() for 'net_load'."
    )


def resolve_profiles(pinch: Any, hpi: Any, mode: str = "net_load") -> Tuple[Curve, Curve]:
    """
    Return the (source, sink) profiles for `mode`.

    For 'net_load' the pocket-free GCC split at the pinch. The legacy pocket
    deletion still runs for the state it leaves on the HeatPumpIntegration
    instance, but its split went by the sign of each segment: a pocket it
    could not remove leaked into the source above the pinch and folded the
    sink back on itself (a large condensing stream across one kelvin).
    """
    if mode not in PROFILE_MODES:
        raise ValueError(
            f"Unknown profile_mode '{mode}'. Expected one of {PROFILE_MODES}."
        )

    if mode == "net_load":
        hpi.delete_temperature_pockets()
        return _net_load_profiles(pinch)

    return build_heat_profiles(pinch, mode)
