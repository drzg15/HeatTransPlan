"""The HeatTransPlan backend over HTTP. Errors come back as readable text,
which is what the AI sees."""

from __future__ import annotations

import os
from typing import Any, Optional

import httpx
from mcp.server.mcpserver.exceptions import ToolError

DEFAULT_URL = "http://localhost:8000"


class ApiError(ToolError):
    """A failure the AI should read: its text reaches the model."""


class Api:
    def __init__(self, base_url: Optional[str] = None, api_key: Optional[str] = None,
                 client: Optional[httpx.AsyncClient] = None):
        self.base_url = (base_url or os.getenv("HEATTRANSPLAN_URL") or DEFAULT_URL).rstrip("/")
        key = api_key if api_key is not None else os.getenv("HEATTRANSPLAN_API_KEY", "")
        headers = {"X-API-Key": key} if key else {}
        # Optimizations and reports take a few seconds; live commands wait for the page.
        self.client = client or httpx.AsyncClient(base_url=self.base_url, headers=headers, timeout=330)

    async def request(self, method: str, path: str, **kwargs: Any) -> Any:
        try:
            r = await self.client.request(method, path, **kwargs)
        except httpx.HTTPError as exc:
            raise ApiError(f"Cannot reach HeatTransPlan at {self.base_url}: {exc}") from exc
        if r.status_code >= 400:
            try:
                detail = r.json().get("detail", r.text)
            except ValueError:
                detail = r.text
            raise ApiError(f"{method} {path} failed ({r.status_code}): {detail}")
        if "json" in r.headers.get("content-type", ""):
            return r.json()
        return r.text

    async def get(self, path: str, **kw: Any) -> Any:
        return await self.request("GET", path, **kw)

    async def post(self, path: str, json: Any = None, **kw: Any) -> Any:
        return await self.request("POST", path, json=json, **kw)

    async def put(self, path: str, json: Any = None, **kw: Any) -> Any:
        return await self.request("PUT", path, json=json, **kw)

    async def delete(self, path: str, **kw: Any) -> Any:
        return await self.request("DELETE", path, **kw)
