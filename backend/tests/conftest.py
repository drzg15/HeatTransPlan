import os

# The macOS GUI backend cannot draw off the main thread, where TestClient runs.
os.environ.setdefault("MPLBACKEND", "Agg")
# Tests call the API far faster than any visitor; the limiter has its own test.
os.environ.setdefault("RATE_LIMIT", "0")

import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client
