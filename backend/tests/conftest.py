import os

# The macOS GUI backend cannot draw off the main thread, where TestClient runs.
os.environ.setdefault("MPLBACKEND", "Agg")

import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client
