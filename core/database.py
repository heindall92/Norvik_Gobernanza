"""SQLite database initialization, migrations and seed."""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path

from core.frameworks import export_framework_json, seed_frameworks
from core.build_profile import APP_DATA_FOLDER, DEMO_ORG_NAME, IS_DEMO_BUILD
from core.settings import DEFAULTS, get_setting, set_setting

DEMO_NOTE = "[DEMO] Evaluación de demostración — no usar en informes oficiales"
LEGACY_DEMO_NOTE = "Evaluación inicial de demostración"

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
        base = Path(appdata) / APP_DATA_FOLDER
    else:
        base = Path.home() / f".{APP_DATA_FOLDER.lower()}"
    base.mkdir(parents=True, exist_ok=True)
    return base


def get_db_path() -> Path:
    return get_app_data_dir() / "norvik.db"


def get_documents_dir() -> Path:
    docs = Path.home() / "Documents" / APP_DATA_FOLDER
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

    _migrate_legacy_demo_flag(conn)
    _bootstrap_demo_build(conn)
    export_framework_json()
    conn.commit()
    return conn


def _bootstrap_demo_build(conn: sqlite3.Connection) -> None:
    """Demo executable: separate data folder + fictitious assessments on first run."""
    if not IS_DEMO_BUILD:
        return
    assessed = conn.execute("SELECT COUNT(*) AS c FROM assessments").fetchone()["c"]
    if int(assessed) == 0:
        load_demo_assessments(conn)
    set_setting(conn, "edition", "Demo Edition")
    set_setting(conn, "org_name", DEMO_ORG_NAME)
    org_id = get_organization_id(conn)
    conn.execute("UPDATE organizations SET name = ? WHERE id = ?", (DEMO_ORG_NAME, org_id))
    conn.commit()


def _migrate_legacy_demo_flag(conn: sqlite3.Connection) -> None:
    """Mark existing auto-seeded demo rows as demo mode (upgrade path)."""
    if get_setting(conn, "demo_mode", "0") == "1":
        return
    row = conn.execute(
        """
        SELECT COUNT(*) AS c FROM assessments
        WHERE notes LIKE ? OR notes = ?
        """,
        (f"{DEMO_NOTE}%", LEGACY_DEMO_NOTE),
    ).fetchone()
    if row and int(row["c"]) > 0:
        set_setting(conn, "demo_mode", "1")
        conn.execute(
            "UPDATE assessments SET notes = ? WHERE notes = ?",
            (DEMO_NOTE, LEGACY_DEMO_NOTE),
        )
        conn.commit()


def load_demo_assessments(conn: sqlite3.Connection) -> int:
    """Opt-in demo data for exploration. Returns number of controls seeded."""
    org_id = get_organization_id(conn)
    controls = conn.execute(
        """
        SELECT c.id, c.weight, (ABS(c.id * 17) % 6) AS demo_level
        FROM controls c
        """
    ).fetchall()
    count = 0
    now = datetime.now().isoformat()
    for row in controls:
        demo_level = int(row["demo_level"])
        if demo_level == 5 and row["weight"] >= 3:
            demo_level = 2
        conn.execute(
            """
            INSERT INTO assessments
            (organization_id, control_id, maturity_level, notes, assessed_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(organization_id, control_id) DO UPDATE SET
                maturity_level = excluded.maturity_level,
                notes = excluded.notes,
                assessed_at = excluded.assessed_at
            """,
            (org_id, row["id"], demo_level, DEMO_NOTE, now),
        )
        count += 1
    set_setting(conn, "demo_mode", "1")
    set_setting(conn, "last_review", datetime.now().strftime("%d/%m/%Y %H:%M"))
    conn.commit()
    return count


def clear_demo_assessments(conn: sqlite3.Connection) -> int:
    """Remove demo assessments only."""
    org_id = get_organization_id(conn)
    cur = conn.execute(
        """
        DELETE FROM assessments
        WHERE organization_id = ? AND (notes LIKE ? OR notes = ?)
        """,
        (org_id, f"{DEMO_NOTE}%", LEGACY_DEMO_NOTE),
    )
    set_setting(conn, "demo_mode", "0")
    conn.commit()
    return cur.rowcount


def is_demo_mode(conn: sqlite3.Connection) -> bool:
    return get_setting(conn, "demo_mode", "0") == "1"


def _seed_demo_assessments(conn: sqlite3.Connection) -> None:
    """Deprecated: use load_demo_assessments() explicitly."""
    load_demo_assessments(conn)


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
