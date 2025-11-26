"""LLM client pool management for multiple LLM profiles using LangChain."""

import os
import re
from typing import Optional, Dict, List
from langchain_openai import ChatOpenAI, AzureChatOpenAI
from langchain_core.messages import HumanMessage
from app.config import settings


class LLMClient:
    """Wrapper class for LangChain chat models supporting multiple providers."""
    
    def __init__(
        self,
        name: str,
        provider: str,
        model: str,
        base_url: str,
        api_key: str,
        default: bool = False
    ):
        """Initialize LangChain chat model with configuration.
        
        Args:
            name: Profile name identifier.
            provider: Provider name ('openai' or 'azureopenai').
            model: Model name.
            base_url: Base URL for the API (acts as entrypoint for Azure OpenAI).
            api_key: API key for authentication.
            default: Whether this is the default LLM profile.
        """
        self.name = name
        self.provider = provider
        self.model = model
        self.base_url = base_url
        self.api_key = api_key
        self.default = default
        
        # Initialize LangChain chat model based on provider
        if provider == 'openai':
            # Use ChatOpenAI for OpenAI-compatible APIs
            self.llm = ChatOpenAI(
                model=model,
                openai_api_key=api_key,
                openai_api_base=base_url,
                streaming=True,
                temperature=0.7,
            )
        elif provider == 'azureopenai':
            # Use ChatAzureOpenAI for Azure OpenAI
            # base_url is used directly as azure_endpoint
            # base_url format: https://{resource}.openai.azure.com (or with /openai path)
            
            self.llm = AzureChatOpenAI(
                azure_endpoint=base_url.rstrip('/'),
                azure_deployment=model,  # deployment name
                openai_api_version="2024-02-15-preview",  # Default API version
                openai_api_key=api_key,
                streaming=True,
                temperature=0.7,
            )
        else:
            raise ValueError(f"Unsupported provider: {provider}")
    
    def stream(self, messages: list[dict[str, str]]):
        """Stream chat completion using LangChain.
        
        Args:
            messages: List of message dictionaries with 'role' and 'content' keys.
            
        Yields:
            Chunks from LangChain streaming response.
        """
        # Convert messages to LangChain message format
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
        
        # Stream response
        for chunk in self.llm.stream(langchain_messages):
            yield chunk
    
    def to_dict(self) -> Dict:
        """Convert LLMClient instance to dictionary."""
        return {
            'name': self.name,
            'provider': self.provider,
            'model': self.model,
            'base_url': self.base_url,
            'default': self.default,
        }


class LLMList:
    """List of LLM clients for managing multiple profiles."""
    
    def __init__(self):
        """Initialize LLM List from settings."""
        self.profiles: Dict[str, LLMClient] = {}  # {profile_name: LLMClient}
        self.default_client: Optional[LLMClient] = None
        self.raw_config: List[Dict] = []  # Store raw config from settings.yaml
        self._load_from_settings()
    
    def _resolve_env_var(self, value: str) -> str:
        """Resolve environment variable references in a string.
        
        Supports ${VAR} and ${VAR:-default} syntax.
        Falls back to os.getenv if dynaconf didn't resolve it.
        
        Args:
            value: String potentially containing ${VAR} syntax.
            
        Returns:
            Resolved string with environment variables substituted.
        """
        if not value:
            return ''
        
        value_str = str(value)
        
        # Check if it looks like an unresolved environment variable
        env_var_pattern = r'\$\{([^}]+)\}'
        match = re.search(env_var_pattern, value_str)
        
        if match:
            var_expr = match.group(1)
            # Handle default value syntax: ${VAR:-default}
            if ':-' in var_expr:
                var_name, default_value = var_expr.split(':-', 1)
                env_value = os.getenv(var_name.strip(), default_value.strip())
            else:
                env_value = os.getenv(var_expr.strip())
            
            if env_value:
                # Replace the ${VAR} pattern with the actual value
                value_str = re.sub(env_var_pattern, env_value, value_str, count=1)
            else:
                # Environment variable not found - return empty string
                # This will cause the profile to be skipped in validation
                return ''
        
        return value_str
    
    def _load_from_settings(self):
        """Load LLM configurations from settings.yaml."""
        llm_list_config = settings.get('llm_list', [])
        # Store raw config for listing all profiles
        self.raw_config = llm_list_config
        
        default_found = False
        
        for profile_config in llm_list_config:
            name = profile_config.get('name')
            provider = profile_config.get('provider')
            model = profile_config.get('model')
            base_url_raw = profile_config.get('base_url', '')
            api_key_raw = profile_config.get('api_key', '')
            default = profile_config.get('default', False)
            
            # Resolve environment variables if dynaconf didn't do it
            base_url = self._resolve_env_var(base_url_raw)
            api_key = self._resolve_env_var(api_key_raw)
            
            # Validate required fields after environment variable resolution
            if not name or not provider or not model or not base_url or not api_key:
                # Skip profiles with missing required fields or unresolved env vars
                import warnings
                warnings.warn(
                    f"Skipping LLM profile '{name}': missing required fields or unresolved environment variables",
                    UserWarning
                )
                continue
            
            try:
                client = LLMClient(
                    name=name,
                    provider=provider,
                    model=model,
                    base_url=base_url,
                    api_key=api_key,
                    default=default
                )
                
                self.profiles[name] = client
                
                # Set as default if marked as default and no default found yet
                if default and not default_found:
                    self.default_client = client
                    default_found = True
            except Exception as e:
                # Skip profiles that fail to initialize
                import warnings
                warnings.warn(
                    f"Failed to initialize LLM profile '{name}': {str(e)}",
                    UserWarning
                )
                continue
        
        # If no default was found, use the first profile as default
        if not default_found and self.profiles:
            self.default_client = next(iter(self.profiles.values()))
    
    def get_client(self, profile_name: Optional[str] = None) -> Optional[LLMClient]:
        """Get LLM client for specific profile name, or default if not specified.
        
        Args:
            profile_name: Optional profile name. If None, returns default client.
            
        Returns:
            LLMClient instance if found, None otherwise.
        """
        if profile_name:
            return self.profiles.get(profile_name)
        return self.default_client
    
    def get_client_by_provider_and_model(self, provider: str, model: str) -> Optional[LLMClient]:
        """Get LLM client by provider and model name.
        
        Args:
            provider: Provider name ('openai' or 'azureopenai').
            model: Model name.
            
        Returns:
            LLMClient instance if found, None otherwise.
        """
        for client in self.profiles.values():
            if client.provider == provider and client.model == model:
                return client
        return None
    
    def list_profiles(self, provider: Optional[str] = None) -> List[Dict]:
        """List all available profiles, optionally filtered by provider.
        
        Args:
            provider: Optional provider name to filter. If None, returns all profiles.
            
        Returns:
            List of profile dictionaries.
        """
        profiles = [client.to_dict() for client in self.profiles.values()]
        
        if provider:
            profiles = [p for p in profiles if p.get('provider') == provider]
        
        return profiles
    
    def list_all_profiles_from_config(self, provider: Optional[str] = None) -> List[Dict]:
        """List all profiles from settings.yaml config, including those with unresolved env vars.
        
        This method returns all profiles defined in settings.yaml, even if they
        couldn't be initialized due to missing environment variables.
        
        Args:
            provider: Optional provider name to filter. If None, returns all profiles.
            
        Returns:
            List of profile dictionaries from config.
        """
        profiles = []
        for profile_config in self.raw_config:
            profile_dict = {
                'name': profile_config.get('name', ''),
                'provider': profile_config.get('provider', ''),
                'model': profile_config.get('model', ''),
                'base_url': profile_config.get('base_url', ''),
                'default': profile_config.get('default', False),
            }
            # Check if this profile is actually initialized (available)
            is_available = profile_dict['name'] in self.profiles
            profile_dict['available'] = is_available
            
            if provider:
                if profile_dict.get('provider') == provider:
                    profiles.append(profile_dict)
            else:
                profiles.append(profile_dict)
        
        return profiles
    
    def get_providers(self) -> List[str]:
        """Get list of unique provider names.
        
        Returns:
            List of provider names.
        """
        providers = set(client.provider for client in self.profiles.values())
        return sorted(list(providers))
    
    def get_default_client(self) -> Optional[LLMClient]:
        """Get the default LLM client.
        
        Returns:
            Default LLMClient instance if available, None otherwise.
        """
        return self.default_client


# Global LLM List instance
llm_list = LLMList()
