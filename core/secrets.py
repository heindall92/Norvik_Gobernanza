"""Secure storage for sensitive credentials via the OS keyring."""

from __future__ import annotations

import sqlite3

try:
    import keyring
    from keyring.errors import KeyringError
except ImportError:  # pragma: no cover
    keyring = None  # type: ignore[assignment]

    class KeyringError(Exception):
        pass


SERVICE_NAME = "NorvikGRC"
ACCOUNT_CLOUD_KEY = "ollama_cloud_key"
LEGACY_SETTING_KEY = "ollama_cloud_key"


def _keyring_available() -> bool:
    return keyring is not None


def get_cloud_api_key(conn: sqlite3.Connection) -> str:
    """Return the Ollama Cloud API key from the OS credential store."""
    if _keyring_available():
        try:
            stored = keyring.get_password(SERVICE_NAME, ACCOUNT_CLOUD_KEY)
            if stored:
                return stored
        except KeyringError:
            pass

    from core.settings import get_setting, set_setting

    legacy = get_setting(conn, LEGACY_SETTING_KEY, "")
    if legacy:
        set_cloud_api_key(conn, legacy)
        set_setting(conn, LEGACY_SETTING_KEY, "")
        return legacy
    return ""


def set_cloud_api_key(conn: sqlite3.Connection, value: str) -> None:
    """Persist the cloud API key outside SQLite."""
    from core.settings import set_setting

    cleaned = (value or "").strip()
    if _keyring_available():
        try:
            if cleaned:
                keyring.set_password(SERVICE_NAME, ACCOUNT_CLOUD_KEY, cleaned)
            else:
                try:
                    keyring.delete_password(SERVICE_NAME, ACCOUNT_CLOUD_KEY)
                except KeyringError:
                    pass
        except KeyringError:
            raise RuntimeError(
                "No se pudo guardar la API key en el almacén seguro del sistema. "
                "Comprueba que el Credential Manager de Windows esté disponible."
            ) from None

    set_setting(conn, LEGACY_SETTING_KEY, "")


def cloud_key_configured(conn: sqlite3.Connection) -> bool:
    return bool(get_cloud_api_key(conn))
