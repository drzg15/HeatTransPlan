import os

# The macOS GUI backend cannot draw off the main thread, where TestClient runs.
os.environ.setdefault("MPLBACKEND", "Agg")
# Tests call the API far faster than any visitor; the limiter has its own test.
os.environ.setdefault("RATE_LIMIT", "0")

import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture(autouse=True)
def _activity_log(tmp_path, monkeypatch):
    """Each test logs to its own file, never the machine's."""
    from app.services import activity_log
    monkeypatch.setattr(activity_log, "PATH", str(tmp_path / "activity.sqlite"))


@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client
