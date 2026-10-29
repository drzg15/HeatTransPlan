"""Requests per visitor (IP address) and minute, so nobody can flood the
server or guess Connect AI codes. The app has no login, so this is what
keeps one visitor from spoiling it for the others.

Behind Caddy the visitor's address comes from X-Forwarded-For (uvicorn
--proxy-headers; the backend port is not published). The MCP server's own
calls into the backend carry INTERNAL_TOKEN and do not count: the agent's
request to /mcp is what counts. RATE_LIMIT=0 switches it off (tests).

ponytail: counts in memory, one process (as live sessions); a shared store
such as Redis when the backend runs on several.
"""

from __future__ import annotations

import json
import os
import secrets
import time
from collections import defaultdict, deque

ENABLED = os.getenv("RATE_LIMIT", "1").lower() not in ("0", "false", "off", "no")
INTERNAL_TOKEN = secrets.token_urlsafe(32)
INTERNAL_HEADER = b"x-heattransplan-internal"

# (path prefix, requests, seconds): the first prefix that matches counts.
RULES = [
    ("/mcp", 120, 60),
    ("/api/analysis/report", 20, 60),
    ("/api/analysis/cop-model/train", 10, 60),
    ("/api/geo/search", 30, 60),  # OpenStreetMap's search allows about one a second
    ("/api/", 1200, 60),
]
# Unknown Connect AI codes (404 under /api/live/) before that visitor's live
# requests are refused for a while.
MISSES = (30, 600)


class RateLimit:
    def __init__(self, app, rules=RULES, misses=MISSES, enabled=None):
        self.app = app
        self.rules = rules
        self.misses = misses
        self.enabled = ENABLED if enabled is None else enabled
        self.hits: dict = defaultdict(deque)
        self.requests = 0

    def _full(self, key, limit: int, window: float, now: float) -> float:
        """Seconds to wait when key has used its limit, else 0."""
        q = self.hits[key]
        while q and now - q[0] > window:
            q.popleft()
        return window - (now - q[0]) if len(q) >= limit else 0.0

    def _forget_idle(self, now: float) -> None:
        self.requests += 1
        if self.requests % 1000:
            return
        longest = max([w for _, _, w in self.rules] + [self.misses[1]])
        for key in [k for k, q in self.hits.items() if not q or now - q[-1] > longest]:
            del self.hits[key]

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not self.enabled:
            return await self.app(scope, receive, send)
        if dict(scope["headers"]).get(INTERNAL_HEADER) == INTERNAL_TOKEN.encode():
            return await self.app(scope, receive, send)
        ip = (scope.get("client") or ("unknown",))[0]
        path = scope["path"]
        now = time.monotonic()
        self._forget_idle(now)

        wait = 0.0
        live = path.startswith("/api/live/")
        if live:
            wait = self._full(("miss", ip), *self.misses, now)
        rule = next((r for r in self.rules if path.startswith(r[0])), None)
        if not wait and rule:
            wait = self._full((rule[0], ip), rule[1], rule[2], now)
        if wait:
            return await _too_many(send, wait)
        if rule:
            self.hits[(rule[0], ip)].append(now)

        async def watch(message):
            if live and message["type"] == "http.response.start" and message["status"] == 404:
                self.hits[("miss", ip)].append(time.monotonic())
            await send(message)

        await self.app(scope, receive, watch)


async def _too_many(send, wait: float) -> None:
    seconds = max(1, int(wait + 0.999))
    body = json.dumps({"detail": f"Too many requests; try again in {seconds} s."}).encode()
    await send({"type": "http.response.start", "status": 429, "headers": [
        (b"content-type", b"application/json"), (b"retry-after", str(seconds).encode()),
        (b"content-length", str(len(body)).encode())]})
    await send({"type": "http.response.body", "body": body})
