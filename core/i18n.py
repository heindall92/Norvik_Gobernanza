"""Internationalization — Spanish / English for AI, PDF and backend messages."""

from __future__ import annotations

import re
from typing import Any

DEFAULT_LOCALE = "es"

SYSTEM_PROMPTS: dict[str, str] = {
    "es": """Eres un experto senior en GRC (Governance, Risk & Compliance) especializado en NIST CSF 2.0, ISO 27001:2022, CIS Controls v8 y RGPD.

Tu rol en Norvik:
- Analizar brechas de madurez y priorizar remediación.
- Apoyar decisiones de auditoría con criterio técnico y de negocio.
- Sugerir controles, evidencias y planes de acción verificables.
- Redactar recomendaciones para informes ejecutivos y técnicos.

Responde SIEMPRE en español, con tono profesional y directo.
Estructura: contexto breve → hallazgos → decisiones recomendadas → acciones (esfuerzo Alto/Medio/Bajo) → referencias normativas.
Evita consejos genéricos; sé específico al control, dominio y nivel CMM indicados.""",
    "en": """You are a senior GRC (Governance, Risk & Compliance) expert specialized in NIST CSF 2.0, ISO 27001:2022, CIS Controls v8 and GDPR.

Your role in Norvik:
- Analyze maturity gaps and prioritize remediation.
- Support audit decisions with technical and business judgment.
- Suggest controls, evidence and verifiable action plans.
- Draft recommendations for executive and technical reports.

Always respond in English with a professional, direct tone.
Structure: brief context → findings → recommended decisions → actions (High/Medium/Low effort) → regulatory references.
Avoid generic advice; be specific to the control, domain and CMM level provided.""",
}

PDF_STRINGS: dict[str, dict[str, str]] = {
    "es": {
        "report_title": "Informe de Governance &amp; Compliance",
        "organization": "Organización",
        "auditor": "Responsable",
        "date": "Fecha",
        "demo_warning": (
            "<b>AVISO:</b> Este informe incluye datos de DEMOSTRACIÓN. "
            "No es válido para auditorías ni cumplimiento oficial."
        ),
        "findings_summary": "Resumen de hallazgos detectados",
        "ai_executive": "Análisis ejecutivo IA",
        "ai_generated": "Generado con Ollama · modelo configurado en Norvik",
        "ai_unavailable": (
            "No hay análisis IA disponible. Genera el análisis en Dashboard o Informes "
            "antes de exportar, o configura Ollama en Configuración."
        ),
        "kpi_framework": "KPI por framework",
        "remediation_plan": "Plan de remediación por marco",
        "gap_matrix": "Matriz de brechas por dominio",
        "critical_gaps": "Brechas críticas",
        "indicator": "Indicador",
        "value": "Valor",
        "global_score": "Score global",
        "grade": "Calificación",
        "controls_evaluated": "Controles evaluados",
        "compliant": "Conformes",
        "non_compliant": "No conformes",
        "critical_gaps_count": "Brechas críticas",
        "warnings": "Advertencias",
        "initiative": "Iniciativa",
        "progress": "Progreso",
        "controls_closed": "Controles cerrados",
        "domain_framework": "Dominio / Marco",
        "framework": "Framework",
        "score_pct": "Score (%)",
        "controls": "Controles",
        "avg_level": "Nivel medio",
        "control": "Control",
        "severity": "Severidad",
        "domain": "Dominio",
    },
    "en": {
        "report_title": "Governance &amp; Compliance Report",
        "organization": "Organization",
        "auditor": "Owner",
        "date": "Date",
        "demo_warning": (
            "<b>WARNING:</b> This report contains DEMO data. "
            "It is not valid for audits or official compliance."
        ),
        "findings_summary": "Detected findings summary",
        "ai_executive": "AI executive analysis",
        "ai_generated": "Generated with Ollama · model configured in Norvik",
        "ai_unavailable": (
            "No AI analysis available. Generate it from Dashboard or Reports "
            "before exporting, or configure Ollama in Settings."
        ),
        "kpi_framework": "KPI by framework",
        "remediation_plan": "Remediation plan by framework",
        "gap_matrix": "Gap matrix by domain",
        "critical_gaps": "Critical gaps",
        "indicator": "Indicator",
        "value": "Value",
        "global_score": "Global score",
        "grade": "Grade",
        "controls_evaluated": "Controls evaluated",
        "compliant": "Compliant",
        "non_compliant": "Non-compliant",
        "critical_gaps_count": "Critical gaps",
        "warnings": "Warnings",
        "initiative": "Initiative",
        "progress": "Progress",
        "controls_closed": "Controls closed",
        "domain_framework": "Domain / Framework",
        "framework": "Framework",
        "score_pct": "Score (%)",
        "controls": "Controls",
        "avg_level": "Average level",
        "control": "Control",
        "severity": "Severity",
        "domain": "Domain",
    },
}

RECOMMENDATION_PROMPTS: dict[str, str] = {
    "es": (
        "Entrega recomendaciones accionables para cerrar la brecha y decisiones de auditoría."
    ),
    "en": (
        "Provide actionable recommendations to close the gap and audit decisions."
    ),
}

EXECUTIVE_PROMPTS: dict[str, str] = {
    "es": (
        "Redacta un ANÁLISIS EJECUTIVO para un informe PDF de GRC (2-4 párrafos).\n"
        "Debe interpretar los datos detectados, argumentar el nivel de riesgo y priorizar acciones.\n"
        "Referencia explícitamente score global, marcos normativos y brechas críticas.\n"
        "Cierra con 3-5 decisiones recomendadas numeradas para la dirección.\n\n"
        "Datos de la evaluación:\n{notes}"
    ),
    "en": (
        "Write an EXECUTIVE ANALYSIS for a GRC PDF report (2-4 paragraphs).\n"
        "Interpret the detected data, argue the risk level and prioritize actions.\n"
        "Explicitly reference global score, frameworks and critical gaps.\n"
        "Close with 3-5 numbered recommended decisions for leadership.\n\n"
        "Assessment data:\n{notes}"
    ),
}

GAP_LABELS: dict[str, dict[str, str]] = {
    "es": {
        "control": "Control",
        "framework": "Framework",
        "domain": "Dominio",
        "current_cmm": "Nivel actual CMM",
        "target_cmm": "Nivel objetivo CMM",
        "auditor_notes": "Notas del auditor",
        "no_notes": "Sin notas",
        "executive_title": "Resumen ejecutivo de gobernanza",
    },
    "en": {
        "control": "Control",
        "framework": "Framework",
        "domain": "Domain",
        "current_cmm": "Current CMM level",
        "target_cmm": "Target CMM level",
        "auditor_notes": "Auditor notes",
        "no_notes": "No notes",
        "executive_title": "Governance executive summary",
    },
}


def normalize_locale(value: str | None) -> str:
    raw = (value or DEFAULT_LOCALE).strip().lower()
    return "en" if raw.startswith("en") else "es"


def detect_locale_from_text(text: str) -> str | None:
    """Heuristic language detection for AI input (Spanish vs English)."""
    sample = (text or "").strip()
    if len(sample) < 10:
        return None
    lower = sample.lower()
    en_hits = len(
        re.findall(
            r"\b(the|and|for|with|compliance|assessment|control|risk|should|recommend|"
            r"audit|framework|organization|governance|report|analysis)\b",
            lower,
        )
    )
    es_hits = len(
        re.findall(
            r"\b(el|la|los|las|cumplimiento|evaluación|control|riesgo|recomend|auditoría|"
            r"marco|organización|informe|análisis|debe|brecha)\b",
            lower,
        )
    )
    if en_hits > es_hits + 1:
        return "en"
    if es_hits > en_hits + 1:
        return "es"
    return None


def effective_locale(settings: dict[str, Any] | None, user_text: str = "") -> str:
    settings = settings or {}
    detected = detect_locale_from_text(user_text)
    if detected:
        return detected
    return normalize_locale(settings.get("language"))


def system_prompt(settings: dict[str, Any] | None, user_text: str = "") -> str:
    settings = settings or {}
    custom = (settings.get("ai_system_prompt") or "").strip()
    if custom:
        locale = effective_locale(settings, user_text)
        lang_line = (
            "Always respond in English."
            if locale == "en"
            else "Responde siempre en español."
        )
        return f"{custom}\n\n{lang_line}"
    locale = effective_locale(settings, user_text)
    return SYSTEM_PROMPTS[locale]


def pdf_strings(locale: str | None = None) -> dict[str, str]:
    return PDF_STRINGS[normalize_locale(locale)]


def gap_labels(locale: str | None = None) -> dict[str, str]:
    return GAP_LABELS[normalize_locale(locale)]
