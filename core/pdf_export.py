"""ReportLab PDF compliance report generator."""

from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from core.database import get_documents_dir, is_demo_mode
from core.maturity import (
    compute_global_score,
    get_alerts,
    get_dashboard_payload,
    get_heatmap,
    score_to_grade,
)
from core.ollama_client import generate_executive_summary
from core.settings import get_all_settings

PALETTE = {
    "bg": colors.HexColor("#1E2130"),
    "accent": colors.HexColor("#88C0D0"),
    "text": colors.HexColor("#ECEFF4"),
    "red": colors.HexColor("#BF616A"),
    "yellow": colors.HexColor("#EBCB8B"),
    "green": colors.HexColor("#A3BE8C"),
    "header": colors.HexColor("#252A3D"),
}

FRAMEWORK_ROWS = [
    ("NIST_CSF2", "NIST CSF 2.0"),
    ("ISO27001", "ISO 27001:2022"),
    ("CIS_V8", "CIS Controls v8"),
    ("RGPD", "RGPD"),
]


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "NorvikTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=24,
            textColor=PALETTE["accent"],
            spaceAfter=12,
        ),
        "heading": ParagraphStyle(
            "NorvikHeading",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=14,
            textColor=PALETTE["accent"],
            spaceBefore=16,
            spaceAfter=8,
        ),
        "subheading": ParagraphStyle(
            "NorvikSubHeading",
            parent=base["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=11,
            textColor=colors.HexColor("#3D4F66"),
            spaceBefore=10,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "NorvikBody",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=colors.black,
            spaceAfter=6,
            leading=14,
        ),
        "ai": ParagraphStyle(
            "NorvikAI",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=colors.HexColor("#1B2230"),
            spaceAfter=8,
            leading=15,
            leftIndent=6,
            rightIndent=6,
        ),
        "muted": ParagraphStyle(
            "NorvikMuted",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            textColor=colors.grey,
        ),
    }


def _table_style(header_bg=None):
    header_bg = header_bg or PALETTE["header"]
    return TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), header_bg),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, PALETTE["accent"]),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F4F6FA")]),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]
    )


def _escape_pdf(text: str) -> str:
    return (
        str(text or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _format_ai_for_pdf(text: str) -> str:
    t = _escape_pdf(text.strip())
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"^\d+\.\s+", lambda m: m.group(0), t, flags=re.MULTILINE)
    return t.replace("\n\n", "<br/><br/>").replace("\n", "<br/>")


def _resolve_ai_summary(conn, ai_summary: str | None, settings: dict) -> tuple[str, str | None]:
    """Return (summary_text, error_hint)."""
    cleaned = (ai_summary or "").strip()
    if cleaned:
        return cleaned, None

    dashboard = get_dashboard_payload(conn, "ALL")
    result = generate_executive_summary(dashboard, settings)
    if result.get("ok") and result.get("content"):
        return str(result["content"]).strip(), None
    err = result.get("error") or "Ollama no disponible"
    return "", err


def _summary_table(dashboard: dict) -> Table:
    data = [
        ["Indicador", "Valor"],
        ["Score global", f"{round(dashboard.get('global_score') or 0)}%"],
        ["Calificación", dashboard.get("grade") or score_to_grade(dashboard.get("global_score") or 0)],
        ["Controles evaluados", str(dashboard.get("total_controls") or 0)],
        ["Conformes", str(dashboard.get("controls_met") or 0)],
        ["No conformes", str(dashboard.get("non_compliant") or 0)],
        ["Brechas críticas", str(dashboard.get("critical_count") or 0)],
        ["Advertencias", str(dashboard.get("warning_count") or 0)],
    ]
    table = Table(data, colWidths=[7 * cm, 5 * cm])
    table.setStyle(_table_style())
    return table



def _remediation_table(remediation: list[dict]) -> Table | None:
    if not remediation:
        return None
    data = [["Iniciativa", "Progreso", "Controles cerrados"]]
    for r in remediation:
        data.append([
            r.get("label", ""),
            f"{r.get('percent', 0)}%",
            f"{r.get('done', 0)} / {r.get('total', 0)}",
        ])
    table = Table(data, colWidths=[7 * cm, 2.5 * cm, 3.5 * cm])
    table.setStyle(_table_style())
    return table


def _gap_matrix_table(matrix: dict) -> Table | None:
    frameworks = matrix.get("frameworks") or []
    domains = matrix.get("domains") or []
    cells = matrix.get("cells") or {}
    if not frameworks or not domains:
        return None
    header = ["Dominio / Marco"] + [fw.get("label", fw.get("code", "")) for fw in frameworks]
    data = [header]
    for domain in domains:
        row = [domain]
        for fw in frameworks:
            key = f"{domain}|{fw.get('code', '')}"
            cell = cells.get(key, {})
            pct = round(cell.get("percent", 0))
            row.append(f"{pct}%")
        data.append(row)
    col_w = max(2.2, min(3.5, 14 / max(len(header), 1)))
    widths = [4 * cm] + [col_w * cm] * (len(header) - 1)
    table = Table(data, colWidths=widths)
    table.setStyle(_table_style())
    return table


def _alerts_table(alerts: list[dict], severity: str | None = None, limit: int = 20) -> Table | None:
    subset = alerts if severity is None else [a for a in alerts if a.get("severity") == severity]
    if not subset:
        return None
    data = [["ID", "Título", "Actual", "Objetivo", "Framework"]]
    for a in subset[:limit]:
        data.append([
            a.get("control_id", ""),
            (a.get("title") or "")[:55],
            str(a.get("current_level", "")),
            str(a.get("target_level", "")),
            a.get("framework_name") or a.get("framework", ""),
        ])
    table = Table(data, colWidths=[2.2 * cm, 7 * cm, 1.5 * cm, 1.5 * cm, 2.5 * cm])
    table.setStyle(_table_style())
    return table


def generate_report(
    conn,
    org_name: str,
    output_path: Path | None = None,
    *,
    auditor_name: str = "",
    auditor_role: str = "",
    ai_summary: str | None = None,
    settings: dict | None = None,
) -> Path:
    docs = get_documents_dir()
    if output_path is None:
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = docs / f"Norvik_Informe_{stamp}.pdf"

    settings = settings or get_all_settings(conn)
    dashboard = get_dashboard_payload(conn, "ALL")
    global_score = dashboard.get("global_score") or compute_global_score(conn)
    grade = dashboard.get("grade") or score_to_grade(global_score)
    styles = _styles()
    story = []

    story.append(Paragraph("Norvik", styles["title"]))
    story.append(Paragraph("Informe de Governance &amp; Compliance", styles["heading"]))
    story.append(Paragraph(f"Organización: <b>{_escape_pdf(org_name)}</b>", styles["body"]))
    if auditor_name.strip():
        role = f" — {_escape_pdf(auditor_role)}" if auditor_role.strip() else ""
        story.append(Paragraph(f"Responsable: <b>{_escape_pdf(auditor_name)}</b>{role}", styles["body"]))
    story.append(Paragraph(f"Fecha: {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles["body"]))
    if is_demo_mode(conn):
        story.append(
            Paragraph(
                "<b>AVISO:</b> Este informe incluye datos de DEMOSTRACIÓN. "
                "No es válido para auditorías ni cumplimiento oficial.",
                styles["body"],
            )
        )
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("Resumen de hallazgos detectados", styles["heading"]))
    story.append(_summary_table(dashboard))
    story.append(Spacer(1, 0.4 * cm))

    ai_text, ai_err = _resolve_ai_summary(conn, ai_summary, settings)
    story.append(Paragraph("Análisis ejecutivo IA", styles["heading"]))
    if ai_text:
        story.append(
            Paragraph(
                f"<i>Generado con Ollama · modelo configurado en Norvik</i>",
                styles["muted"],
            )
        )
        story.append(Spacer(1, 0.15 * cm))
        story.append(Paragraph(_format_ai_for_pdf(ai_text), styles["ai"]))
    else:
        hint = ai_err or "No hay análisis IA disponible."
        story.append(
            Paragraph(
                f"<i>{_escape_pdf(hint)}. Genera el análisis en Dashboard o Informes antes de exportar, "
                "o configura Ollama en Configuración.</i>",
                styles["muted"],
            )
        )
    story.append(Spacer(1, 0.4 * cm))

    story.append(Paragraph("KPI por framework", styles["heading"]))
    fw_scores = dashboard.get("framework_scores") or {}
    kpi_data = [["Framework", "Score (%)", "Controles", "Nivel medio"]]
    for code, label in FRAMEWORK_ROWS:
        s = fw_scores.get(code) or {"score": 0, "count": 0, "avg_level": 0}
        kpi_data.append([label, f"{s.get('score', 0)}", str(s.get("count", 0)), f"{s.get('avg_level', 0)}/5"])
    kpi_table = Table(kpi_data, colWidths=[6 * cm, 3 * cm, 3 * cm, 3 * cm])
    kpi_table.setStyle(_table_style())
    story.append(kpi_table)
    story.append(Spacer(1, 0.4 * cm))

    rem_table = _remediation_table(dashboard.get("remediation") or [])
    if rem_table:
        story.append(Paragraph("Plan de remediación por marco", styles["heading"]))
        story.append(rem_table)
        story.append(Spacer(1, 0.4 * cm))

    gap_table = _gap_matrix_table(dashboard.get("gap_matrix") or {})
    if gap_table:
        story.append(Paragraph("Mapa de brechas — Dominio × Marco (%)", styles["heading"]))
        story.append(gap_table)
        story.append(Spacer(1, 0.4 * cm))

    alerts = dashboard.get("alerts") or get_alerts(conn, limit=50)
    crit_table = _alerts_table(alerts, "critical", 20)
    if crit_table:
        story.append(Paragraph("Brechas críticas detectadas", styles["heading"]))
        story.append(crit_table)
        story.append(Spacer(1, 0.35 * cm))

    warn_table = _alerts_table(alerts, "warning", 15)
    if warn_table:
        story.append(Paragraph("Advertencias y brechas medias", styles["subheading"]))
        story.append(warn_table)
        story.append(Spacer(1, 0.35 * cm))

    story.append(Paragraph("Heatmap NIST CSF 2.0 — Madurez por función", styles["heading"]))
    heatmap = dashboard.get("heatmap") or get_heatmap(conn)
    hm_data = [["Función NIST", "Nivel medio (0-5)"]]
    for h in heatmap:
        hm_data.append([h["domain"], f"{h['level']}"])
    hm_table = Table(hm_data, colWidths=[8 * cm, 4 * cm])
    hm_table.setStyle(_table_style())
    story.append(hm_table)
    story.append(Spacer(1, 0.6 * cm))
    story.append(
        Paragraph(
            f"Generado por Norvik — {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}",
            styles["muted"],
        )
    )

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    def footer(canvas, doc_):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.grey)
        canvas.drawString(2 * cm, 1 * cm, f"Norvik — Página {doc_.page}")
        canvas.drawRightString(A4[0] - 2 * cm, 1 * cm, datetime.now().strftime("%d/%m/%Y %H:%M"))
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return output_path
