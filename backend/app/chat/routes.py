"""Chat API routes."""

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from app.chat.service import chat_service
from app.chat.schemas import (
    ChatRequest,
    ChatInfoResponse,
    ModelsListResponse,
    ModelInfo,
    GraphStructureResponse,
    GraphNode,
    GraphEdge
)
from app.chat.llm_client import llm_list
from app.chat.langgraph_agent import create_react_agent
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
    """Get list of available models by provider.
    
    Returns all profiles from settings.yaml, including those with unresolved environment variables.
    Profiles are returned in the order they appear in settings.yaml.
    """
    # Get all profiles from config (including unavailable ones)
    all_profiles = llm_list.list_all_profiles_from_config()
    
    # Group by provider while maintaining order
    models_info: dict[str, list[ModelInfo]] = {}
    providers_order = []  # Maintain order of providers as they appear in settings.yaml
    
    for profile_data in all_profiles:
        provider = profile_data.get('provider')
        if provider:
            # Add provider to order list only if not already added
            if provider not in providers_order:
                providers_order.append(provider)
            if provider not in models_info:
                models_info[provider] = []
            # Only include available fields for ModelInfo
            profile_info = {
                'name': profile_data.get('name', ''),
                'provider': profile_data.get('provider', ''),
                'model': profile_data.get('model', ''),
                'base_url': profile_data.get('base_url', ''),
                'default': profile_data.get('default', False),
            }
            models_info[provider].append(ModelInfo(**profile_info))
    
    return ModelsListResponse(
        models=models_info,
        providers=providers_order  # Maintain order from settings.yaml
    )


@router.get('/graph', response_model=GraphStructureResponse)
def get_graph_structure() -> GraphStructureResponse:
    """Get the LangGraph agent structure for visualization.
    
    Returns the nodes and edges of the ReAct agent graph.
    This allows the frontend to dynamically render the agent structure
    without hardcoding the graph topology.
    """
    # Get a default LLM client to create an agent
    default_client = llm_list.get_default_client()
    
    if not default_client:
        raise HTTPException(
            status_code=503,
            detail="No LLM client available. Please configure at least one LLM profile."
        )
    
    # Create a temporary agent to extract graph structure
    agent = create_react_agent(default_client)
    graph_data = agent.get_graph_structure()
    
    # Convert to response schema
    nodes = [GraphNode(**node) for node in graph_data["nodes"]]
    edges = [GraphEdge(**edge) for edge in graph_data["edges"]]
    
    return GraphStructureResponse(nodes=nodes, edges=edges)


@router.post('/chat')
async def chat(request: Request, chat_request: ChatRequest):
    """Stream chat response in SSE format.
    
    Supports two agent types:
    - 'basic': Direct LLM chat (default)
    - 'langgraph': ReAct agent with tool support (time, weather)
    
    Supports multi-turn conversation via session_id parameter.
    """
    return StreamingResponse(
        chat_service.stream_chat_response(
            user_message=chat_request.message,
            model=chat_request.model,
            provider=chat_request.provider,
            agent_type=chat_request.agent_type,
            session_id=chat_request.session_id,
            request=request
        ),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',  # Disable buffering for nginx
        }
    )
