# -*- mode: python ; coding: utf-8 -*-

import os
from pathlib import Path

block_cipher = None
root = Path(SPECPATH)
profile = os.environ.get("NORVIK_BUILD", "production")
app_name = "Norvik-Demo" if profile == "demo" else "Norvik"

a = Analysis(
    [str(root / 'main.py')],
    pathex=[str(root)],
    binaries=[],
    datas=[
        (str(root / 'ui' / 'web'), 'ui/web'),
        (str(root / 'assets'), 'assets'),
        (str(root / 'data' / 'frameworks'), 'data/frameworks'),
    ],
    hiddenimports=[
        'PySide6.QtWebEngineWidgets',
        'PySide6.QtWebEngineCore',
        'PySide6.QtWebChannel',
        'reportlab.graphics.barcode',
        'keyring',
        'keyring.backends',
        'keyring.backends.Windows',
        'win32ctypes',
        'win32ctypes.pywin32',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name=app_name,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(root / 'assets' / 'icon.ico') if (root / 'assets' / 'icon.ico').exists() else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name=app_name,
)
