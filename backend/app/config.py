import os
from pathlib import Path

# Base directory of the app package
BASE_DIR = Path(__file__).resolve().parent

# Data directory
DATA_DIR = BASE_DIR / "data"
EXAMPLES_DIR = DATA_DIR / "examples"
PROCESS_MODELS_PATH = DATA_DIR / "process_models.json"

# CORS origins — allow the React frontend dev server and production
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173",
).split(",")

# AI access (Connect AI on the page, the live endpoints, the MCP server at
# /mcp). AI_ENABLED=0 switches all of it off; the rest of the app is unchanged.
AI_ENABLED = os.getenv("AI_ENABLED", "1").lower() not in ("0", "false", "off", "no")

# Server settings
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
