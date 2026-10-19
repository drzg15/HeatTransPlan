"""Per-client rate limits: a fast user gets through, a flood does not."""

import pytest
from fastapi.testclient import TestClient

import app.rate_limit as rl
from app.main import app
from app.rate_limit import SlidingWindow

client = TestClient(app)


class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


@pytest.fixture
def limits(monkeypatch):
    """Production limits, on a clock the test controls."""
    clock = FakeClock()
    monkeypatch.setattr(rl, "all_requests", SlidingWindow(600, clock=clock))
    monkeypatch.setattr(rl, "heavy_requests", SlidingWindow(120, clock=clock))
    return clock


def call(path, ip="203.0.113.7"):
    # A cheap request: an empty body fails validation after the limiter has
    # counted it, so nothing is calculated.
    return client.post(path, json={}, headers={"X-Forwarded-For": ip})


def test_a_fast_user_is_not_throttled(limits):
    # Measured in the app: ten stream changes as fast as the checkboxes allow
    # fire 50 requests in three seconds, 20 of them heat pump calculations.
    for _ in range(10):
        for path in ("/api/analysis/pinch", "/api/analysis/hpi", "/api/analysis/hpi-optimization",
                     "/api/analysis/status-quo", "/api/analysis/status-quo"):
            assert call(path).status_code != 429
        limits.now += 0.3
    # ...and a report on top.
    assert call("/api/analysis/report").status_code != 429


def test_a_flood_of_calculations_is_cut_off(limits):
    statuses = [call("/api/analysis/hpi-optimization").status_code for _ in range(130)]
    assert 429 not in statuses[:120]
    assert statuses[120:] == [429] * 10

    r = call("/api/analysis/hpi-optimization")
    assert r.status_code == 429
    assert 1 <= int(r.headers["Retry-After"]) <= 60
    # The cheap endpoints keep their own, larger budget.
    assert call("/api/analysis/pinch").status_code != 429


def test_a_flood_of_anything_is_cut_off(limits):
    statuses = [call("/api/analysis/pinch").status_code for _ in range(610)]
    assert 429 not in statuses[:600]
    assert set(statuses[600:]) == {429}


def test_budgets_are_per_client(limits):
    for _ in range(120):
        call("/api/analysis/hpi-optimization", ip="198.51.100.1")
    assert call("/api/analysis/hpi-optimization", ip="198.51.100.1").status_code == 429
    assert call("/api/analysis/hpi-optimization", ip="198.51.100.2").status_code != 429


def test_the_budget_refills_after_a_minute(limits):
    for _ in range(120):
        call("/api/analysis/hpi-optimization")
    assert call("/api/analysis/hpi-optimization").status_code == 429
    limits.now += 61
    assert call("/api/analysis/hpi-optimization").status_code != 429


def test_the_client_cannot_pick_its_own_address(limits):
    # Caddy appends the real address last; whatever the client put in front
    # of it is ignored, so a forged header buys no fresh budget.
    for i in range(120):
        call("/api/analysis/hpi-optimization", ip=f"10.0.0.{i}, 203.0.113.7")
    assert call("/api/analysis/hpi-optimization", ip="10.9.9.9, 203.0.113.7").status_code == 429


def test_health_is_never_throttled(limits):
    for _ in range(700):
        call("/api/analysis/pinch")
    assert client.get("/api/health", headers={"X-Forwarded-For": "203.0.113.7"}).status_code == 200


def test_idle_clients_are_forgotten():
    clock = FakeClock()
    window = SlidingWindow(5, clock=clock)
    for i in range(999):
        window.hit(f"scanner-{i}")
    clock.now += 61
    window.hit("someone")  # the 1000th call sweeps out everyone idle
    assert list(window._hits) == ["someone"]
