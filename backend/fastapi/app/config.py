"""
Configuration settings for the backend application using dynaconf.

Configuration is loaded from settings.yaml file.
Environment variables can override settings using dynaconf syntax.
"""

from pathlib import Path
from dynaconf import Dynaconf

# Get the backend directory (parent of app directory)
BACKEND_DIR = Path(__file__).parent.parent
SETTINGS_FILE = BACKEND_DIR / 'settings.yaml'

# Initialize dynaconf settings
# Settings will be loaded from settings.yaml in the backend directory
settings = Dynaconf(
    settings_files=[str(SETTINGS_FILE)],
    root_path=str(BACKEND_DIR),
    environments=False,  # Disable environment-based config for simplicity
    envvar_prefix=False,  # Don't require DYNACONF_ prefix
    load_dotenv=True,  # Load .env file if exists
)
