"""Norvik entry point."""

from __future__ import annotations

import sys
from pathlib import Path

from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QFont, QPalette, QColor
from PySide6.QtWidgets import QApplication

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from core.database import initialize
from ui.main_window import MainWindow
from ui.splash import SplashScreen


def apply_dark_palette(app: QApplication) -> None:
    app.setStyle("Fusion")
    palette = QPalette()
    palette.setColor(QPalette.ColorRole.Window, QColor("#1E2130"))
    palette.setColor(QPalette.ColorRole.WindowText, QColor("#ECEFF4"))
    palette.setColor(QPalette.ColorRole.Base, QColor("#252A3D"))
    palette.setColor(QPalette.ColorRole.AlternateBase, QColor("#2E3450"))
    palette.setColor(QPalette.ColorRole.Text, QColor("#ECEFF4"))
    palette.setColor(QPalette.ColorRole.Button, QColor("#252A3D"))
    palette.setColor(QPalette.ColorRole.ButtonText, QColor("#ECEFF4"))
    palette.setColor(QPalette.ColorRole.Highlight, QColor("#88C0D0"))
    palette.setColor(QPalette.ColorRole.HighlightedText, QColor("#1E2130"))
    app.setPalette(palette)


def main() -> int:
    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )
    app = QApplication(sys.argv)
    app.setApplicationName("Norvik")
    app.setOrganizationName("Norvik")
    app.setApplicationDisplayName("Norvik — Governance & Compliance")
    app.setFont(QFont("Segoe UI", 10))
    apply_dark_palette(app)

    splash = SplashScreen()
    splash.show()
    app.processEvents()

    splash.set_message("Inicializando base de datos...")
    app.processEvents()
    conn = initialize()

    splash.set_message("Cargando dashboard...")
    app.processEvents()

    window = MainWindow(conn)

    def show_main():
        splash.close()
        window.show()
        window.raise_()
        window.activateWindow()

    QTimer.singleShot(120, show_main)
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
