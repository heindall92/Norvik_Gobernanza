"""PySide6 splash screen."""

from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from PySide6.QtWidgets import QLabel, QProgressBar, QVBoxLayout, QWidget


class SplashScreen(QWidget):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowFlags(Qt.WindowType.SplashScreen | Qt.WindowType.FramelessWindowHint)
        self.setFixedSize(420, 220)
        self.setStyleSheet(
            """
            QWidget {
                background: qlineargradient(x1:0,y1:0,x2:1,y2:1,
                    stop:0 #1E2130, stop:1 #252A3D);
                color: #ECEFF4;
                border: 1px solid rgba(136,192,208,0.35);
                border-radius: 16px;
            }
            QLabel#title { font-size: 28px; font-weight: 700; color: #88C0D0; }
            QLabel#sub { font-size: 11px; color: #8892A4; letter-spacing: 2px; }
            QProgressBar {
                background: rgba(255,255,255,0.08);
                border: none;
                border-radius: 4px;
                height: 6px;
                text-visible: false;
            }
            QProgressBar::chunk {
                background: qlineargradient(x1:0,y1:0,x2:1,y2:0,
                    stop:0 #88C0D0, stop:1 #81A1C1);
                border-radius: 4px;
            }
            """
        )

        layout = QVBoxLayout(self)
        layout.setContentsMargins(32, 32, 32, 28)
        layout.setSpacing(12)

        title = QLabel("Norvik")
        title.setObjectName("title")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        title.setFont(QFont("Segoe UI", 22, QFont.Weight.Bold))

        subtitle = QLabel("GOVERNANCE & COMPLIANCE")
        subtitle.setObjectName("sub")
        subtitle.setAlignment(Qt.AlignmentFlag.AlignCenter)

        self.status = QLabel("Inicializando...")
        self.status.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.status.setStyleSheet("color: #D8DEE9; font-size: 12px;")

        self.progress = QProgressBar()
        self.progress.setRange(0, 0)

        layout.addStretch()
        layout.addWidget(title)
        layout.addWidget(subtitle)
        layout.addStretch()
        layout.addWidget(self.status)
        layout.addWidget(self.progress)

    def set_message(self, message: str) -> None:
        self.status.setText(message)
