import pytest
import json
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_read_root(ac: AsyncClient):
    """Test health check root endpoint."""
    response = await ac.get("/")
    assert response.status_code == 200
    assert response.json() == {"Hello": "World"}

@pytest.mark.asyncio
async def test_get_models(ac: AsyncClient):
    """Test model listing endpoint with filtering for foundation models."""
    response = await ac.get("/v2/models")
    assert response.status_code == 200
    data = response.json()
    assert "models" in data
    assert "providers" in data
    
    # Verify no embedding models are in the response
    for provider, profiles in data["models"].items():
        for profile in profiles:
            assert profile["model_type"] != "embedding_model"
            assert "name" in profile
            assert "available" in profile

@pytest.mark.asyncio
async def test_get_info(ac: AsyncClient):
    """Test general model info endpoint."""
    response = await ac.get("/v2/info")
    assert response.status_code == 200
    data = response.json()
    assert "profile_name" in data
    assert "provider" in data
    assert "agent" in data

@pytest.mark.asyncio
async def test_chat_streaming(ac: AsyncClient):
    """
    Test chat streaming endpoint (SSE).
    We check the first few events to verify streaming is working.
    """
    payload = {
        "message": "안녕하세요",
        "model": "openai/gpt-oss-20b",  # Using model ID
        "provider": "nvidia_ai_endpoints",
        "agent_type": "basic"
    }
    
    # We use stream() to test SSE
    async with ac.stream("POST", "/v2/chat", json=payload) as response:
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/event-stream; charset=utf-8"
        
        events_captured = []
        async for line in response.aiter_lines():
            if line.strip():
                events_captured.append(line)
                # Capture only first few chunks to verify communication
                if len(events_captured) > 5:
                    break
        
        assert len(events_captured) > 0
        assert any("event: start" in e for e in events_captured) or any("data: {" in e for e in events_captured)
