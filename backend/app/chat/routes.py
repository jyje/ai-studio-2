"""Chat API routes."""

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from app.chat.service import chat_service
from app.chat.schemas import (
    ChatRequest,
    ChatInfoResponse,
    ModelsListResponse,
    ModelInfo
)
from app.chat.llm_client import llm_list
from app.config import settings

router = APIRouter(prefix="/v2", tags=["chat"])


@router.get('/info', response_model=ChatInfoResponse)
def get_info() -> ChatInfoResponse:
    """Get default profile name, provider and agent information."""
    default_client = llm_list.get_default_client()
    default_profile_name = default_client.name if default_client else 'default'
    default_provider = default_client.provider if default_client else 'openai'
    agent_name = settings.get('app', {}).get('agent', 'AI Studio 2.0')
    
    return ChatInfoResponse(
        profile_name=default_profile_name,
        provider=default_provider,
        agent=agent_name
    )


@router.get('/models', response_model=ModelsListResponse)
def get_models() -> ModelsListResponse:
    """Get list of available models by provider."""
    all_profiles = llm_list.list_profiles()
    
    # Group by provider
    models_info: dict[str, list[ModelInfo]] = {}
    for profile_data in all_profiles:
        provider = profile_data.get('provider')
        if provider not in models_info:
            models_info[provider] = []
        models_info[provider].append(ModelInfo(**profile_data))
    
    return ModelsListResponse(
        models=models_info,
        providers=llm_list.get_providers()
    )


@router.post('/chat')
async def chat(request: Request, chat_request: ChatRequest):
    """Stream chat response in SSE format."""
    return StreamingResponse(
        chat_service.stream_chat_response(
            user_message=chat_request.message,
            model=chat_request.model,
            provider=chat_request.provider,
            request=request
        ),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',  # Disable buffering for nginx
        }
    )
