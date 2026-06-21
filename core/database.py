"""SQLite database initialization, migrations and seed."""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path

from core.frameworks import export_framework_json, seed_frameworks
from core.settings import DEFAULTS, set_setting

SCHEMA = """
CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS frameworks (
    id INTEGER PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    version TEXT
);

CREATE TABLE IF NOT EXISTS controls (
    id INTEGER PRIMARY KEY,
    framework_id INTEGER REFERENCES frameworks(id),
    domain TEXT NOT NULL,
    control_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    weight INTEGER DEFAULT 1,
    UNIQUE(framework_id, control_id)
);

CREATE TABLE IF NOT EXISTS assessments (
    id INTEGER PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    control_id INTEGER REFERENCES controls(id),
    maturity_level INTEGER CHECK(maturity_level BETWEEN 0 AND 5),
    notes TEXT,
    assessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, control_id)
);

CREATE TABLE IF NOT EXISTS recommendations (
    id INTEGER PRIMARY KEY,
    assessment_id INTEGER REFERENCES assessments(id),
    content TEXT NOT NULL,
    generated_by TEXT DEFAULT 'ollama',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


def get_app_data_dir() -> Path:
    appdata = os.environ.get("APPDATA")
    if appdata:
        base = Path(appdata) / "Norvik"
    else:
        base = Path.home() / ".norvik"
    base.mkdir(parents=True, exist_ok=True)
    return base


def get_db_path() -> Path:
    return get_app_data_dir() / "norvik.db"


def get_documents_dir() -> Path:
    docs = Path.home() / "Documents" / "Norvik"
    docs.mkdir(parents=True, exist_ok=True)
    return docs


def connect(db_path: Path | None = None) -> sqlite3.Connection:
    path = db_path or get_db_path()
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def initialize(db_path: Path | None = None) -> sqlite3.Connection:
    conn = connect(db_path)
    conn.executescript(SCHEMA)

    for key, value in DEFAULTS.items():
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
            (key, value),
        )

    org = conn.execute("SELECT id FROM organizations LIMIT 1").fetchone()
    if not org:
        conn.execute(
            "INSERT INTO organizations (name) VALUES (?)",
            (DEFAULTS["org_name"],),
        )
        conn.commit()

    fw_count = conn.execute("SELECT COUNT(*) AS c FROM frameworks").fetchone()["c"]
    if fw_count == 0:
        seed_frameworks(conn)
        _seed_demo_assessments(conn)

    export_framework_json()
    conn.commit()
    return conn


def _seed_demo_assessments(conn: sqlite3.Connection) -> None:
    """Seed demo maturity levels so dashboard is populated on first run."""
    org_id = conn.execute("SELECT id FROM organizations LIMIT 1").fetchone()["id"]
    controls = conn.execute(
        """
        SELECT c.id, c.framework_id, c.weight,
               (ABS(c.id * 17) % 6) AS demo_level
        FROM controls c
        """
    ).fetchall()

    for row in controls:
        demo_level = int(row["demo_level"])
        if demo_level == 5 and row["weight"] >= 3:
            demo_level = 2
        conn.execute(
            """
            INSERT OR IGNORE INTO assessments
            (organization_id, control_id, maturity_level, notes, assessed_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                org_id,
                row["id"],
                demo_level,
                "Evaluación inicial de demostración",
                datetime.now().isoformat(),
            ),
        )
    conn.commit()


def get_organization_id(conn: sqlite3.Connection) -> int:
    row = conn.execute("SELECT id FROM organizations LIMIT 1").fetchone()
    if not row:
        conn.execute("INSERT INTO organizations (name) VALUES (?)", ("Mi Organización",))
        conn.commit()
        row = conn.execute("SELECT id FROM organizations LIMIT 1").fetchone()
    return int(row["id"])


def update_org_name(conn: sqlite3.Connection, name: str) -> None:
    org_id = get_organization_id(conn)
    conn.execute("UPDATE organizations SET name = ? WHERE id = ?", (name, org_id))
    set_setting(conn, "org_name", name)
