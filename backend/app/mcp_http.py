"""The MCP server online: the backend serves it at /mcp, so an agent (Claude
or any other) connects with the app's address alone, nothing installed.

The tools call this backend in-process. Online they never touch the server's
disk for a caller: files come in as content and results go out as download
links (/api/mcp/files/...). With API_KEYS set, /mcp wants one of them as
X-API-Key or "Authorization: Bearer <key>"."""

from __future__ import annotations

import contextlib
import json
import logging

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from heattransplan_mcp import server
from heattransplan_mcp.api import Api
from mcp.server.transport_security import TransportSecuritySettings

from app.dependencies import API_KEYS

router = APIRouter()


@router.get("/files/{token}/{name}")
async def download(token: str, name: str):
    found = server.download(token)
    if not found or found[0] != name:
        raise HTTPException(404, "This download link has expired; ask the assistant for a new one.")
    filename, data, media_type, _ = found
    return Response(data, media_type=media_type,
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


def _base_url(headers: dict) -> str:
    """The address the caller used, through Caddy or Vite's proxy."""
    proto = headers.get(b"x-forwarded-proto", b"http").decode().split(",")[0].strip()
    host = (headers.get(b"x-forwarded-host") or headers.get(b"host", b"")).decode().split(",")[0].strip()
    return f"{proto}://{host}"


class McpEndpoint:
    """ASGI app at /mcp: checks the key, notes the public address, hands over."""

    handler = None

    async def __call__(self, scope, receive, send):
        headers = dict(scope["headers"])
        if API_KEYS:
            key = headers.get(b"x-api-key", b"").decode()
            bearer = headers.get(b"authorization", b"").decode()
            if bearer.lower().startswith("bearer "):
                key = key or bearer[7:].strip()
            if key not in API_KEYS:
                await Response(json.dumps({"detail": "Missing or invalid API key"}), 401,
                               media_type="application/json")(scope, receive, send)
                return
        if self.handler is None:
            await Response("MCP is starting", 503)(scope, receive, send)
            return
        token = server.BASE_URL.set(_base_url(headers))
        try:
            await self.handler(scope, receive, send)
        finally:
            server.BASE_URL.reset(token)


endpoint = McpEndpoint()


@contextlib.asynccontextmanager
async def lifespan(app):
    """Run the MCP session manager and point the tools at this app."""
    client = httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://backend", timeout=330,
        headers={"X-API-Key": API_KEYS[0]} if API_KEYS else {})
    # The session manager logs every stateless request at INFO.
    logging.getLogger("mcp.server.streamable_http").setLevel(logging.WARNING)
    server.HOSTED = True
    server.set_api(Api(base_url="http://backend", api_key="", client=client))
    # Stateless JSON: every call stands alone, nothing to keep per client.
    # The Host check guards local servers against DNS rebinding; this one is public by design.
    endpoint.handler = server.mcp.streamable_http_app(
        stateless_http=True, json_response=True,
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False))
    try:
        async with server.mcp.session_manager.run():
            yield
    finally:
        endpoint.handler = None
        server.HOSTED = False
        await client.aclose()
