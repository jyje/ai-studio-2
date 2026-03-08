"""Chat domain schemas for request/response models."""

from pydantic import BaseModel, Field
from typing import Literal, Dict, List, Optional


# Agent type literal for type safety
AgentType = Literal["basic", "langgraph", "plan-1"]


class ChatRequest(BaseModel):
    """Request schema for chat endpoint."""
    
    message: str = Field(..., description="User message content")
    model: str = Field(..., description="Profile name or model name to use")
    provider: Optional[Literal["openai", "azureopenai", "nvidia_ai_endpoints"]] = Field(
        default=None,
        description="Optional LLM provider (openai, azureopenai, or nvidia_ai_endpoints). If not specified, searches by model name."
    )
    agent_type: AgentType = Field(
        default="langgraph",
        description="Agent type to use: 'basic' for direct LLM, 'langgraph' for ReAct agent with tools"
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Session ID for multi-turn conversation. If not provided, a new session will be created."
    )


class ChatInfoResponse(BaseModel):
    """Response schema for info endpoint."""
    
    profile_name: str = Field(..., description="Default LLM profile name")
    provider: str = Field(..., description="Default LLM provider")
    agent: str = Field(..., description="Agent name")


class ModelInfo(BaseModel):
    """Schema for individual model/profile information."""
    
    name: str = Field(..., description="Profile name")
    provider: str = Field(..., description="Provider internal name")
    provider_name: str = Field(default="", description="Visual Provider name")
    model: str = Field(..., description="Model ID")
    base_url: str = Field(..., description="Base URL")
    model_type: str = Field(default="foundation_model", description="foundation_model or embedding_model")
    default: bool = Field(default=False, description="Whether this is the default profile")
    available: bool = Field(default=True, description="Whether this model was successfully scanned/verified")


class ModelsListResponse(BaseModel):
    """Response schema for models list endpoint."""
    
    models: Dict[str, List[ModelInfo]] = Field(
        ...,
        description="Dictionary mapping provider names to lists of available models"
    )
    providers: List[str] = Field(..., description="List of available provider names")


class ChatEventData(BaseModel):
    """Schema for SSE event data."""
    
    status: str | None = Field(None, description="Event status")
    error: str | None = Field(None, description="Error message")


class GraphNode(BaseModel):
    """Schema for a node in the agent graph."""
    
    id: str = Field(..., description="Node identifier")
    type: Literal["start", "end", "node"] = Field(..., description="Node type")
    label: Optional[str] = Field(None, description="Display label for the node")


class GraphEdge(BaseModel):
    """Schema for an edge in the agent graph."""
    
    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    conditional: bool = Field(default=False, description="Whether this is a conditional edge")
    label: Optional[str] = Field(None, description="Edge label for conditional edges")
    sourceHandle: Optional[str] = Field(None, description="Source handle ID for connection point (e.g., 'right-source', 'bottom-source')")
    targetHandle: Optional[str] = Field(None, description="Target handle ID for connection point (e.g., 'left-target', 'top-target')")


class GraphStructureResponse(BaseModel):
    """Response schema for graph structure endpoint."""
    
    nodes: List[GraphNode] = Field(..., description="List of nodes in the graph")
    edges: List[GraphEdge] = Field(..., description="List of edges in the graph")
