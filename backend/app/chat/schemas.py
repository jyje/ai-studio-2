"""Chat domain schemas for request/response models."""

from pydantic import BaseModel, Field
from typing import Literal, Dict, List, Optional


# Agent type literal for type safety
AgentType = Literal["basic", "langgraph"]


class ChatRequest(BaseModel):
    """Request schema for chat endpoint."""
    
    message: str = Field(..., description="User message content")
    model: str = Field(..., description="Profile name or model name to use")
    provider: Optional[Literal["openai", "azureopenai"]] = Field(
        default=None,
        description="Optional LLM provider (openai or azureopenai). If not specified, searches by model name."
    )
    agent_type: AgentType = Field(
        default="basic",
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
    provider: str = Field(..., description="Provider name")
    model: str = Field(..., description="Model name")
    base_url: str = Field(..., description="Base URL (acts as entrypoint for Azure OpenAI)")
    default: bool = Field(default=False, description="Whether this is the default profile")


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
