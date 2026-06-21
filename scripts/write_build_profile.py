"""Write core/build_profile.py for demo or production PyInstaller builds."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "core" / "build_profile.py"

PROFILE_KEYS = (
    "user_name",
    "user_role",
    "user_email",
    "user_phone",
    "user_department",
    "user_location",
    "user_bio",
    "user_linkedin",
    "user_github",
    "user_twitter",
    "user_website",
    "user_avatar",
)

PROFILES = {
    "production": {
        "BUILD_PROFILE": "production",
        "IS_DEMO_BUILD": False,
        "APP_DATA_FOLDER": "Norvik",
        "WINDOW_TITLE_SUFFIX": "",
        "DEMO_ORG_NAME": "Acme Corp — Demo GRC",
        "FACTORY_RESET_VERSION": "1",
    },
    "demo": {
        "BUILD_PROFILE": "demo",
        "IS_DEMO_BUILD": True,
        "APP_DATA_FOLDER": "Norvik-Demo",
        "WINDOW_TITLE_SUFFIX": " — Demo Edition",
        "DEMO_ORG_NAME": "Acme Corp — Demo GRC",
        "FACTORY_RESET_VERSION": "0",
    },
}


def main() -> int:
    profile = (sys.argv[1] if len(sys.argv) > 1 else "production").strip().lower()
    if profile not in PROFILES:
        print(f"Perfil desconocido: {profile}. Usa: production | demo", file=sys.stderr)
        return 1
    cfg = PROFILES[profile]
    keys_literal = ",\n    ".join(f'"{k}"' for k in PROFILE_KEYS)
    content = f'''"""Auto-generated at build time — perfil: {profile}."""

import sys

BUILD_PROFILE = "{cfg["BUILD_PROFILE"]}"
IS_DEMO_BUILD = {cfg["IS_DEMO_BUILD"]}
APP_DATA_FOLDER = "{cfg["APP_DATA_FOLDER"]}"
DEV_DATA_FOLDER = "Norvik-Dev"
WINDOW_TITLE_SUFFIX = "{cfg["WINDOW_TITLE_SUFFIX"]}"
DEMO_ORG_NAME = "{cfg["DEMO_ORG_NAME"]}"
FACTORY_RESET_VERSION = "{cfg["FACTORY_RESET_VERSION"]}"

PROFILE_SETTING_KEYS = (
    {keys_literal},
)


def resolve_data_folder() -> str:
    """Dev (python main.py) never writes into the production AppData folder."""
    if getattr(sys, "frozen", False):
        return APP_DATA_FOLDER
    return DEV_DATA_FOLDER
'''
    TARGET.write_text(content, encoding="utf-8")
    print(f"build_profile.py -> {profile} ({TARGET})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
