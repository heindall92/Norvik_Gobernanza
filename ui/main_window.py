"""Main window with QWebEngineView dashboard shell."""

from __future__ import annotations

import sys
from pathlib import Path

from PySide6.QtCore import QUrl, Qt
from PySide6.QtGui import QGuiApplication, QIcon
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtWebEngineCore import QWebEngineProfile, QWebEngineSettings
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWidgets import QMainWindow

from ui.bridge import Bridge


def project_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent.parent


PROJECT_ROOT = project_root()
ASSETS = PROJECT_ROOT / "assets"
WEB_DIR = PROJECT_ROOT / "ui" / "web"


def _enable_dark_titlebar(window) -> None:
    if sys.platform != "win32":
        return
    try:
        import ctypes

        hwnd = int(window.winId())
        DWMWA_USE_IMMERSIVE_DARK_MODE = 20
        value = ctypes.c_int(1)
        ctypes.windll.dwmapi.DwmSetWindowAttribute(
            hwnd,
            DWMWA_USE_IMMERSIVE_DARK_MODE,
            ctypes.byref(value),
            ctypes.sizeof(value),
        )
    except Exception:
        pass


def _fit_window_to_screen(window: QMainWindow) -> None:
    screen = QGuiApplication.primaryScreen()
    if not screen:
        window.resize(1280, 800)
        return
    available = screen.availableGeometry()
    margin_w = 48 if available.width() >= 1280 else 24
    margin_h = 48 if available.height() >= 800 else 24
    width = max(720, min(1600, available.width() - margin_w))
    height = max(480, min(960, available.height() - margin_h))
    window.resize(width, height)
    frame = window.frameGeometry()
    frame.moveCenter(available.center())
    window.move(frame.topLeft())


class MainWindow(QMainWindow):
    def __init__(self, conn) -> None:
        super().__init__()
        self._conn = conn
        self.setWindowTitle("Norvik — Governance & Compliance")
        self.setMinimumSize(720, 480)

        icon_path = ASSETS / "icon.ico"
        if icon_path.exists():
            self.setWindowIcon(QIcon(str(icon_path)))

        self.view = QWebEngineView(self)
        self.setCentralWidget(self.view)

        profile = QWebEngineProfile.defaultProfile()
        profile.setPersistentCookiesPolicy(
            QWebEngineProfile.PersistentCookiesPolicy.NoPersistentCookies
        )

        settings = self.view.settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessFileUrls, True)
        settings.setAttribute(
            QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True
        )
        settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)

        self.channel = QWebChannel(self.view.page())
        self.bridge = Bridge(conn, self)
        self.channel.registerObject("bridge", self.bridge)
        self.view.page().setWebChannel(self.channel)

        index = WEB_DIR / "index.html"
        self.view.load(QUrl.fromLocalFile(str(index.resolve())))

        _fit_window_to_screen(self)
        _enable_dark_titlebar(self)

    def closeEvent(self, event) -> None:
        if self._conn:
            self._conn.close()
        super().closeEvent(event)
