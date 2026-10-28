FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Built from the repository root (see docker-compose.yml).
COPY backend/pyproject.toml ./
# Use the official uv binary
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uv/bin/uv
ENV PATH="/uv/bin:$PATH"

COPY backend/app/ ./app/
# The MCP server, served at /mcp, and the docs its explain() tool reads.
COPY mcp_server/ /opt/mcp_server/
COPY docs/ /opt/docs/
ENV HEATTRANSPLAN_DOCS=/opt/docs

# Use uv pip to install into the system site-packages (Note: uv pip is a Rust implementation, NOT legacy pip)
RUN uv pip install --system . /opt/mcp_server --no-cache-dir

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
