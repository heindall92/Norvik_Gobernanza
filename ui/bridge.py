"""QWebChannel bridge between Python backend and dashboard JS."""

from __future__ import annotations

import json
from pathlib import Path

from PySide6.QtCore import QObject, Slot

from core.database import get_organization_id, update_org_name
from core.maturity import (
    find_control_page,
    get_controls_page,
    get_dashboard_payload,
    save_assessment as persist_assessment,
    save_assessments_batch,
    search_controls,
)
from core.ollama_client import chat_message, check_status, get_recommendations, list_models, test_connection
from core.pdf_export import generate_report
from core.settings import get_all_settings, save_settings
from core.user_avatar import avatar_data_url, remove_avatar, save_avatar_data_url


class Bridge(QObject):
    def __init__(self, conn, parent=None) -> None:
        super().__init__(parent)
        self._conn = conn

    @Slot(str, result=str)
    def get_dashboard_data(self, framework: str = "ALL") -> str:
        try:
            data = get_dashboard_payload(self._conn, framework or "ALL")
            settings = get_all_settings(self._conn)
            data["theme"] = settings.get("theme", "hybrid")
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"error": str(exc)}, ensure_ascii=False)

    @Slot(str, result=str)
    def search_controls(self, query: str) -> str:
        try:
            results = search_controls(self._conn, query)
            return json.dumps({"ok": True, "results": results}, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"ok": False, "error": str(exc), "results": []}, ensure_ascii=False)

    @Slot(str, int, result=str)
    def get_framework_controls(self, framework: str, page: int = 1) -> str:
        try:
            data = get_controls_page(self._conn, framework, page=page)
            return json.dumps(data, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"error": str(exc)}, ensure_ascii=False)

    @Slot(str, str, result=str)
    def get_control_page(self, framework: str, control_id: str) -> str:
        try:
            data = find_control_page(self._conn, framework, control_id)
            if not data:
                return json.dumps({"ok": False, "error": "Control no encontrado"}, ensure_ascii=False)
            return json.dumps({"ok": True, **data}, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False)

    @Slot(int, int, str, result=str)
    def save_assessment(self, control_id: int, maturity_level: int, notes: str = "") -> str:
        try:
            persist_assessment(self._conn, control_id, maturity_level, notes)
            return json.dumps({"ok": True}, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False)

    @Slot(str, result=str)
    def save_assessments_batch(self, payload: str) -> str:
        try:
            items = json.loads(payload) if payload else []
            if not isinstance(items, list):
                raise ValueError("Payload debe ser una lista")
            save_assessments_batch(self._conn, items)
            return json.dumps({"ok": True, "count": len(items)}, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False)

    @Slot(str, result=str)
    def get_recommendations(self, gap_data: str) -> str:
        try:
            gap = json.loads(gap_data) if gap_data else {}
            settings = get_all_settings(self._conn)
            result = get_recommendations(gap, settings)
            return json.dumps(result, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False)

    @Slot(str, result=str)
    def ai_chat(self, message: str) -> str:
        try:
            settings = get_all_settings(self._conn)
            result = chat_message(message, settings)
            return json.dumps(result, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"ok": False, "error": str(exc), "content": ""}, ensure_ascii=False)

    @Slot(str, result=str)
    def export_pdf(self, report_config: str = "{}") -> str:
        try:
            config = json.loads(report_config) if report_config else {}
            if not isinstance(config, dict):
                config = {}
            settings = get_all_settings(self._conn)
            org_name = settings.get("org_name", "Mi Organización")
            ai_summary = (config.get("ai_summary") or "").strip() or None
            path = generate_report(
                self._conn,
                org_name,
                auditor_name=settings.get("user_name", ""),
                auditor_role=settings.get("user_role", ""),
                ai_summary=ai_summary,
                settings=settings,
            )
            return json.dumps(
                {"ok": True, "path": str(path), "message": f"Informe guardado en {path}"},
                ensure_ascii=False,
            )
        except Exception as exc:
            return json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False)

    @Slot(result=str)
    def get_ollama_status(self) -> str:
        settings = get_all_settings(self._conn)
        return json.dumps(check_status(settings), ensure_ascii=False)

    @Slot(result=str)
    def test_ollama_connection(self) -> str:
        settings = get_all_settings(self._conn)
        return json.dumps(test_connection(settings), ensure_ascii=False)

    @Slot(result=str)
    def get_ollama_models(self) -> str:
        settings = get_all_settings(self._conn)
        return json.dumps(list_models(settings), ensure_ascii=False)

    @Slot(result=str)
    def get_settings(self) -> str:
        settings = get_all_settings(self._conn)
        settings["user_avatar_url"] = avatar_data_url()
        return json.dumps(settings, ensure_ascii=False)

    @Slot(str, result=str)
    def save_user_avatar(self, data_url: str) -> str:
        try:
            result = save_avatar_data_url(self._conn, data_url)
            return json.dumps(result, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False)

    @Slot(result=str)
    def remove_user_avatar(self) -> str:
        try:
            remove_avatar(self._conn)
            return json.dumps({"ok": True}, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False)

    @Slot(str, result=str)
    def save_settings(self, payload: str) -> str:
        try:
            data = json.loads(payload) if payload else {}
            if "org_name" in data:
                update_org_name(self._conn, data["org_name"])
            save_settings(self._conn, data)
            settings = get_all_settings(self._conn)
            settings["user_avatar_url"] = avatar_data_url()
            return json.dumps({"ok": True, "settings": settings}, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False)

    @Slot(str, result=str)
    def set_theme(self, theme_id: str) -> str:
        try:
            if theme_id in {"Auto", "Light", "Dark"}:
                save_settings(self._conn, {"theme_mode": theme_id})
            else:
                save_settings(self._conn, {"theme": theme_id})
            return json.dumps({"ok": True, "theme": theme_id}, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False)

    @Slot(result=str)
    def get_web_base_url(self) -> str:
        web_dir = Path(__file__).resolve().parent / "web"
        return str(web_dir.as_uri()) + "/"
