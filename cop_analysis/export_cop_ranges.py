"""Export the COP model's validity ranges to a small JSON file.

The optimizer never needs the training data itself — only, per
(refrigerant_stage, sink medium) combination, the envelope the model was fitted
on: source/sink temperature bounds and the COP bounds used to reject
extrapolated predictions. This script reduces the modelling dataset to exactly
that and writes it next to the model, so a deployment ships the .joblib plus
this file and nothing else.

The output holds only aggregates (min/max per group) — no rows of the
underlying dataset are reproduced.

Run it on the machine that has the modelling data:

    python cop_analysis/export_cop_ranges.py

then commit the regenerated models/cop/cop_ranges.json.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent

DEFAULT_DATA = REPO_ROOT / "data" / "cop_modelling" / "df_to_model.parquet"
DEFAULT_OUT = REPO_ROOT / "models" / "cop" / "cop_ranges.json"
DEFAULT_MODEL = REPO_ROOT / "models" / "cop" / "best_model.joblib"

# Fallback for datasets that predate the kältemittel_typ column. The label is a
# property of the refrigerant, not of the measurements.
NATURAL_REFRIGERANTS = {"butane", "isobutane", "isopentane", "propane", "r717", "ammonia"}


def _refrigerant_type(raw_type: str, refrigerant: str) -> str:
    """Normalise the German dataset labels to the values the API returns."""
    raw = str(raw_type).lower()
    if "natürlich" in raw or "naturlich" in raw or "natural" in raw:
        return "Natural"
    if "syntetisch" in raw or "synthetisch" in raw or "synthetic" in raw:
        return "Synthetic"
    # No usable label — fall back to the refrigerant name.
    name = str(refrigerant).split("_")[0].lower()
    if name in NATURAL_REFRIGERANTS:
        return "Natural"
    return "Synthetic" if name.startswith("r") else "Unknown"


def build_ranges(df: pd.DataFrame) -> list[dict]:
    """Aggregate the modelling frame into one entry per (stage, medium)."""
    required = ["Kältemittel", "Medium_Senke", "T_Rücklauf_Quelle", "T_Vorlauf_Senke", "COP"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise SystemExit(f"Dataset is missing required columns: {missing}")

    # Same key the model was trained on: refrigerant + compressor stage count.
    if "Kompressor_Nr_Stufe1" in df.columns:
        stages = df["Kompressor_Nr_Stufe1"].astype(float).astype("Int64").astype(str)
        df = df.assign(Kältemittel_stufen=df["Kältemittel"].astype(str) + "_" + stages)
    else:
        df = df.assign(Kältemittel_stufen=df["Kältemittel"].astype(str))

    if "kältemittel_typ" not in df.columns:
        df = df.assign(kältemittel_typ="")

    agg = (
        df.groupby(["Kältemittel_stufen", "Medium_Senke"])
        .agg(
            T_src_min=("T_Rücklauf_Quelle", "min"),
            T_src_max=("T_Rücklauf_Quelle", "max"),
            T_sink_min=("T_Vorlauf_Senke", "min"),
            T_sink_max=("T_Vorlauf_Senke", "max"),
            cop_min=("COP", "min"),
            cop_max=("COP", "max"),
            raw_type=("kältemittel_typ", "first"),
        )
        .reset_index()
    )

    entries = []
    for _, row in agg.iterrows():
        name = str(row["Kältemittel_stufen"])
        parts = name.split("_")
        entries.append(
            {
                "name": name,
                "Kältemittel_stufen": name,
                "medium_sink": str(row["Medium_Senke"]),
                "refrigerant_type": _refrigerant_type(row["raw_type"], name),
                "hp_level": parts[-1] if len(parts) > 1 else "1",
                "T_src_min": float(row["T_src_min"]),
                "T_src_max": float(row["T_src_max"]),
                "T_sink_min": float(row["T_sink_min"]),
                "T_sink_max": float(row["T_sink_max"]),
                "cop_min": float(row["cop_min"]),
                "cop_max": float(row["cop_max"]),
            }
        )
    return entries


def check_against_model(entries: list[dict], model_path: Path) -> None:
    """Warn if the ranges and the model disagree on the known categories.

    A combination the model cannot encode would raise at predict time; one the
    model knows but the ranges omit is silently never offered to the user.
    """
    if not model_path.exists():
        print(f"note: model not found at {model_path}, skipping cross-check")
        return
    import joblib

    model = joblib.load(model_path)
    categories: dict[str, set[str]] = {}
    for _, trans, cols in model.named_steps["preprocessor"].transformers_:
        encoder = getattr(trans, "named_steps", {}).get("onehot") if hasattr(trans, "named_steps") else None
        if encoder is None or not hasattr(encoder, "categories_"):
            continue
        for col, cats in zip(cols, encoder.categories_):
            categories[col] = {str(c) for c in cats}

    for column, key in (("Kältemittel_stufen", "Kältemittel_stufen"), ("Medium_Senke", "medium_sink")):
        known = categories.get(column)
        if not known:
            continue
        present = {e[key] for e in entries}
        if unknown := sorted(present - known):
            print(f"WARNING: {column} in data but not in model (predictions would fail): {unknown}")
        if unused := sorted(known - present):
            print(f"WARNING: {column} in model but not in ranges (never offered): {unused}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA, help=f"modelling dataset (default: {DEFAULT_DATA})")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help=f"output JSON (default: {DEFAULT_OUT})")
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL, help="model to cross-check the categories against")
    args = parser.parse_args()

    if not args.data.exists():
        raise SystemExit(f"Dataset not found at {args.data}. Pass --data with the correct path.")

    df = pd.read_parquet(args.data)
    entries = build_ranges(df)
    if not entries:
        raise SystemExit("No groups produced — is the dataset empty?")

    check_against_model(entries, args.model)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": 1,
        "source": args.data.name,
        "alternatives": entries,
    }
    args.out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(entries)} range entries from {len(df)} rows to {args.out}")


if __name__ == "__main__":
    main()
