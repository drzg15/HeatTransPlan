# Configuration for Heat Pump Integration Optimization
import os
from pathlib import Path

# backend/app -> backend -> repo root
_APP_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _APP_DIR.parent
_REPO_ROOT = _BACKEND_DIR.parent


def _resolve(*parts: str, env_var: str) -> str:
    """Locate an asset regardless of where the server was started from.

    Compose mounts models/ under backend/, while a dev checkout keeps it at the
    repo root — and uvicorn is launched from backend/, so a relative path only
    resolves in the container.
    """
    override = os.getenv(env_var)
    if override:
        return override
    for root in (_BACKEND_DIR, _REPO_ROOT):
        candidate = root.joinpath(*parts)
        if candidate.exists():
            return str(candidate)
    # Nothing found: return the repo-root candidate so the caller's
    # FileNotFoundError names a real, checkable path.
    return str(_REPO_ROOT.joinpath(*parts))


OPTIMIZATION_CONFIG = {
    "T_min": 10.0,
    "step_size": 0.5,
    "deltaT_evap": 0,
    "deltaT_cond": 0,
    "model_path": _resolve("models", "cop", "best_model.joblib", env_var="COP_MODEL_PATH"),
    # Validity envelope per refrigerant/medium, exported from the modelling data
    # by cop_analysis/export_cop_ranges.py. The training data itself is not
    # deployed — only the model and this file.
    "ranges_path": _resolve("models", "cop", "cop_ranges.json", env_var="COP_RANGES_PATH"),
}
