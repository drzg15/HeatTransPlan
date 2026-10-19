import os

# The test suite runs the analysis far faster than any user could; the limits
# themselves are tested in test_rate_limit.py with their own counters.
os.environ.setdefault("RATE_LIMIT_PER_MINUTE", "1000000")
os.environ.setdefault("RATE_LIMIT_HEAVY_PER_MINUTE", "1000000")

import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client
