from typing import List, Optional
from pydantic import BaseModel, Field

class LLMModelConfig(BaseModel):
    """Configuration for individual LLM models (foundation or embedding)."""
    type: str
    name: str
    creator: Optional[str] = None
    id: str
    default: bool = False

class ProviderOptions(BaseModel):
    """Optional settings for a provider, like model scanning."""
    scan_models: bool = False
    scan_models_endpoint: str = "/models"

class ProviderConfig(BaseModel):
    """Configuration for an LLM provider encompassing multiple models."""
    name: str
    type: str
    base_url: Optional[str] = None
    api_key: str
    config: ProviderOptions = Field(default_factory=ProviderOptions)
    models: List[LLMModelConfig] = Field(default_factory=list)

class SettingsConfig(BaseModel):
    """Root configuration model for parsing dynaconf settings."""
    providers: List[ProviderConfig] = Field(default_factory=list)
