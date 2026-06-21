"""Application settings persisted in SQLite."""

from __future__ import annotations

from core.secrets import get_cloud_api_key, set_cloud_api_key

DEFAULTS: dict[str, str] = {
    "theme": "workspace",
    "theme_mode": "Dark",
    "accent_index": "8",
    "accent_color": "#ff6a4d",
    "corner_radius": "12",
    "font_mono": "0",
    "bg_image": "",
    "org_name": "Mi Organización",
    "ollama_model": "llama3.2",
    "ollama_host": "http://localhost:11434",
    "ollama_provider": "local",
    "ollama_cloud_host": "https://ollama.com",
    "ollama_cloud_key": "",
    "ollama_cloud_model": "gpt-oss:120b",
    "ai_system_prompt": "",
    "last_review": "",
    "next_audit": "",
    "user_name": "Responsable de Cumplimiento",
    "user_role": "Administrador",
    "user_email": "",
    "user_phone": "",
    "user_department": "",
    "user_location": "",
    "user_bio": "",
    "user_linkedin": "",
    "user_github": "",
    "user_twitter": "",
    "user_website": "",
    "user_avatar": "",
    "demo_mode": "0",
    "language": "es",
    "edition": "Enterprise Edition",
}

SETTING_KEYS = set(DEFAULTS.keys())


def get_setting(conn: sqlite3.Connection, key: str, default: str | None = None) -> str:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    if row:
        return row[0]
    return default if default is not None else DEFAULTS.get(key, "")


def set_setting(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )
    conn.commit()


def get_all_settings(conn: sqlite3.Connection) -> dict[str, str]:
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    merged = dict(DEFAULTS)
    merged.update({k: v for k, v in rows})
    legacy = merged.get("theme", "")
    if legacy in {"dasde", "nordic", "hybrid", "midnight"} and merged.get("theme_mode") == "Dark":
        mapping = {"dasde": ("7", "#8b5cf6"), "nordic": ("7", "#22d3ee"), "hybrid": ("8", "#ff6a4d"), "midnight": ("0", "#2f7bff")}
        idx, color = mapping.get(legacy, ("8", "#ff6a4d"))
        merged["accent_index"] = idx
        merged["accent_color"] = color
        merged["theme"] = "workspace"
    merged["ollama_cloud_key"] = get_cloud_api_key(conn)
    return merged


def save_settings(conn: sqlite3.Connection, data: dict[str, Any]) -> None:
    payload = dict(data)
    if "ollama_cloud_key" in payload:
        set_cloud_api_key(conn, str(payload.pop("ollama_cloud_key") or ""))
    for key, value in payload.items():
        if key in SETTING_KEYS and key != "ollama_cloud_key":
            set_setting(conn, key, str(value))


def settings_json(conn: sqlite3.Connection) -> str:
    return json.dumps(get_all_settings(conn), ensure_ascii=False)
