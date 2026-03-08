"""LLM client pool management for multiple LLM profiles using LangChain."""

import os
import re
import requests
import warnings
import logging
from typing import Optional, Dict, List, Any
from langchain_openai import ChatOpenAI, AzureChatOpenAI, OpenAIEmbeddings
from langchain_core.messages import HumanMessage

from app.configs import settings
from app.configs.providers import ProviderConfig, LLMModelConfig

# Setup logger
logger = logging.getLogger("uvicorn")

class LLMClient:
    """Wrapper class for LangChain chat models supporting multiple providers."""
    
    def __init__(
        self,
        name: str,
        provider: str,
        model: str,
        base_url: str,
        api_key: str,
        model_type: str = "foundation_model",
        default: bool = False,
        max_tokens: int = 10000,
        provider_name: str = ""
    ):
        """Initialize LangChain chat model with configuration.
        
        Args:
            name: Model name identifier (e.g. "GPT OSS 120B").
            provider: Provider type ('openai', 'azureopenai', or 'nvidia_ai_endpoints').
            model: Model ID to be sent to the API.
            base_url: Base URL for the API.
            api_key: API key for authentication.
            model_type: Type of the model (e.g., 'foundation_model', 'embedding_model').
            default: Whether this is the default LLM profile.
            provider_name: Visual name of the Provider group.
        """
        self.name = name
        self.provider = provider
        self.model = model
        self.base_url = base_url
        self.api_key = api_key
        self.model_type = model_type
        self.default = default
        self.max_tokens = max_tokens
        self.provider_name = provider_name
        
        # We only initialize foundation models for Chat right now
        # Embedding models would be initialized using a different Langchain class
        if self.model_type == 'foundation_model':
            if provider == 'openai':
                self.llm = ChatOpenAI(
                    model=model,
                    openai_api_key=api_key,
                    openai_api_base=base_url if base_url else None,
                    streaming=True,
                    temperature=0.7,
                    max_tokens=max_tokens,
                )
            elif provider == 'azureopenai':
                self.llm = AzureChatOpenAI(
                    azure_endpoint=base_url.rstrip('/'),
                    azure_deployment=model,
                    openai_api_version="2024-02-15-preview",
                    openai_api_key=api_key,
                    streaming=True,
                    temperature=0.7,
                    max_tokens=max_tokens,
                )
            elif provider == 'nvidia_ai_endpoints':
                # Use OpenAI-compatible class to support all scanned models
                # without triggered "unknown type" warnings from ChatNVIDIA.
                self.llm = ChatOpenAI(
                    model=model,
                    openai_api_key=api_key,
                    openai_api_base=base_url if base_url else "https://integrate.api.nvidia.com/v1",
                    streaming=True,
                    temperature=0.7,
                    max_tokens=max_tokens,
                )
            else:
                self.llm = None
        elif self.model_type == 'embedding_model':
            if provider == 'nvidia_ai_endpoints':
                # Use OpenAI-compatible class for embeddings
                self.llm = OpenAIEmbeddings(
                    model=model,
                    openai_api_key=api_key,
                    openai_api_base=base_url if base_url else "https://integrate.api.nvidia.com/v1",
                )
            else:
                self.llm = None
        else:
            self.llm = None
            
    def stream(self, messages: list[dict[str, str]]):
        """Stream chat completion using LangChain."""
        if not self.llm:
            raise ValueError(f"Cannot stream with {self.model_type} or unsupported provider.")
            
        langchain_messages = []
        for msg in messages:
            if msg['role'] == 'user':
                langchain_messages.append(HumanMessage(content=msg['content']))
            elif msg['role'] == 'assistant':
                from langchain_core.messages import AIMessage
                langchain_messages.append(AIMessage(content=msg['content']))
            elif msg['role'] == 'system':
                from langchain_core.messages import SystemMessage
                langchain_messages.append(SystemMessage(content=msg['content']))
        
        for chunk in self.llm.stream(langchain_messages):
            yield chunk
            
    def to_dict(self) -> Dict:
        """Convert LLMClient instance to dictionary."""
        return {
            'name': self.name,
            'provider': self.provider,
            'model': self.model,
            'base_url': self.base_url,
            'model_type': self.model_type,
            'default': self.default,
            'max_tokens': self.max_tokens,
            'provider_name': self.provider_name
        }


class ProviderManager:
    """List of LLM clients for managing multiple providers dynamically."""
    
    def __init__(self):
        """Initialize Provider Manager from settings."""
        self.profiles: Dict[str, LLMClient] = {}  # {profile_name: LLMClient}
        self.default_client: Optional[LLMClient] = None
        self.raw_config: List[Dict] = []  # Store raw parsed configs for frontend representation
        self._load_from_settings()
        
    def reload(self):
        """Reload LLM configurations from settings.yaml."""
        self.profiles.clear()
        self.raw_config.clear()
        self.default_client = None
        settings.reload()
        self._load_from_settings()
    
    def _resolve_env_var(self, value: str) -> str:
        """Resolve environment variable references in a string."""
        if not value:
            return ''
        value_str = str(value)
        env_var_pattern = r'\$\{([^}]+)\}'
        match = re.search(env_var_pattern, value_str)
        if match:
            var_expr = match.group(1)
            if ':-' in var_expr:
                var_name, default_value = var_expr.split(':-', 1)
                env_value = os.getenv(var_name.strip(), default_value.strip())
            else:
                env_value = os.getenv(var_expr.strip())
            if env_value:
                value_str = re.sub(env_var_pattern, env_value, value_str, count=1)
            else:
                return ''
        return value_str

    def _scan_live_models(self, provider_config: ProviderConfig, resolved_api_key: str, resolved_base_url: str) -> List[str]:
        """Fetch live models from provider endpoint if scanning is enabled."""
        if not provider_config.config.scan_models or not resolved_base_url:
            return []
            
        endpoint = provider_config.config.scan_models_endpoint
        url = f"{resolved_base_url.rstrip('/')}{endpoint}"
        
        headers = {
            "Authorization": f"Bearer {resolved_api_key}",
            "Accept": "application/json"
        }
        
        try:
            logger.info(f"Scanning models from {url}...")
            response = requests.get(url, headers=headers, timeout=5)
            response.raise_for_status()
            data = response.json()
            # Often endpoints return { "data": [ {"id": "..."}, ... ] }
            models = data.get("data", [])
            live_model_ids = [m.get("id") for m in models if "id" in m]
            logger.info(f"Scanned {len(live_model_ids)} active models from {provider_config.name}")
            return live_model_ids
        except Exception as e:
            logger.error(f"Failed to scan models for {provider_config.name}: {e}")
            return []

    def _load_from_settings(self):
        """Load LLM configurations from settings.yaml using providers namespace."""
        providers_data = settings.get('providers', [])
        default_found = False
        
        # Backwards compatibility check
        old_llm_list = settings.get('llm_list', [])
        if old_llm_list and not providers_data:
            logger.warning("Warning: you are using 'llm_list' syntax. Please migrate to 'providers'.")
            
        for p_data in providers_data:
            try:
                # Convert dict to Pydantic Model for validation
                provider_cfg = ProviderConfig.model_validate(p_data)
            except Exception as e:
                import warnings
                warnings.warn(f"Failed to parse provider: {e}", UserWarning)
                continue
                
            p_name = provider_cfg.name
            p_type = provider_cfg.type
            max_tokens = 10000 
            
            # Resolve provider-level env vars
            p_base_url = self._resolve_env_var(provider_cfg.base_url)
            p_api_key = self._resolve_env_var(provider_cfg.api_key)
            
            if not p_api_key:
                import warnings
                warnings.warn(f"Skipping Provider '{p_name}': API Key not resolvable", UserWarning)
                continue
                
            # Scan active models
            live_model_ids = self._scan_live_models(provider_cfg, p_api_key, p_base_url)
            
            for m_config in provider_cfg.models:
                m_name = m_config.name
                m_id = m_config.id
                m_type = m_config.type
                m_default = m_config.default
                m_creator = m_config.creator or p_name
                
                # Check scanning validation
                is_available = True
                if provider_cfg.config.scan_models:
                    if live_model_ids and m_id not in live_model_ids:
                        is_available = False
                        
                # Keep raw info for frontend representation
                profile_dict = {
                    'name': m_name,
                    'provider': p_type,
                    'provider_name': p_name,
                    'model_creator': m_creator,
                    'model': m_id,
                    'base_url': p_base_url,
                    'model_type': m_type,
                    'default': m_default,
                    'max_tokens': max_tokens,
                    'available': is_available
                }
                self.raw_config.append(profile_dict)
                
                if not is_available:
                    logger.info(f"Model {m_name} ({m_id}) is not active on endpoint. Skipping initialization.")
                    continue
                    
                # Initialize LLM Client
                try:
                    client = LLMClient(
                        name=m_name,
                        provider=p_type,
                        model=m_id,
                        base_url=p_base_url,
                        api_key=p_api_key,
                        model_type=m_type,
                        default=m_default,
                        max_tokens=max_tokens,
                        provider_name=p_name
                    )
                    
                    self.profiles[m_name] = client
                    
                    if m_default and not default_found and m_type == 'foundation_model':
                        self.default_client = client
                        default_found = True
                        
                except Exception as e:
                    import warnings
                    warnings.warn(f"Failed to initialize model '{m_name}': {e}", UserWarning)
                    pass

        if not default_found and self.profiles:
            # Try to grab first foundation model as fallback default
            for c in self.profiles.values():
                if c.model_type == 'foundation_model':
                    self.default_client = c
                    default_found = True
                    break
            
            if not default_found:
                self.default_client = next(iter(self.profiles.values()))
    
    def get_client(self, profile_name: Optional[str] = None) -> Optional[LLMClient]:
        if profile_name:
            # First try matching by the visual name (profile name)
            client = self.profiles.get(profile_name)
            if client:
                return client
            
            # Fallback: try matching by the model ID
            for c in self.profiles.values():
                if c.model == profile_name:
                    return c
            return None
        return self.default_client
    
    def get_client_by_provider_and_model(self, provider: str, model: str) -> Optional[LLMClient]:
        for client in self.profiles.values():
            if client.provider == provider and client.model == model:
                return client
        return None
    
    def list_all_profiles_from_config(self, provider: Optional[str] = None) -> List[Dict]:
        if provider:
            return [p for p in self.raw_config if p.get('provider') == provider]
        return self.raw_config
        
    def get_default_client(self) -> Optional[LLMClient]:
        return self.default_client

# Maintain backward compatibility with existing usages
llm_list = ProviderManager()
