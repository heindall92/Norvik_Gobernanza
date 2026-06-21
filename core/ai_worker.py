"""Background workers for long-running Ollama requests."""

from __future__ import annotations

import json
from typing import Any, Callable

from PySide6.QtCore import QRunnable


class AiWorker(QRunnable):
    """Runs an AI task off the GUI thread and emits the result via the bridge signal."""

    def __init__(
        self,
        request_id: str,
        kind: str,
        task: Callable[[], dict[str, Any]],
        emit_fn: Callable[[str], None],
    ) -> None:
        super().__init__()
        self.request_id = request_id
        self.kind = kind
        self.task = task
        self.emit_fn = emit_fn
        self.setAutoDelete(True)

    def run(self) -> None:
        try:
            result = self.task()
        except Exception as exc:
            result = {"ok": False, "error": str(exc), "content": ""}
        payload = json.dumps(
            {"request_id": self.request_id, "kind": self.kind, "result": result},
            ensure_ascii=False,
        )
        self.emit_fn(payload)
