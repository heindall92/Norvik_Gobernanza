"""ReportLab PDF compliance report generator."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from core.database import get_documents_dir
from core.maturity import (
    compute_framework_score,
    compute_global_score,
    get_alerts,
    get_heatmap,
)

PALETTE = {
    "bg": colors.HexColor("#1E2130"),
    "accent": colors.HexColor("#88C0D0"),
    "text": colors.HexColor("#ECEFF4"),
    "red": colors.HexColor("#BF616A"),
    "yellow": colors.HexColor("#EBCB8B"),
    "green": colors.HexColor("#A3BE8C"),
    "header": colors.HexColor("#252A3D"),
}


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
        "body": ParagraphStyle(
            "NorvikBody",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=colors.black,
            spaceAfter=6,
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


def generate_report(
    conn,
    org_name: str,
    output_path: Path | None = None,
    *,
    auditor_name: str = "",
    auditor_role: str = "",
) -> Path:
    docs = get_documents_dir()
    if output_path is None:
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = docs / f"Norvik_Informe_{stamp}.pdf"

    global_score = compute_global_score(conn)
    styles = _styles()
    story = []

    story.append(Paragraph("Norvik", styles["title"]))
    story.append(Paragraph("Informe de Governance &amp; Compliance", styles["heading"]))
    story.append(Paragraph(f"Organización: <b>{org_name}</b>", styles["body"]))
    if auditor_name.strip():
        role = f" — {auditor_role}" if auditor_role.strip() else ""
        story.append(Paragraph(f"Responsable: <b>{auditor_name}</b>{role}", styles["body"]))
    story.append(Paragraph(f"Fecha: {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles["body"]))
    story.append(Paragraph(f"Score global de madurez: <b>{global_score}%</b>", styles["body"]))
    story.append(Spacer(1, 0.5 * cm))

    story.append(Paragraph("Resumen ejecutivo — KPI por framework", styles["heading"]))
    kpi_data = [
        ["Framework", "Score (%)", "Controles", "Nivel medio"],
    ]
    for code, label in [
        ("NIST_CSF2", "NIST CSF 2.0"),
        ("ISO27001", "ISO 27001:2022"),
        ("CIS_V8", "CIS Controls v8"),
        ("RGPD", "RGPD"),
    ]:
        s = compute_framework_score(conn, code)
        kpi_data.append([label, f"{s['score']}", str(s["count"]), f"{s['avg_level']}/5"])
    kpi_table = Table(kpi_data, colWidths=[6 * cm, 3 * cm, 3 * cm, 3 * cm])
    kpi_table.setStyle(_table_style())
    story.append(kpi_table)
    story.append(Spacer(1, 0.4 * cm))

    story.append(Paragraph("Alertas prioritarias", styles["heading"]))
    alerts = get_alerts(conn, limit=25)
    alert_data = [["ID", "Título", "Actual", "Objetivo", "Framework"]]
    for a in alerts[:25]:
        alert_data.append(
            [
                a["control_id"],
                a["title"][:60],
                str(a["current_level"]),
                str(a["target_level"]),
                a["framework"],
            ]
        )
    alert_table = Table(alert_data, colWidths=[2.2 * cm, 7 * cm, 1.5 * cm, 1.5 * cm, 2.5 * cm])
    alert_table.setStyle(_table_style())
    story.append(alert_table)
    story.append(Spacer(1, 0.4 * cm))

    story.append(Paragraph("Heatmap NIST CSF 2.0 — Madurez por función", styles["heading"]))
    heatmap = get_heatmap(conn)
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
