# -*- mode: python ; coding: utf-8 -*-

import sys
from pathlib import Path

block_cipher = None
root = Path(SPECPATH)

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
    name='Norvik',
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
    name='Norvik',
)
