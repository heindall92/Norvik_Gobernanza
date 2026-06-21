"""CMM maturity scoring engine (L0-L5) — optimized queries."""

from __future__ import annotations

import sqlite3
from datetime import datetime

from core.database import get_organization_id, exit_demo_mode_on_real_entry, should_show_demo_ui
from core.settings import get_setting

NIST_DOMAINS = ["Govern", "Identify", "Protect", "Detect", "Respond", "Recover"]
TARGET_LEVEL = 3

CMM_LEVEL_NAMES = {
    0: "Inexistente",
    1: "Inicial",
    2: "Repetible",
    3: "Definido",
    4: "Gestionado",
    5: "Optimizado",
}


def level_to_percent(level: float) -> float:
    return round((level / 5.0) * 100, 1)


def level_label(avg_level: float) -> str:
    """Etiqueta CMM legible: 'Nivel 3.5 — Definido'."""
    rounded = int(round(avg_level))
    rounded = max(0, min(5, rounded))
    name = CMM_LEVEL_NAMES.get(rounded, "Inexistente")
    shown = round(avg_level, 1)
    shown_str = str(int(shown)) if shown == int(shown) else str(shown)
    return f"Nivel {shown_str} — {name}"


def score_to_grade(score: float) -> str:
    thresholds = [
        (90, "A+"), (85, "A"), (80, "A-"), (75, "B+"), (70, "B"),
        (65, "B-"), (60, "C+"), (55, "C"), (50, "C-"), (40, "D"),
    ]
    for limit, grade in thresholds:
        if score >= limit:
            return grade
    return "E"


def severity_for_gap(current: int, target: int = TARGET_LEVEL) -> str:
    gap = target - current
    if current <= 1 or gap >= 3:
        return "critical"
    if gap >= 2 or current == 2:
        return "warning"
    return "info"


def _fetch_control_rows(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    org_id = get_organization_id(conn)
    return conn.execute(
        """
        SELECT c.id, c.control_id, c.title, c.domain, c.weight,
               f.code AS framework_code, f.name AS framework_name,
               COALESCE(a.maturity_level, 0) AS maturity_level
        FROM controls c
        JOIN frameworks f ON f.id = c.framework_id
        LEFT JOIN assessments a ON a.control_id = c.id AND a.organization_id = ?
        """,
        (org_id,),
    ).fetchall()


def compute_framework_score_from_rows(rows: list[sqlite3.Row], framework_code: str) -> dict:
    subset = [r for r in rows if r["framework_code"] == framework_code]
    if not subset:
        return {"score": 0, "count": 0, "avg_level": 0}
    total_weight = sum(r["weight"] for r in subset)
    weighted = sum(r["maturity_level"] * r["weight"] for r in subset)
    avg_level = weighted / total_weight if total_weight else 0
    return {
        "score": level_to_percent(avg_level),
        "count": len(subset),
        "avg_level": round(avg_level, 2),
    }


def compute_framework_score(conn: sqlite3.Connection, framework_code: str) -> dict:
    return compute_framework_score_from_rows(_fetch_control_rows(conn), framework_code)


def compute_global_score_from_rows(rows: list[sqlite3.Row]) -> float:
    if not rows:
        return 0.0
    total_weight = sum(r["weight"] for r in rows)
    weighted = sum(r["maturity_level"] * r["weight"] for r in rows)
    return level_to_percent(weighted / total_weight) if total_weight else 0.0


def compute_global_score(conn: sqlite3.Connection) -> float:
    return compute_global_score_from_rows(_fetch_control_rows(conn))


def get_alerts_from_rows(
    rows: list[sqlite3.Row],
    framework_code: str | None = None,
    limit: int = 20,
) -> list[dict]:
    alerts = []
    for row in rows:
        if row["maturity_level"] >= TARGET_LEVEL:
            continue
        if framework_code and framework_code != "ALL" and row["framework_code"] != framework_code:
            continue
        current = int(row["maturity_level"])
        alerts.append(
            {
                "id": row["id"],
                "control_id": row["control_id"],
                "title": row["title"],
                "domain": row["domain"],
                "framework": row["framework_code"],
                "framework_name": row["framework_name"],
                "current_level": current,
                "target_level": TARGET_LEVEL,
                "severity": severity_for_gap(current),
                "description": f"Nivel {current}/5 — objetivo {TARGET_LEVEL}/5",
            }
        )
    alerts.sort(key=lambda a: (a["current_level"], -len(a["title"])))
    return alerts[:limit]


def get_alerts(conn: sqlite3.Connection, framework_code: str | None = None, limit: int = 20) -> list[dict]:
    return get_alerts_from_rows(_fetch_control_rows(conn), framework_code, limit)


def count_by_severity_from_rows(rows: list[sqlite3.Row]) -> dict[str, int]:
    critical = warning = 0
    for row in rows:
        if row["maturity_level"] >= TARGET_LEVEL:
            continue
        sev = severity_for_gap(int(row["maturity_level"]))
        if sev == "critical":
            critical += 1
        elif sev == "warning":
            warning += 1
    ok = sum(1 for r in rows if r["maturity_level"] >= TARGET_LEVEL)
    return {"critical": critical, "warning": warning, "ok": ok}


def count_by_severity(conn: sqlite3.Connection) -> dict[str, int]:
    return count_by_severity_from_rows(_fetch_control_rows(conn))


def get_heatmap_from_rows(rows: list[sqlite3.Row]) -> list[dict]:
    heatmap = []
    nist_rows = [r for r in rows if r["framework_code"] == "NIST_CSF2"]
    for domain in NIST_DOMAINS:
        domain_rows = [r for r in nist_rows if r["domain"] == domain]
        if not domain_rows:
            heatmap.append({"domain": domain, "level": 0})
            continue
        avg = sum(r["maturity_level"] for r in domain_rows) / len(domain_rows)
        heatmap.append({"domain": domain, "level": round(avg, 1)})
    return heatmap


def get_heatmap(conn: sqlite3.Connection) -> list[dict]:
    return get_heatmap_from_rows(_fetch_control_rows(conn))


def get_radar_data_from_rows(rows: list[sqlite3.Row]) -> list[dict]:
    frameworks = [
        ("NIST", "NIST_CSF2"),
        ("ISO", "ISO27001"),
        ("CIS", "CIS_V8"),
        ("RGPD", "RGPD"),
    ]
    data = []
    for label, code in frameworks:
        score = compute_framework_score_from_rows(rows, code)
        data.append({"axis": label, "value": score["score"]})
    global_score = compute_global_score_from_rows(rows)
    data.append({"axis": "CMM", "value": global_score})
    gov_rows = [r for r in rows if r["framework_code"] == "NIST_CSF2" and r["domain"] == "Govern"]
    if gov_rows:
        gov_avg = sum(r["maturity_level"] for r in gov_rows) / len(gov_rows)
        gov_score = level_to_percent(gov_avg)
    else:
        gov_score = compute_framework_score_from_rows(rows, "NIST_CSF2")["score"]
    data.append({"axis": "Gov.", "value": gov_score})
    return data


def get_radar_data(conn: sqlite3.Connection) -> list[dict]:
    return get_radar_data_from_rows(_fetch_control_rows(conn))


def get_framework_bars_from_rows(rows: list[sqlite3.Row]) -> list[dict]:
    items = [
        ("NIST CSF 2.0", "NIST_CSF2"),
        ("ISO 27001:2022", "ISO27001"),
        ("CIS Controls v8", "CIS_V8"),
        ("RGPD", "RGPD"),
    ]
    bars = []
    for label, code in items:
        score = compute_framework_score_from_rows(rows, code)
        bars.append(
            {
                "label": label,
                "code": code,
                "percent": score["score"],
                "avg_level": score["avg_level"],
                "level_label": level_label(score["avg_level"]),
                "count": score["count"],
            }
        )
    global_score = compute_global_score_from_rows(rows)
    global_avg = global_score / 20.0 if global_score else 0.0
    bars.append(
        {
            "label": "CMM Global",
            "code": "CMM",
            "percent": global_score,
            "avg_level": round(global_avg, 2),
            "level_label": level_label(global_avg),
            "count": len(rows),
        }
    )
    return bars


def get_framework_bars(conn: sqlite3.Connection) -> list[dict]:
    return get_framework_bars_from_rows(_fetch_control_rows(conn))


def get_badge_counts_from_rows(rows: list[sqlite3.Row]) -> dict[str, int]:
    counts: dict[str, int] = {"NIST_CSF2": 0, "CIS_V8": 0}
    for row in rows:
        if row["maturity_level"] >= TARGET_LEVEL:
            continue
        if row["framework_code"] not in counts:
            continue
        if severity_for_gap(int(row["maturity_level"])) == "critical":
            counts[row["framework_code"]] += 1
    return counts


FRAMEWORK_LABELS = {
    "NIST_CSF2": "NIST CSF",
    "ISO27001": "ISO 27001",
    "CIS_V8": "CIS v8",
    "RGPD": "RGPD",
}


def get_gap_matrix_from_rows(rows: list[sqlite3.Row]) -> dict:
    """Matriz Dominio (filas) × Framework (columnas) con % de madurez por celda.

    Crece automáticamente al añadir frameworks/controles nuevos.
    """
    frameworks: list[dict] = []
    seen_codes: list[str] = []
    domains: list[str] = []
    bucket: dict[tuple[str, str], list[int]] = {}

    for row in rows:
        code = row["framework_code"]
        domain = (row["domain"] or "General").strip() or "General"
        if code not in seen_codes:
            seen_codes.append(code)
            frameworks.append(
                {"code": code, "label": FRAMEWORK_LABELS.get(code, row["framework_name"] or code)}
            )
        if domain not in domains:
            domains.append(domain)
        bucket.setdefault((domain, code), []).append(int(row["maturity_level"]))

    cells: dict[str, dict] = {}
    for (domain, code), levels in bucket.items():
        avg = sum(levels) / len(levels) if levels else 0
        cells[f"{domain}|{code}"] = {
            "percent": level_to_percent(avg),
            "level": round(avg, 1),
            "count": len(levels),
        }

    domains.sort()
    return {"domains": domains, "frameworks": frameworks, "cells": cells}


def get_gap_matrix(conn: sqlite3.Connection) -> dict:
    return get_gap_matrix_from_rows(_fetch_control_rows(conn))


def get_remediation_from_rows(rows: list[sqlite3.Row]) -> list[dict]:
    """Progreso de remediación por marco: % de controles que alcanzan el objetivo."""
    items = [
        ("NIST CSF 2.0", "NIST_CSF2"),
        ("ISO 27001:2022", "ISO27001"),
        ("CIS Controls v8", "CIS_V8"),
        ("RGPD", "RGPD"),
    ]
    out = []
    for label, code in items:
        subset = [r for r in rows if r["framework_code"] == code]
        if not subset:
            continue
        total = len(subset)
        done = sum(1 for r in subset if r["maturity_level"] >= TARGET_LEVEL)
        percent = round((done / total) * 100) if total else 0
        out.append(
            {
                "label": f"Remediación {label}",
                "code": code,
                "done": done,
                "total": total,
                "percent": percent,
            }
        )
    out.sort(key=lambda x: x["percent"])
    return out


def get_remediation(conn: sqlite3.Connection) -> list[dict]:
    return get_remediation_from_rows(_fetch_control_rows(conn))


def get_next_audit(conn: sqlite3.Connection) -> dict:
    """Próxima auditoría sugerida = última revisión + 90 días."""
    from datetime import timedelta

    row = conn.execute("SELECT value FROM settings WHERE key = 'next_audit'").fetchone()
    if row and row["value"]:
        return {"date": row["value"], "source": "manual"}

    last = conn.execute(
        "SELECT MAX(assessed_at) AS ts FROM assessments"
    ).fetchone()
    base = None
    if last and last["ts"]:
        try:
            base = datetime.fromisoformat(last["ts"])
        except ValueError:
            base = None
    base = base or datetime.now()
    nxt = base + timedelta(days=90)
    return {"date": nxt.strftime("%d/%m/%Y"), "source": "auto"}


def search_controls(conn: sqlite3.Connection, query: str, limit: int = 12) -> list[dict]:
    q = (query or "").strip()
    if len(q) < 2:
        return []
    org_id = get_organization_id(conn)
    like = f"%{q}%"
    rows = conn.execute(
        """
        SELECT c.control_id, c.title, c.domain, f.code AS framework_code,
               f.name AS framework_name, COALESCE(a.maturity_level, 0) AS maturity_level
        FROM controls c
        JOIN frameworks f ON f.id = c.framework_id
        LEFT JOIN assessments a ON a.control_id = c.id AND a.organization_id = ?
        WHERE c.control_id LIKE ? OR c.title LIKE ? OR c.domain LIKE ?
        ORDER BY c.control_id
        LIMIT ?
        """,
        (org_id, like, like, like, limit),
    ).fetchall()
    return [
        {
            "control_id": r["control_id"],
            "title": r["title"],
            "domain": r["domain"],
            "framework": FRAMEWORK_LABELS.get(r["framework_code"], r["framework_code"]),
            "framework_code": r["framework_code"],
            "level": int(r["maturity_level"]),
        }
        for r in rows
    ]


def get_recent_activity(conn: sqlite3.Connection, limit: int = 5) -> list[dict]:
    org_id = get_organization_id(conn)
    rows = conn.execute(
        """
        SELECT c.control_id, c.title, c.domain, a.maturity_level, a.assessed_at,
               f.code AS framework_code
        FROM assessments a
        JOIN controls c ON c.id = a.control_id
        JOIN frameworks f ON f.id = c.framework_id
        WHERE a.organization_id = ?
        ORDER BY a.assessed_at DESC
        LIMIT ?
        """,
        (org_id, limit),
    ).fetchall()
    activity = []
    for r in rows:
        level = int(r["maturity_level"])
        kind = "ok" if level >= TARGET_LEVEL else ("critical" if level <= 1 else "warning")
        ts = r["assessed_at"] or ""
        when = ts.replace("T", " ")[:16] if ts else ""
        activity.append(
            {
                "title": f"{r['control_id']} evaluado",
                "detail": f"{r['title']} · Nivel {level}/5",
                "framework": FRAMEWORK_LABELS.get(r["framework_code"], r["framework_code"]),
                "kind": kind,
                "when": when,
            }
        )
    return activity


def get_dashboard_payload(conn: sqlite3.Connection, framework: str = "ALL") -> dict:
    rows = _fetch_control_rows(conn)
    counts = count_by_severity_from_rows(rows)
    last_review = conn.execute("SELECT value FROM settings WHERE key = 'last_review'").fetchone()
    org = conn.execute("SELECT name FROM organizations LIMIT 1").fetchone()
    fw_filter = framework if framework != "ALL" else None
    global_score = compute_global_score_from_rows(rows)
    total_controls = len(rows)
    non_compliant = counts["critical"] + counts["warning"]
    assessed_count = conn.execute("SELECT COUNT(*) AS c FROM assessments").fetchone()["c"]

    return {
        "org_name": org["name"] if org else "Mi Organización",
        "last_review": last_review["value"]
        if last_review and last_review["value"]
        else datetime.now().strftime("%d/%m/%Y %H:%M"),
        "global_score": global_score,
        "grade": score_to_grade(global_score),
        "total_controls": total_controls,
        "assessed_count": int(assessed_count),
        "has_assessments": int(assessed_count) > 0,
        "controls_met": counts["ok"],
        "non_compliant": non_compliant,
        "critical_count": counts["critical"],
        "warning_count": counts["warning"],
        "ok_count": counts["ok"],
        "radar": get_radar_data_from_rows(rows),
        "bars": get_framework_bars_from_rows(rows),
        "heatmap": get_heatmap_from_rows(rows),
        "gap_matrix": get_gap_matrix_from_rows(rows),
        "remediation": get_remediation_from_rows(rows),
        "next_audit": get_next_audit(conn),
        "alerts": get_alerts_from_rows(rows, None, limit=150),
        "recent_activity": get_recent_activity(conn, limit=5),
        "framework_scores": {
            "NIST_CSF2": compute_framework_score_from_rows(rows, "NIST_CSF2"),
            "ISO27001": compute_framework_score_from_rows(rows, "ISO27001"),
            "CIS_V8": compute_framework_score_from_rows(rows, "CIS_V8"),
            "RGPD": compute_framework_score_from_rows(rows, "RGPD"),
        },
        "badge_counts": get_badge_counts_from_rows(rows),
        "demo_mode": should_show_demo_ui(conn),
        "show_demo_ui": should_show_demo_ui(conn),
    }


def save_assessment(
    conn: sqlite3.Connection,
    control_db_id: int,
    maturity_level: int,
    notes: str = "",
) -> None:
    org_id = get_organization_id(conn)
    maturity_level = max(0, min(5, int(maturity_level)))
    conn.execute(
        """
        INSERT INTO assessments (organization_id, control_id, maturity_level, notes, assessed_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(organization_id, control_id) DO UPDATE SET
            maturity_level = excluded.maturity_level,
            notes = excluded.notes,
            assessed_at = excluded.assessed_at
        """,
        (org_id, control_db_id, maturity_level, notes, datetime.now().isoformat()),
    )
    conn.execute(
        "UPDATE settings SET value = ? WHERE key = 'last_review'",
        (datetime.now().strftime("%d/%m/%Y %H:%M"),),
    )
    exit_demo_mode_on_real_entry(conn)
    conn.commit()


def save_assessments_batch(conn: sqlite3.Connection, items: list[dict]) -> None:
    org_id = get_organization_id(conn)
    now = datetime.now().isoformat()
    for item in items:
        conn.execute(
            """
            INSERT INTO assessments (organization_id, control_id, maturity_level, notes, assessed_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(organization_id, control_id) DO UPDATE SET
                maturity_level = excluded.maturity_level,
                notes = excluded.notes,
                assessed_at = excluded.assessed_at
            """,
            (
                org_id,
                int(item["control_id"]),
                max(0, min(5, int(item["maturity_level"]))),
                str(item.get("notes", "")),
                now,
            ),
        )
    conn.execute(
        "UPDATE settings SET value = ? WHERE key = 'last_review'",
        (datetime.now().strftime("%d/%m/%Y %H:%M"),),
    )
    exit_demo_mode_on_real_entry(conn)
    conn.commit()


def find_control_page(
    conn: sqlite3.Connection,
    framework_code: str,
    control_id: str,
    page_size: int = 20,
) -> dict | None:
    """Ubica un control en la paginación del cuestionario (drill-down)."""
    row = conn.execute(
        """
        SELECT c.id, c.control_id
        FROM controls c
        JOIN frameworks f ON f.id = c.framework_id
        WHERE f.code = ? AND c.control_id = ?
        """,
        (framework_code, control_id),
    ).fetchone()
    if not row:
        return None
    pos = conn.execute(
        """
        SELECT COUNT(*) AS c
        FROM controls c
        JOIN frameworks f ON f.id = c.framework_id
        WHERE f.code = ? AND c.control_id <= ?
        """,
        (framework_code, control_id),
    ).fetchone()["c"]
    page = max(1, (int(pos) - 1) // page_size + 1)
    return {
        "id": row["id"],
        "control_id": row["control_id"],
        "framework": framework_code,
        "page": page,
        "page_size": page_size,
    }


def get_controls_page(
    conn: sqlite3.Connection,
    framework_code: str,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    org_id = get_organization_id(conn)
    offset = (max(1, page) - 1) * page_size
    total = conn.execute(
        """
        SELECT COUNT(*) AS c FROM controls c
        JOIN frameworks f ON f.id = c.framework_id
        WHERE f.code = ?
        """,
        (framework_code,),
    ).fetchone()["c"]

    rows = conn.execute(
        """
        SELECT c.id, c.control_id, c.title, c.domain, c.description, c.weight,
               COALESCE(a.maturity_level, 0) AS maturity_level,
               COALESCE(a.notes, '') AS notes
        FROM controls c
        JOIN frameworks f ON f.id = c.framework_id
        LEFT JOIN assessments a ON a.control_id = c.id AND a.organization_id = ?
        WHERE f.code = ?
        ORDER BY c.control_id
        LIMIT ? OFFSET ?
        """,
        (org_id, framework_code, page_size, offset),
    ).fetchall()

    return {
        "items": [dict(r) for r in rows],
        "page": page,
        "page_size": page_size,
        "total": total,
        "pages": max(1, (total + page_size - 1) // page_size),
    }
