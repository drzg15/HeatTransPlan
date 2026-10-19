"""
Per-client rate limits for the API.

The browser calls the API directly, so every endpoint the app uses is open to
anyone who can open the site — there is no way to hide them from a visitor.
What can be stopped is one client flooding the server: each client address
gets a budget per sliding minute, and the endpoints that cost real CPU get a
second, tighter budget on top. Over budget, the request is answered with 429
and a Retry-After instead of being run.

Calibrated on the app itself: one change of the stream selection fires five
requests, two of them heat pump calculations, and ten changes as fast as the
checkboxes allow came to 50 requests in three seconds. The limits leave a
fast user well clear and stop a script. Both are environment variables so they
can be retuned on the server without a release.

The backend runs as a single uvicorn process (backend/Dockerfile), so these
in-memory counters are exact. With several workers each would count on its
own; move the counters to a shared store before adding workers.
"""

import math
import os
import threading
import time
from collections import defaultdict, deque
from typing import Callable, Deque, Dict

from fastapi import Request
from fastapi.responses import JSONResponse

WINDOW_SECONDS = 60.0

# Every /api request.
LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "600"))
# The calculations that take real CPU time, counted on top of the above.
HEAVY_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_HEAVY_PER_MINUTE", "120"))

HEAVY_PATHS = frozenset({
    "/api/analysis/hpi",
    "/api/analysis/hpi-optimization",
    "/api/analysis/report",
    "/api/analysis/map-preview",
})
# Monitoring has to keep working while a client is being throttled.
EXEMPT_PATHS = frozenset({"/api/health"})


class SlidingWindow:
    """At most `limit` hits per key in any `window` seconds."""

    def __init__(self, limit: int, window: float = WINDOW_SECONDS,
                 clock: Callable[[], float] = time.monotonic):
        self.limit = limit
        self.window = window
        self.clock = clock
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()
        self._calls = 0

    def hit(self, key: str) -> float:
        """Record a hit. Returns 0 if allowed, else the seconds until it would be."""
        now = self.clock()
        with self._lock:
            self._calls += 1
            if self._calls % 1000 == 0:
                self._forget_idle(now)
            hits = self._hits[key]
            while hits and hits[0] <= now - self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                return hits[0] + self.window - now
            hits.append(now)
            return 0.0

    def _forget_idle(self, now: float) -> None:
        # Clients that went quiet would otherwise be kept forever — a scanner
        # cycling through addresses could grow this without bound.
        for key in [k for k, h in self._hits.items() if not h or h[-1] <= now - self.window]:
            del self._hits[key]


all_requests = SlidingWindow(LIMIT_PER_MINUTE)
heavy_requests = SlidingWindow(HEAVY_LIMIT_PER_MINUTE)


def client_address(request: Request) -> str:
    """The client's address as the public proxy saw it.

    Behind Caddy every request arrives from Caddy itself, which records the
    real client as the last X-Forwarded-For entry. The last entry is the one
    Caddy wrote, so a client cannot dodge its budget by sending the header
    itself. The backend is reachable only through Caddy (docker-compose
    publishes no backend port); without a proxy, as in local development,
    the connection's own address is used.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


async def rate_limit(request: Request, call_next):
    path = request.url.path
    if not path.startswith("/api/") or path in EXEMPT_PATHS:
        return await call_next(request)

    client = client_address(request)
    wait = all_requests.hit(client)
    if not wait and path in HEAVY_PATHS:
        wait = heavy_requests.hit(client)
    if wait:
        return JSONResponse(
            {"detail": "Too many requests. Please wait a moment and try again."},
            status_code=429,
            headers={"Retry-After": str(max(1, math.ceil(wait)))},
        )
    return await call_next(request)
