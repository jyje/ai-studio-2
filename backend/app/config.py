"""
Configuration settings for the backend application.

A.X 4.0 API Configuration:
- Source: https://github.com/SKT-AI/A.X-4.0/blob/main/apis/README.md
- API Documentation: https://raw.githubusercontent.com/SKT-AI/A.X-4.0/main/apis/README.md
"""

import os

# LLM API Configuration
## using SKT-AI's A.X 4.0
## Public API key for anonymous users (FREE tier)
## Source: https://github.com/SKT-AI/A.X-4.0/blob/main/apis/README.md
LLM_API_BASE_URL = os.getenv(
    "LLM_API_BASE_URL",
    "https://guest-api.sktax.chat/v1"
)
LLM_API_KEY = os.getenv(
    "LLM_API_KEY",
    "sktax-XyeKFrq67ZjS4EpsDlrHHXV8it"
)
LLM_MODEL_NAME = os.getenv("LLM_MODEL_NAME", "ax4")
