"""User profile photo storage (local app data)."""

from __future__ import annotations

import base64
import re
from pathlib import Path

from core.database import get_app_data_dir
from core.settings import get_setting, set_setting

AVATAR_DIR_NAME = "avatars"
AVATAR_FILENAME = "profile.jpg"
MAX_BYTES = 2 * 1024 * 1024  # 2 MB


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


def save_avatar_data_url(conn, data_url: str) -> dict:
    if not data_url or not data_url.startswith("data:image/"):
        raise ValueError("Formato de imagen no válido")

    match = re.match(r"^data:image/(png|jpe?g|webp);base64,(.+)$", data_url, re.I | re.S)
    if not match:
        raise ValueError("Solo se admiten PNG, JPEG o WebP")

    raw = base64.b64decode(match.group(2), validate=True)
    if len(raw) > MAX_BYTES:
        raise ValueError("La imagen supera el límite de 2 MB")

    path = get_avatar_path()
    path.write_bytes(raw)
    set_setting(conn, "user_avatar", AVATAR_FILENAME)
    return {"ok": True, "url": avatar_file_url()}


def remove_avatar(conn) -> None:
    path = get_avatar_path()
    if path.exists():
        path.unlink()
    set_setting(conn, "user_avatar", "")


def avatar_setting(conn) -> str:
    return get_setting(conn, "user_avatar", "")
