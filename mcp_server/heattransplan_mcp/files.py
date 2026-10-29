"""Files the tools take from or hand back to the user, locally or online."""

from __future__ import annotations

import base64
import binascii
import json
import os
import re
import secrets
import time
from contextvars import ContextVar
from pathlib import Path
from typing import Any, Dict, Optional

from heattransplan_mcp.api import ApiError

# ── Files ───────────────────────────────────────────────────────────────────
# Run locally (stdio) the tools read and write files on the user's computer.
# Served online (the backend's /mcp, see backend/app/mcp_http.py) the server
# must never touch its own disk for a caller: files come in as content and go
# out as download links.

HOSTED = False
# Public address of the app, for download links; set per request when hosted.
BASE_URL: ContextVar[str] = ContextVar("BASE_URL", default=os.getenv("PUBLIC_URL", ""))
DOWNLOAD_SECONDS = 3600
# token → (file name, bytes, media type, expiry). ponytail: in memory, one process (as live sessions).
_downloads: Dict[str, tuple] = {}


def _read_input(file_path: Optional[str], content: Any) -> tuple[str, bytes]:
    """(name, bytes) of a file the user gives: by content, or by a local path."""
    name = Path(file_path).name if file_path else "upload"
    if isinstance(content, (dict, list)):
        # JSON given as text arrives parsed.
        return name, json.dumps(content).encode("utf-8")
    if content is not None:
        try:
            return name, base64.b64decode(content, validate=True)
        except (binascii.Error, ValueError):
            return name, content.encode("utf-8")
    if HOSTED:
        raise ApiError("This HeatTransPlan server runs online and cannot open files on the user's "
                       "computer. Pass the file as content (base64, or text for CSV/JSON), or ask "
                       "the user to load it on the page.")
    if not file_path:
        raise ApiError("Give file_path or content.")
    path = Path(file_path).expanduser()
    try:
        return path.name, path.read_bytes()
    except OSError as exc:
        raise ApiError(f"Cannot open {path}: {exc.strerror}") from exc


def _deliver(file_path: Optional[str], default_name: str, data: bytes, media_type: str) -> str:
    """Write a result to the user's computer, or online hand out a download link."""
    if not HOSTED:
        if not file_path:
            raise ApiError("file_path is needed: where to save it.")
        path = Path(file_path).expanduser()
        path.write_bytes(data)
        return f"Saved to {path}"
    now = time.time()
    for token in [t for t, f in _downloads.items() if f[3] < now]:
        del _downloads[token]
    token = secrets.token_urlsafe(16)
    name = re.sub(r"[^\w.-]", "_", Path(file_path).name) if file_path else default_name
    _downloads[token] = (name, data, media_type, now + DOWNLOAD_SECONDS)
    return (f"Download link for the user (valid for an hour): "
            f"{BASE_URL.get().rstrip('/')}/api/mcp/files/{token}/{name}")


def download(token: str) -> Optional[tuple]:
    """A file handed out by _deliver, while its link is valid."""
    found = _downloads.get(token)
    return found if found and found[3] >= time.time() else None
