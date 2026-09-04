from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.routers import projects, processes, streams, analysis, io_routes, assets
from app.dependencies import verify_api_key

app = FastAPI(
    title="HeatTransPlan API",
    version="1.0.0",
    description="Backend API for HeatTransPlan heat integration analysis",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

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
        # Serve specific files from root if they exist
        target_file = os.path.join(frontend_dist, full_path)
        if os.path.isfile(target_file):
            return FileResponse(target_file)
        # Otherwise fallback to index.html for SPA routing
        return FileResponse(os.path.join(frontend_dist, "index.html"))
