"""Framework loaders and JSON export."""

from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

from core.seed_data import FRAMEWORKS

def _project_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent.parent


PROJECT_ROOT = _project_root()
FRAMEWORKS_DIR = PROJECT_ROOT / "data" / "frameworks"


def export_framework_json() -> None:
    FRAMEWORKS_DIR.mkdir(parents=True, exist_ok=True)
    mapping = {
        "NIST_CSF2": "nist_csf_2.json",
        "ISO27001": "iso27001.json",
        "CIS_V8": "cis_v8.json",
        "RGPD": "rgpd.json",
    }
    for code, filename in mapping.items():
        fw = FRAMEWORKS[code]
        payload = {
            "code": fw["code"],
            "name": fw["name"],
            "version": fw["version"],
            "controls": fw["controls"],
        }
        path = FRAMEWORKS_DIR / filename
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def load_framework_json(code: str) -> dict:
    mapping = {
        "NIST_CSF2": "nist_csf_2.json",
        "ISO27001": "iso27001.json",
        "CIS_V8": "cis_v8.json",
        "RGPD": "rgpd.json",
    }
    path = FRAMEWORKS_DIR / mapping[code]
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return FRAMEWORKS[code]


def seed_frameworks(conn: sqlite3.Connection) -> None:
    for fw in FRAMEWORKS.values():
        conn.execute(
            "INSERT INTO frameworks (code, name, version) VALUES (?, ?, ?)",
            (fw["code"], fw["name"], fw["version"]),
        )
        fw_row = conn.execute(
            "SELECT id FROM frameworks WHERE code = ?", (fw["code"],)
        ).fetchone()
        fw_id = fw_row["id"]
        for ctrl in fw["controls"]:
            conn.execute(
                """
                INSERT INTO controls
                (framework_id, domain, control_id, title, description, weight)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    fw_id,
                    ctrl["domain"],
                    ctrl["control_id"],
                    ctrl["title"],
                    ctrl.get("description", ""),
                    ctrl.get("weight", 1),
                ),
            )
    conn.commit()


def get_framework_by_code(conn: sqlite3.Connection, code: str) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT * FROM frameworks WHERE code = ?", (code,)
    ).fetchone()


def list_frameworks(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM frameworks ORDER BY id").fetchall()
