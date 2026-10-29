# The documentation site, served by the app itself at /docs (see the root
# Caddyfile). Built from the repository root: the pages include source code
# from backend/, frontend/ and mcp_server/ ("Show implementation").

FROM python:3.13-slim AS build
WORKDIR /repo
COPY docs/requirements.txt docs/requirements.txt
RUN pip install --no-cache-dir -r docs/requirements.txt
COPY docs/ docs/
COPY backend/app/ backend/app/
COPY frontend/src/ frontend/src/
COPY mcp_server/heattransplan_mcp/ mcp_server/heattransplan_mcp/
RUN sphinx-build -q -b html docs /site

FROM caddy:2-alpine
COPY --from=build /site /srv
EXPOSE 80
CMD ["caddy", "file-server", "--root", "/srv", "--listen", ":80"]
