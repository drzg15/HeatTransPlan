import logging
import re
import time

from fastapi import FastAPI, Depends, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from app.config import AI_ENABLED, CORS_ORIGINS
from app.routers import projects, processes, streams, analysis, io_routes, assets, live
from app.services import activity_log, cop_training
from app.dependencies import API_KEYS, verify_api_key
from app.rate_limit import RateLimit

# The MCP server online, when AI access is on and its package is installed
# (see app/mcp_http.py).
mcp_http = None
if AI_ENABLED:
    try:
        from app import mcp_http
    except ModuleNotFoundError as exc:
        if (exc.name or "").split(".")[0] not in ("heattransplan_mcp", "mcp"):
            raise
        logging.getLogger(__name__).warning("Not serving MCP at /mcp: %s", exc)

app = FastAPI(
    lifespan=mcp_http.lifespan if mcp_http else None,
    title="HeatTransPlan API",
    version="1.0.0",
    description="Backend API for HeatTransPlan heat integration analysis",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# What the log leaves out: reads, the page reporting its view, the AI's page
# commands and their answers, and its activity notes (live.record writes one
# row per tool instead), and /mcp (each tool's calls to the API are logged as
# the AI's).
_QUIET = re.compile(r"^/api/live/(sessions/[^/]+/(view|commands(/.*)?)|pages/[^/]+/log)$|^/mcp")


@app.middleware("http")
async def activity(request: Request, call_next):
    """One anonymous row per change (and per failure): which feature, human or AI."""
    start = time.perf_counter()
    log = request.method not in ("GET", "HEAD", "OPTIONS") and not _QUIET.match(request.url.path)
    actor = activity_log.actor_of(request.headers.get("x-actor"))
    def action():
        # The route's pattern, not the path: a path carries project ids and page codes.
        if "route" not in request.scope:
            return f"{request.method} (no route)"
        path = request.url.path
        for name, value in request.scope.get("path_params", {}).items():
            path = path.replace(str(value), "{" + name + "}")
        return f"{request.method} {path}"

    try:
        response = await call_next(request)
    except Exception as exc:
        await run_in_threadpool(activity_log.write, "system", action(),
                                f"{actor}'s request failed: {activity_log.where_it_failed(exc)}", 500)
        raise
    if log or response.status_code >= 500:
        await run_in_threadpool(
            activity_log.write, actor if response.status_code < 500 else "system", action(),
            getattr(request.state, "log_detail", ""), response.status_code,
            round((time.perf_counter() - start) * 1000))
    return response


# Requests per visitor (app/rate_limit.py); added first so CORS wraps its answers.
app.add_middleware(RateLimit)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers with API Key verification
api_dependencies = [Depends(verify_api_key)]

app.include_router(projects.router, prefix="/api/projects", tags=["Projects"], dependencies=api_dependencies)
app.include_router(processes.router, prefix="/api", tags=["Processes"], dependencies=api_dependencies)
app.include_router(streams.router, prefix="/api", tags=["Streams"], dependencies=api_dependencies)
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"], dependencies=api_dependencies)
app.include_router(io_routes.router, prefix="/api/io", tags=["Import/Export"], dependencies=api_dependencies)
app.include_router(assets.router, prefix="/api/assets", tags=["Assets"], dependencies=api_dependencies)
if AI_ENABLED:
    app.include_router(live.router, prefix="/api/live", tags=["Live"], dependencies=api_dependencies)
# Optional modules: mounted only while switched on.
if cop_training.ENABLED:
    from app.routers import cop_training as cop_training_router

    app.include_router(cop_training_router.router, prefix="/api/analysis/cop-model",
                       tags=["COP training"], dependencies=api_dependencies)


@app.get("/api/features")
async def features():
    """Which optional modules this server runs, so the page shows only those."""
    return {"cop_training": cop_training.ENABLED, "ai": AI_ENABLED, "mcp": mcp_http is not None,
            "api_key": bool(API_KEYS)}


if mcp_http:
    # Its own key check (Bearer too, as agents send it); before the page's catch-all below.
    app.add_route("/mcp", mcp_http.endpoint, methods=["GET", "POST", "DELETE"])
    app.include_router(mcp_http.router, prefix="/api/mcp", tags=["MCP"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}

# Serve frontend static files
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")
if os.path.isdir(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Serve specific files from root if they exist — only inside dist:
        # "/%2e%2e/…" must not reach the source, .env or /proc.
        target_file = os.path.realpath(os.path.join(frontend_dist, full_path))
        if target_file.startswith(os.path.realpath(frontend_dist) + os.sep) and os.path.isfile(target_file):
            return FileResponse(target_file)
        # Otherwise fallback to index.html for SPA routing
        return FileResponse(os.path.join(frontend_dist, "index.html"))
