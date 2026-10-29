def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_the_frontend_route_serves_nothing_outside_dist(client):
    """Encoded dot-segments must not walk out of frontend/dist (root Dockerfile
    serves the app from the backend)."""
    for path in ("/%2e%2e/%2e%2e/README.md", "/%2e%2e/%2e%2e/backend/app/main.py", "/..%2f..%2fREADME.md"):
        r = client.get(path)
        assert "FastAPI" not in r.text and "# HeatTransPlan" not in r.text, path
