# --- Build Stage for Frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install

COPY frontend/ ./
RUN npm run build

# --- Build Stage for Backend ---
FROM python:3.13-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Use the official uv binary
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uv/bin/uv
ENV PATH="/uv/bin:$PATH"

# Editable install: one copy of the code, at /app/backend/app. The previous
# COPY+install twice left a second copy in site-packages that could go stale.
COPY backend/ ./backend/
# The MCP server, served at /mcp; explain() finds docs/ next to it (editable).
COPY mcp_server/ ./mcp_server/
COPY docs/ ./docs/
RUN cd backend && uv pip install --system -e . -e ../mcp_server --no-cache-dir

# Copy built frontend from the frontend-builder stage
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Runtime assets the backend loads: the COP model and its training data.
# cop_analysis/ is notebooks only and is deliberately not copied.
COPY data/ ./backend/data/
COPY models/ ./backend/models/

# Expose Hugging Face Space port
EXPOSE 7860

# One process: projects are shared through the filesystem, but the live
# sessions behind Connect AI, the MCP download links and the rate limiter live
# in memory. The computing endpoints run in uvicorn's thread pool.
ENV HEATTRANSPLAN_STATE_DIR=/app/state
RUN mkdir -p /app/state

# Run uvicorn server
WORKDIR /app/backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860", "--proxy-headers", "--forwarded-allow-ips", "*"]