"""Ollama API wrapper — local, cloud, GRC audit assistant."""

from __future__ import annotations

import json
import ssl
from typing import Any

import urllib.error
import urllib.request

from core.settings import get_all_settings

DEFAULT_SYSTEM_PROMPT = """Eres un experto senior en GRC (Governance, Risk & Compliance) especializado en NIST CSF 2.0, ISO 27001:2022, CIS Controls v8 y RGPD.

Tu rol en Norvik:
- Analizar brechas de madurez y priorizar remediación.
- Apoyar decisiones de auditoría con criterio técnico y de negocio.
- Sugerir controles, evidencias y planes de acción verificables.
- Redactar recomendaciones para informes ejecutivos y técnicos.

Responde siempre en español, con tono profesional y directo.
Estructura: contexto breve → hallazgos → decisiones recomendadas → acciones (esfuerzo Alto/Medio/Bajo) → referencias normativas.
Evita consejos genéricos; sé específico al control, dominio y nivel CMM indicados."""

# API cloud oficial: https://ollama.com/api (docs.ollama.com/api/introduction)
CLOUD_HOST = "https://ollama.com"
# Catálogo cloud real (Llama no está en ollama.com/api — solo modelos cloud)
CLOUD_MODELS_FALLBACK = [
    "gpt-oss:120b",
    "gpt-oss:20b",
    "glm-5.2",
    "glm-5.1",
    "qwen3.5",
    "deepseek-v4-flash",
    "minimax-m3",
    "gemma3:27b",
]
LOCAL_MODELS_SUGGESTED = [
    "llama3.2",
    "llama3.1:8b",
    "mistral:7b",
    "qwen2.5:7b",
    "deepseek-r1:8b",
]


def _cloud_host(settings: dict[str, str]) -> str:
    raw = (settings.get("ollama_cloud_host") or CLOUD_HOST).strip().rstrip("/")
    if raw.endswith("/api"):
        raw = raw[:-4]
    # Corregir dominio antiguo/erróneo
    if "api.ollama.com" in raw:
        raw = CLOUD_HOST
    return raw or CLOUD_HOST


def _host(settings: dict[str, str]) -> str:
    return settings.get("ollama_host", "http://localhost:11434").rstrip("/")


def _cloud_api(path: str, settings: dict[str, str]) -> str:
    base = _cloud_host(settings)
    if not path.startswith("/"):
        path = f"/{path}"
    return f"{base}/api{path}"


def _provider(settings: dict[str, str]) -> str:
    return settings.get("ollama_provider", "local").strip().lower() or "local"


def _resolved_model(settings: dict[str, str]) -> str:
    if _provider(settings) == "cloud":
        return (
            settings.get("ollama_cloud_model")
            or settings.get("ollama_model")
            or CLOUD_MODELS_FALLBACK[0]
        )
    return settings.get("ollama_model", "llama3.2")


def _pick_model(settings: dict[str, str], available: list[str]) -> str:
    preferred = _resolved_model(settings)
    if not available:
        return preferred
    if preferred in available:
        return preferred
    pref_base = preferred.split(":")[0]
    for name in available:
        if name == preferred or name.startswith(f"{preferred}:") or name.startswith(f"{pref_base}:"):
            return name
        if preferred in name:
            return name
    return available[0]


def system_prompt(settings: dict[str, str] | None = None) -> str:
    settings = settings or {}
    custom = (settings.get("ai_system_prompt") or "").strip()
    return custom or DEFAULT_SYSTEM_PROMPT


def _context_prompt(settings: dict[str, str]) -> str:
    org = (settings.get("org_name") or "").strip()
    user = (settings.get("user_name") or "").strip()
    role = (settings.get("user_role") or "").strip()
    dept = (settings.get("user_department") or "").strip()
    parts = [system_prompt(settings)]
    ctx = []
    if org:
        ctx.append(f"Organización: {org}")
    if user:
        ctx.append(f"Auditor/responsable: {user}" + (f" ({role})" if role else ""))
    if dept:
        ctx.append(f"Departamento: {dept}")
    if ctx:
        parts.append("Contexto del cliente:\n" + "\n".join(ctx))
    return "\n\n".join(parts)


def _http_json(
    url: str,
    *,
    method: str = "GET",
    payload: dict | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 15,
) -> dict[str, Any]:
    data = None
    hdrs = dict(headers or {})
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace").strip()
        if detail:
            try:
                parsed = json.loads(detail)
                detail = parsed.get("error") or detail
            except json.JSONDecodeError:
                pass
        raise urllib.error.URLError(f"HTTP {exc.code}: {detail or exc.reason}") from exc


def _unique_models(names: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for name in names:
        n = name.strip()
        if not n or n in seen:
            continue
        seen.add(n)
        out.append(n)
    return out


def _fetch_cloud_models(settings: dict[str, str]) -> tuple[list[str], str | None, bool]:
    """Devuelve modelos cloud, hint opcional y si la API respondió en vivo."""
    api_key = (settings.get("ollama_cloud_key") or "").strip()
    url = _cloud_api("/tags", settings)
    models: list[str] = []
    last_error: str | None = None

    if api_key:
        try:
            data = _http_json(url, headers={"Authorization": f"Bearer {api_key}"})
            models = _parse_model_names(data)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
            last_error = str(exc)

    if not models and not api_key:
        try:
            data = _http_json(url)
            models = _parse_model_names(data)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
            if not last_error:
                last_error = str(exc)

    if models:
        hint = None
        if not any("llama" in m.lower() for m in models):
            hint = (
                "Ollama Cloud no incluye modelos Llama en su catálogo. "
                "Usa un modelo cloud listado o cambia a Ollama local y ejecuta: ollama pull llama3.2"
            )
        return _unique_models(models), hint, True

    fallback = list(CLOUD_MODELS_FALLBACK)
    hint = (
        "No se pudo conectar con Ollama Cloud"
        + (f" ({last_error})" if last_error else "")
        + ". Verifica la API Key y la URL https://ollama.com/api."
    )
    return fallback, hint, False


def _parse_model_names(data: dict[str, Any]) -> list[str]:
    models = data.get("models") or []
    names: list[str] = []
    for item in models:
        if isinstance(item, dict):
            name = item.get("name") or item.get("model") or ""
        else:
            name = str(item)
        name = name.strip()
        if name:
            names.append(name)
    return names


def list_models(settings: dict[str, str] | None = None) -> dict[str, Any]:
    settings = settings or {}
    provider = _provider(settings)
    try:
        if provider == "cloud":
            api_key = (settings.get("ollama_cloud_key") or "").strip()
            if not api_key:
                return {
                    "ok": False,
                    "provider": "cloud",
                    "error": "Introduce tu API Key de Ollama Cloud",
                    "models": list(CLOUD_MODELS_FALLBACK),
                    "hint": "Los modelos Llama no están en Ollama Cloud. Para Llama usa Ollama local.",
                }
            models, hint, live = _fetch_cloud_models(settings)
            if not live:
                return {
                    "ok": False,
                    "provider": "cloud",
                    "error": hint or "No se pudo conectar con Ollama Cloud",
                    "models": models,
                    "hint": "Configura la API Key en Configuración y pulsa Probar conexión.",
                }
            return {"ok": True, "provider": "cloud", "models": models, "hint": hint}
        data = _http_json(f"{_host(settings)}/api/tags")
        models = _parse_model_names(data)
        hint = None
        if not models:
            hint = (
                "No hay modelos descargados en Ollama local. "
                "Abre una terminal y ejecuta: ollama pull llama3.2"
            )
        return {"ok": True, "provider": "local", "models": models, "hint": hint}
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        if provider == "cloud":
            return {
                "ok": False,
                "provider": "cloud",
                "error": str(exc),
                "models": list(CLOUD_MODELS_FALLBACK),
                "hint": "Llama no está disponible en Cloud. Para Llama: proveedor Local + ollama pull llama3.2",
            }
        return {
            "ok": False,
            "provider": "local",
            "error": str(exc),
            "models": [],
            "hint": "¿Ollama está en ejecución? Descarga Llama con: ollama pull llama3.2",
        }


def test_connection(settings: dict[str, str] | None = None) -> dict[str, Any]:
    settings = settings or {}
    provider = _provider(settings)
    model = _resolved_model(settings)

    if provider == "cloud":
        api_key = (settings.get("ollama_cloud_key") or "").strip()
        if not api_key:
            return {
                "ok": False,
                "provider": "cloud",
                "connected": False,
                "error": "API Key de Ollama Cloud no configurada",
                "model": model,
                "available_models": [],
            }
        try:
            models, hint, live = _fetch_cloud_models(settings)
            if not live:
                return {
                    "ok": False,
                    "connected": False,
                    "provider": "cloud",
                    "error": hint or "No se pudo conectar con Ollama Cloud",
                    "model": model,
                    "available_models": models,
                }
            active = _pick_model(settings, models)
            return {
                "ok": True,
                "connected": True,
                "provider": "cloud",
                "model": active,
                "available_models": models,
                "hint": hint,
            }
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
            cloud_url = _cloud_api("/tags", settings)
            return {
                "ok": False,
                "connected": False,
                "provider": "cloud",
                "error": f"No se puede conectar con Ollama Cloud ({cloud_url}): {exc}",
                "model": model,
                "available_models": [],
            }

    host = _host(settings)
    try:
        data = _http_json(f"{host}/api/tags")
        models = _parse_model_names(data)
        connected = len(models) > 0
        active = _pick_model(settings, models) if models else model
        hint = None
        if connected and not any("llama" in m.lower() for m in models):
            hint = "Para usar Llama descárgalo: ollama pull llama3.2"
        if not models:
            hint = "Ollama responde pero no hay modelos. Ejecuta: ollama pull llama3.2"
        return {
            "ok": connected,
            "connected": connected,
            "provider": "local",
            "model": active,
            "available_models": models,
            "host": host,
            "hint": hint,
        }
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        return {
            "ok": False,
            "connected": False,
            "provider": "local",
            "error": f"No se puede conectar con Ollama en {host}. ¿Está en ejecución?",
            "model": model,
            "available_models": [],
            "host": host,
        }


def check_status(settings: dict[str, str] | None = None) -> dict[str, Any]:
    result = test_connection(settings or {})
    return {
        "connected": result.get("connected", False),
        "model": result.get("model", _resolved_model(settings or {})),
        "available_models": result.get("available_models", []),
        "provider": result.get("provider", "local"),
        "error": result.get("error"),
    }


def _chat_request(
    url: str,
    model: str,
    messages: list[dict[str, str]],
    headers: dict[str, str] | None = None,
    timeout: int = 180,
) -> dict[str, Any]:
    payload = {"model": model, "messages": messages, "stream": False}
    data = _http_json(url, method="POST", payload=payload, headers=headers, timeout=timeout)
    content = data.get("message", {}).get("content", "")
    if not content and data.get("error"):
        return {"ok": False, "error": str(data["error"]), "content": ""}
    return {"ok": True, "content": content, "model": model}


def _run_chat(
    messages: list[dict[str, str]],
    settings: dict[str, str],
    *,
    status: dict[str, Any] | None = None,
) -> dict[str, Any]:
    settings = settings or {}
    status = status or test_connection(settings)
    if not status.get("connected"):
        err = status.get("error") or status.get("hint") or "Ollama no está disponible"
        return {"ok": False, "error": err, "content": ""}

    model = status.get("model") or _pick_model(settings, status.get("available_models") or [])
    provider = _provider(settings)
    sys_msg = _context_prompt(settings)
    full_messages = [{"role": "system", "content": sys_msg}] + [
        m for m in messages if m.get("role") != "system"
    ]

    try:
        if provider == "cloud":
            api_key = (settings.get("ollama_cloud_key") or "").strip()
            return _chat_request(
                _cloud_api("/chat", settings),
                model,
                full_messages,
                headers={"Authorization": f"Bearer {api_key}"},
            )
        return _chat_request(f"{_host(settings)}/api/chat", model, full_messages)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        err = str(exc)
        if "not found" in err.lower() or "404" in err:
            err += f" Prueba otro modelo o ejecuta: ollama pull {model.split(':')[0]}"
        return {"ok": False, "error": err, "content": ""}


def get_recommendations(gap_data: dict[str, Any], settings: dict[str, str] | None = None) -> dict[str, Any]:
    settings = settings or {}
    status = test_connection(settings)
    user_prompt = (
        f"Control: {gap_data.get('control_id', '')} — {gap_data.get('title', '')}\n"
        f"Framework: {gap_data.get('framework', '')}\n"
        f"Dominio: {gap_data.get('domain', '')}\n"
        f"Nivel actual CMM: {gap_data.get('current_level', 0)}/5\n"
        f"Nivel objetivo CMM: {gap_data.get('target_level', 3)}/5\n"
        f"Notas del auditor: {gap_data.get('notes', 'Sin notas')}\n\n"
        "Entrega recomendaciones accionables para cerrar la brecha y decisiones de auditoría."
    )
    return _run_chat([{"role": "user", "content": user_prompt}], settings, status=status)


def generate_executive_summary(
    dashboard: dict[str, Any],
    settings: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Genera el análisis ejecutivo global para informes PDF."""
    settings = settings or {}
    status = test_connection(settings)
    fw_scores = dashboard.get("framework_scores") or {}
    fw_parts = []
    labels = {
        "NIST_CSF2": "NIST CSF 2.0",
        "ISO27001": "ISO 27001:2022",
        "CIS_V8": "CIS Controls v8",
        "RGPD": "RGPD",
    }
    for code, label in labels.items():
        s = fw_scores.get(code) or {}
        if s:
            fw_parts.append(f"{label}: {s.get('score', 0)}%")

    alerts = dashboard.get("alerts") or []
    top_critical = [
        f"{a.get('control_id')} ({a.get('framework')})"
        for a in alerts
        if a.get("severity") == "critical"
    ][:8]

    notes = (
        f"Score global {round(dashboard.get('global_score') or 0)}% "
        f"(nota {dashboard.get('grade', '—')}). "
        f"Controles conformes: {dashboard.get('controls_met', 0)}. "
        f"No conformes: {dashboard.get('non_compliant', 0)}. "
        f"Críticas: {dashboard.get('critical_count', 0)}, "
        f"advertencias: {dashboard.get('warning_count', 0)}. "
        f"Marcos: {'; '.join(fw_parts) or 'sin datos'}."
    )
    if top_critical:
        notes += f" Brechas críticas destacadas: {', '.join(top_critical)}."

    user_prompt = (
        "Redacta un ANÁLISIS EJECUTIVO para un informe PDF de GRC (2-4 párrafos).\n"
        "Debe interpretar los datos detectados, argumentar el nivel de riesgo y priorizar acciones.\n"
        "Referencia explícitamente score global, marcos normativos y brechas críticas.\n"
        "Cierra con 3-5 decisiones recomendadas numeradas para la dirección.\n\n"
        f"Datos de la evaluación:\n{notes}"
    )
    return _run_chat([{"role": "user", "content": user_prompt}], settings, status=status)


def chat_message(message: str, settings: dict[str, str] | None = None) -> dict[str, Any]:
    settings = settings or {}
    text = (message or "").strip()
    if not text:
        return {"ok": False, "error": "Mensaje vacío", "content": ""}
    return _run_chat([{"role": "user", "content": text}], settings)
