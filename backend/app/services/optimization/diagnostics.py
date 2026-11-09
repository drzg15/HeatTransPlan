"""Why the optimization found little or nothing, in English and German."""

from __future__ import annotations

from app.models.analysis import HPIOptimizationDiagnostics

# Smallest share of the demand above T_sink a source-limited heat pump has to
# cover to be worth reporting.
MIN_COVERAGE = 0.01


_DIAG_TEXT = {
    "en": {
        "source_cold": "Source too cold: the waste heat profile only reaches {src:.1f} °C, while the coldest source any refrigerant in the COP model supports is {model:.1f} °C. Check whether hot streams are deselected, or lower the heat recovery already in place so warmer heat stays available.",
        "sink_cold": "Sink too cold: the heat demand only reaches {sink:.1f} °C, below the lowest sink temperature the COP model was trained on ({model:.1f} °C).",
        "negligible": "{n} operating points were dropped because the available waste heat would have covered less than {pct:.0f} % of the demand above T_sink.",
        "no_source": "No usable source heat: within every refrigerant's operating window the available waste heat is zero.",
        "no_demand": "No heat demand above the pinch — nothing for a heat pump to supply.",
        "no_refrigerant": "No refrigerant in the COP model can operate between this source and sink temperature range.",
        "source_limited": "{n} of {total} operating points are source-limited: the heat pump covers only part of the demand above T_sink because the available waste heat runs out.",
        "source_limited_more": " A further {n} were dropped for covering less than {pct:.0f} % of that demand.",
        "demand_limited": "{n} of {total} operating points are demand-limited: they cover the full demand above T_sink but leave waste heat unused at T_source, so they sit off the source profile. They are hidden from the chart unless switched on.",
        "sink_range": "Every candidate was rejected on the sink temperature range ({lo:.0f}–{hi:.0f} °C available, model needs at least {model:.0f} °C).",
    },
    "de": {
        "source_cold": "Quelle zu kalt: Das Abwärmeprofil erreicht nur {src:.1f} °C, die kälteste Quelle, die ein Kältemittel im COP-Modell unterstützt, liegt bei {model:.1f} °C. Prüfen Sie, ob heiße Ströme abgewählt sind, oder senken Sie die bereits umgesetzte Wärmerückgewinnung, damit wärmere Abwärme verfügbar bleibt.",
        "sink_cold": "Senke zu kalt: Der Wärmebedarf erreicht nur {sink:.1f} °C, unterhalb der niedrigsten Senkentemperatur, mit der das COP-Modell trainiert wurde ({model:.1f} °C).",
        "negligible": "{n} Betriebspunkte wurden verworfen, weil die verfügbare Abwärme weniger als {pct:.0f} % des Bedarfs oberhalb von T_sink gedeckt hätte.",
        "no_source": "Keine nutzbare Quellwärme: Im Einsatzbereich jedes Kältemittels ist die verfügbare Abwärme null.",
        "no_demand": "Kein Wärmebedarf oberhalb des Pinch – die Wärmepumpe hat nichts zu liefern.",
        "no_refrigerant": "Kein Kältemittel im COP-Modell kann zwischen diesem Quellen- und Senkentemperaturbereich arbeiten.",
        "source_limited": "{n} von {total} Betriebspunkten sind quellenbegrenzt: Die Wärmepumpe deckt nur einen Teil des Bedarfs oberhalb von T_sink, weil die verfügbare Abwärme nicht ausreicht.",
        "source_limited_more": " Weitere {n} wurden verworfen, weil sie weniger als {pct:.0f} % dieses Bedarfs decken.",
        "demand_limited": "{n} von {total} Betriebspunkten sind bedarfsbegrenzt: Sie decken den vollen Bedarf oberhalb von T_sink, lassen aber Abwärme bei T_source ungenutzt und liegen daher neben dem Quellenprofil. Sie sind im Diagramm ausgeblendet, solange sie nicht eingeschaltet werden.",
        "sink_range": "Alle Kandidaten wurden wegen des Senkentemperaturbereichs verworfen ({lo:.0f}–{hi:.0f} °C verfügbar, das Modell braucht mindestens {model:.0f} °C).",
    },
}


def _diagnostic_messages(diag: HPIOptimizationDiagnostics, n_points: int, lang: str = "en") -> list[str]:
    """
    Turn the rejection tally into sentences an engineer can act on, in the
    app's language.

    Only the binding constraints are reported, so a run that found plenty of
    solutions stays quiet.
    """
    tx = _DIAG_TEXT["de" if lang.startswith("de") else "en"]
    pct = MIN_COVERAGE * 100
    msgs: list[str] = []

    if n_points == 0:
        if diag.source_T_max is not None and diag.model_T_source_min is not None \
                and diag.source_T_max < diag.model_T_source_min:
            msgs.append(tx["source_cold"].format(src=diag.source_T_max, model=diag.model_T_source_min))
        if diag.sink_T_max is not None and diag.model_T_sink_min is not None \
                and diag.sink_T_max < diag.model_T_sink_min:
            msgs.append(tx["sink_cold"].format(sink=diag.sink_T_max, model=diag.model_T_sink_min))
        if diag.dropped_negligible and not msgs:
            msgs.append(tx["negligible"].format(n=diag.dropped_negligible, pct=pct))
        if diag.rejected_no_source_heat and not msgs:
            msgs.append(tx["no_source"])
        if diag.rejected_no_demand == diag.candidates_total and diag.candidates_total:
            msgs.append(tx["no_demand"])
        if not msgs:
            msgs.append(tx["no_refrigerant"])
    elif diag.accepted_source_limited:
        msg = tx["source_limited"].format(n=diag.accepted_source_limited, total=n_points)
        if diag.dropped_negligible:
            msg += tx["source_limited_more"].format(n=diag.dropped_negligible, pct=pct)
        msgs.append(msg)

    if n_points and diag.accepted_demand_limited:
        msgs.append(tx["demand_limited"].format(n=diag.accepted_demand_limited, total=n_points))

    if diag.candidates_total and diag.rejected_sink_range == diag.candidates_total:
        msgs.append(tx["sink_range"].format(lo=diag.sink_T_min, hi=diag.sink_T_max, model=diag.model_T_sink_min))

    return msgs
