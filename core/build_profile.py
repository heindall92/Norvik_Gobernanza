"""Auto-generated at build time — perfil: production."""

import sys

BUILD_PROFILE = "production"
IS_DEMO_BUILD = False
APP_DATA_FOLDER = "Norvik"
DEV_DATA_FOLDER = "Norvik-Dev"
WINDOW_TITLE_SUFFIX = ""
DEMO_ORG_NAME = "Acme Corp — Demo GRC"
FACTORY_RESET_VERSION = "1"

PROFILE_SETTING_KEYS = (
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


def resolve_data_folder() -> str:
    """Dev (python main.py) never writes into the production AppData folder."""
    if getattr(sys, "frozen", False):
        return APP_DATA_FOLDER
    return DEV_DATA_FOLDER
