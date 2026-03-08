import pytest
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from asgi_lifespan import LifespanManager
from app.main import app

@pytest.fixture
async def ac() -> AsyncGenerator[AsyncClient, None]:
    """
    Async client fixture for testing FastAPI endpoints.
    Uses LifespanManager to ensure startup/shutdown events are triggered.
    """
    async with LifespanManager(app):
        # We use ASGITransport to communicate directly with the app
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client
