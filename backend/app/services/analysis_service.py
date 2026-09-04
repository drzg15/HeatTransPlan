"""
Pinch analysis service — wraps the existing modules/pinch/ code.
"""

from __future__ import annotations
import csv
import os
import tempfile
from typing import Any, Dict, List

from app.models.analysis import (
    PinchRequest,
    PinchResult,
    CompositeDiagramData,
    HPIRequest,
    HPIResult,
    HPIntegrationResult,
    StatusQuoRequest,
    StatusQuoResult,
    EnergyDemand,
)


def run_pinch(request: PinchRequest) -> PinchResult:
    """
    Execute pinch analysis by writing a temp CSV in the format
    expected by Streams, then calling Pinch.
    """
    # Write CSV in the format: Row0 = "Tmin, <value>", Row1 = "CP, TSUPPLY, TTARGET", Row2+ = data
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="")
    try:
        writer = csv.writer(tmp)
        writer.writerow(["Tmin", str(request.T_min)])
        writer.writerow(["CP", "TSUPPLY", "TTARGET"])
        for s in request.streams:
            writer.writerow([str(s.CP), str(s.T_supply), str(s.T_target)])
        tmp.close()

        # Import here to avoid circular imports at module level
        from app.modules.pinch.pinch import Pinch

        pinch = Pinch(tmp.name, options={})
        pinch.shift_temperatures()
        pinch.construct_temperature_interval()
        pinch.construct_problem_table()
        pinch.construct_heat_cascade()
        pinch.construct_shifted_composite_diagram("EN")
        pinch.construct_composite_diagram("EN")
        pinch.construct_grand_composite_curve("EN")

        # Build stream info for frontend labeling
        streams_data = []
        for sd in pinch.streams.streamsData:
            streams_data.append({
                "type": sd["type"],
                "cp": sd["cp"],
                "ts": sd["ts"],
                "tt": sd["tt"],
                "ss": sd.get("ss"),
                "st": sd.get("st"),
            })

        return PinchResult(
            pinch_temperature=pinch.pinch_temperature,
            hot_utility=pinch.hot_utility,
            cold_utility=pinch.cold_utility,
            T_min=pinch.tmin,
            temperatures=pinch._temperatures,
            problem_table=[dict(row) for row in pinch.problem_table],
            heat_cascade=[dict(row) for row in pinch.heat_cascade],
            unfeasible_heat_cascade=[dict(row) for row in pinch.unfeasible_heat_cascade],
            shifted_composite_diagram=CompositeDiagramData(
                hot=pinch.shifted_composite_diagram["hot"],
                cold=pinch.shifted_composite_diagram["cold"],
            ),
            composite_diagram=CompositeDiagramData(
                hot=pinch.composite_diagram["hot"],
                cold=pinch.composite_diagram["cold"],
            ),
            grand_composite_curve=pinch.grand_composite_curve,
            streams_data=streams_data,
        )
    finally:
        os.unlink(tmp.name)


def _exclusion_reason(hp_type: str, t_sink: float | None, delta_t: float | None = None, exc: Exception | None = None) -> str:
    """Return a human-readable reason why a heat pump type cannot be integrated."""
    # Operating windows live in the heat pump module — the single source of
    # truth the COP correlations themselves are gated on.
    from app.modules.heat_pump_integration.heat_pump_integration import HP_OPERATING_WINDOWS

    c = HP_OPERATING_WINDOWS.get(hp_type)
    if c is None:
        return str(exc) if exc else "Heat pump type unknown."

    reasons: list[str] = []

    if t_sink is not None:
        if t_sink < c["t_sink_min"]:
            reasons.append(
                f"Sink temperature T_sink = {t_sink:.1f}°C is below the minimum "
                f"of {c['t_sink_min']}°C required by this technology."
            )
        elif t_sink > c["t_sink_max"]:
            reasons.append(
                f"Sink temperature T_sink = {t_sink:.1f}°C exceeds the maximum "
                f"of {c['t_sink_max']}°C for this technology."
            )

        if delta_t is not None:
            if delta_t < c["dt_min"]:
                reasons.append(
                    f"Temperature lift ΔT = {delta_t:.1f}°C is below the minimum "
                    f"of {c['dt_min']}°C required by this technology."
                )
            elif delta_t > c["dt_max"]:
                reasons.append(
                    f"Temperature lift ΔT = {delta_t:.1f}°C exceeds the maximum "
                    f"of {c['dt_max']}°C for this technology."
                )

    if not reasons:
        # Fallback: show the full operating window
        reasons.append(
            f"Operating window not met. Requires: "
            f"{c['t_sink_min']}°C ≤ T_sink ≤ {c['t_sink_max']}°C and "
            f"{c['dt_min']}°C ≤ ΔT ≤ {c['dt_max']}°C."
        )

    return " ".join(reasons)


def run_hpi(request: HPIRequest) -> HPIResult:
    """
    Run heat pump integration analysis.
    Wraps the existing HeatPumpIntegration module.
    """
    from app.modules.heat_pump_integration.heat_pump_integration import (
        HeatPumpIntegration,
        HeatPumpOutOfRange,
    )
    from app.modules.utility.heat_profiles import resolve_profiles
    from app.models.analysis import HeatPumpEntry

    pinch = request.pinch_result
    gcc = pinch.grand_composite_curve
    integrations: List[HPIntegrationResult] = []
    heat_pumps: List[HeatPumpEntry] = []
    excluded_heat_pumps: List[HeatPumpEntry] = []
    source_profile: Dict[str, List[float]] = {"H": [], "T": []}
    sink_profile: Dict[str, List[float]] = {"H": [], "T": []}

    # Reconstruct pinch_obj for HPI
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="")
    try:
        writer = csv.writer(tmp)
        writer.writerow(["Tmin", str(pinch.T_min)])
        writer.writerow(["CP", "TSUPPLY", "TTARGET"])
        for sd in pinch.streams_data:
            writer.writerow([str(sd["cp"]), str(sd["ts"]), str(sd["tt"])])
        tmp.close()

        from app.modules.pinch_main import PinchMain
        pm = PinchMain(tmp.name, options={})
        pm.solve_pinch_for_hpi("EN")

        for hp_type in request.hp_types:
            try:
                # Correct instantiation: HeatPumpIntegration(CSV_path, t_sink_out, pyPinch)
                # t_sink_out = None triggers iterative mode
                # pyPinch expects a PinchMain instance which has the .pinch_analyse attribute
                hpi = HeatPumpIntegration(tmp.name, None, pm)
                # Set required attributes for find_integration
                hpi.gcc_draw = pm.pinch_analyse.grand_composite_curve

                hpi.gcc_source, hpi.gcc_sink = resolve_profiles(
                    pm.pinch_analyse, hpi, request.profile_mode
                )
                source_profile = {"H": list(hpi.gcc_source["H"]), "T": list(hpi.gcc_source["T"])}
                sink_profile = {"H": list(hpi.gcc_sink["H"]), "T": list(hpi.gcc_sink["T"])}

                # Run integration for specific type
                hpi.integrate_heat_pump_specific(hp_type)
                hpi.find_integration()

                if (hasattr(hpi, "integration_point") and 
                    hpi.integration_point and 
                    len(hpi.integration_point.get("Temp", [])) > 0):
                    
                    # Successfully integrated
                    int_temp = hpi.integration_point["Temp"][-1]
                    int_qsource = hpi.integration_point["QQuelle"][-1]
                    int_qsink = hpi.integration_point["QSenke"][-1]
                    int_cop = hpi.integration_point["COP"][-1]
                    t_sink = hpi.t_sink_out

                    # Model 1: HPIntegrationResult (detailed points for Plotly)
                    res = HPIntegrationResult(
                        hp_type=hp_type,
                        COP=int_cop,
                        Q_ko=int_qsink,
                        Q_ev=int_qsource,
                        T_source=int_temp,
                        T_sink=t_sink,
                        feasible=True,
                        source_points={"H": [int_qsource], "T": [int_temp]},
                        sink_points={"H": [int_qsink], "T": [t_sink]},
                    )
                    integrations.append(res)

                    # Model 2: HeatPumpEntry (matching frontend table expectations)
                    heat_pumps.append(HeatPumpEntry(
                        name=hp_type,
                        cop=int_cop,
                        t_source=int_temp,
                        t_sink=t_sink,
                        q_source=int_qsource,
                        q_sink=int_qsink,
                        available=True
                    ))
                else:
                    # Build a meaningful reason from the HP type's known constraints
                    t_sink_val = getattr(hpi, 't_sink_out', None)
                    reason = _exclusion_reason(hp_type, t_sink_val, delta_t=None)
                    excluded_heat_pumps.append(HeatPumpEntry(
                        name=hp_type, available=False, reason=reason
                    ))
                    integrations.append(HPIntegrationResult(hp_type=hp_type, feasible=False))

            except HeatPumpOutOfRange as exc:
                # The technology was asked for a duty outside its rating. Both
                # numbers are known here, so the message can name the binding
                # constraint instead of listing the whole operating window.
                reason = _exclusion_reason(hp_type, exc.t_sink, delta_t=exc.delta_t, exc=exc)
                excluded_heat_pumps.append(HeatPumpEntry(
                    name=hp_type, available=False, reason=reason
                ))
                integrations.append(HPIntegrationResult(hp_type=hp_type, feasible=False))

            except (IndexError, TypeError, ValueError) as exc:
                hpi_obj = locals().get('hpi')
                t_sink_val = getattr(hpi_obj, 't_sink_out', None)
                reason = _exclusion_reason(hp_type, t_sink_val, delta_t=None, exc=exc)
                excluded_heat_pumps.append(HeatPumpEntry(
                    name=hp_type, available=False, reason=reason
                ))
                integrations.append(HPIntegrationResult(hp_type=hp_type, feasible=False))
            except Exception:
                excluded_heat_pumps.append(HeatPumpEntry(
                    name=hp_type, available=False, reason="Technical analysis error. Heat pump could not be evaluated for this process."
                ))
                integrations.append(HPIntegrationResult(hp_type=hp_type, feasible=False))

        return HPIResult(
            integrations=integrations,
            heat_pumps=heat_pumps,
            excluded_heat_pumps=excluded_heat_pumps,
            gcc_data={"H": gcc.get("H", []), "T": gcc.get("T", [])},
            profile_mode=request.profile_mode,
            source_profile=source_profile,
            sink_profile=sink_profile,
        )
    finally:
        os.unlink(tmp.name)


def run_status_quo(request: StatusQuoRequest) -> StatusQuoResult:
    """
    Compare current energy demands against pinch-optimal values.
    Pure calculation — no module dependency.
    """
    total_heating = sum(d.heating_kW for d in request.current_demands)
    total_cooling = sum(d.cooling_kW for d in request.current_demands)

    heating_savings = total_heating - request.pinch_hot_utility
    cooling_savings = total_cooling - request.pinch_cold_utility

    heating_pct = (heating_savings / total_heating * 100) if total_heating > 0 else 0.0
    cooling_pct = (cooling_savings / total_cooling * 100) if total_cooling > 0 else 0.0

    return StatusQuoResult(
        total_current_heating=total_heating,
        total_current_cooling=total_cooling,
        pinch_hot_utility=request.pinch_hot_utility,
        pinch_cold_utility=request.pinch_cold_utility,
        heating_savings_kW=heating_savings,
        cooling_savings_kW=cooling_savings,
        heating_savings_pct=round(heating_pct, 2),
        cooling_savings_pct=round(cooling_pct, 2),
    )
