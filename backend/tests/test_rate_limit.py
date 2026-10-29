"""Requests per visitor: a flood or a run of guessed codes gets 429, other
visitors and the MCP server's own calls do not notice."""

import asyncio

from app.rate_limit import INTERNAL_TOKEN, RateLimit


def _app(status=200):
    async def app(scope, receive, send):
        await send({"type": "http.response.start", "status": status, "headers": []})
        await send({"type": "http.response.body", "body": b""})
    return app


def _call(limiter, path, ip="1.2.3.4", headers=()):
    sent = []

    async def send(message):
        sent.append(message)

    scope = {"type": "http", "path": path, "headers": list(headers), "client": (ip, 1)}
    asyncio.run(limiter(scope, None, send))
    return sent[0]["status"]


def test_a_visitor_over_the_limit_waits_others_do_not():
    limiter = RateLimit(_app(), rules=[("/api/", 3, 60)], enabled=True)
    assert [_call(limiter, "/api/x") for _ in range(4)] == [200, 200, 200, 429]
    assert _call(limiter, "/api/x", ip="5.6.7.8") == 200
    internal = [(b"x-heattransplan-internal", INTERNAL_TOKEN.encode())]
    assert _call(limiter, "/api/x", headers=internal) == 200


def test_guessed_codes_lock_the_live_endpoints():
    limiter = RateLimit(_app(404), rules=[], misses=(2, 600), enabled=True)
    assert [_call(limiter, "/api/live/pages/abcd1234") for _ in range(3)] == [404, 404, 429]
    assert _call(limiter, "/api/live/pages/abcd1234", ip="5.6.7.8") == 404
