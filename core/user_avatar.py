"""User profile photo storage (local app data)."""

from __future__ import annotations

import base64
import re
from pathlib import Path

from core.database import get_app_data_dir
from core.settings import get_setting, set_setting

AVATAR_DIR_NAME = "avatars"
AVATAR_FILENAME = "profile.jpg"
MAX_BYTES = 3 * 1024 * 1024  # 3 MB


def get_avatar_dir() -> Path:
    path = get_app_data_dir() / AVATAR_DIR_NAME
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_avatar_path() -> Path:
    return get_avatar_dir() / AVATAR_FILENAME


def avatar_file_url() -> str:
    """Return a file:// URI for the stored avatar, or empty string."""
    path = get_avatar_path()
    if not path.is_file():
        return ""
    return path.resolve().as_uri()


def _mime_for_bytes(raw: bytes, path: Path) -> str:
    if raw[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if raw[:4] == b"RIFF" and len(raw) >= 12 and raw[8:12] == b"WEBP":
        return "image/webp"
    ext = path.suffix.lower()
    if ext == ".png":
        return "image/png"
    if ext == ".webp":
        return "image/webp"
    return "image/jpeg"


def avatar_data_url() -> str:
    """Return a data: URI for WebEngine (file:// cross-origin is blocked)."""
    path = get_avatar_path()
    if not path.is_file():
        return ""
    raw = path.read_bytes()
    if not raw or len(raw) > MAX_BYTES:
        return ""
    mime = _mime_for_bytes(raw, path)
    b64 = base64.b64encode(raw).decode("ascii")
    return f"data:{mime};base64,{b64}"


def save_avatar_data_url(conn, data_url: str) -> dict:
    if not data_url or not data_url.startswith("data:image/"):
        raise ValueError("Formato de imagen no válido")

    match = re.match(r"^data:image/(png|jpe?g|webp);base64,(.+)$", data_url, re.I | re.S)
    if not match:
        raise ValueError("Solo se admiten PNG, JPEG o WebP")

    raw = base64.b64decode(match.group(2), validate=True)
    if len(raw) > MAX_BYTES:
        raise ValueError("La imagen supera el límite de 3 MB")

    path = get_avatar_path()
    path.write_bytes(raw)
    set_setting(conn, "user_avatar", AVATAR_FILENAME)
    return {"ok": True, "url": avatar_data_url()}


def remove_avatar(conn) -> None:
    path = get_avatar_path()
    if path.exists():
        path.unlink()
    set_setting(conn, "user_avatar", "")


def avatar_setting(conn) -> str:
    return get_setting(conn, "user_avatar", "")
