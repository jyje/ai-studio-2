"""Chat service layer for business logic."""

from fastapi import Request, HTTPException
import json
from app.chat.llm_client import llm_list


class ChatService:
    """Service class for chat-related business logic."""
    
    def __init__(self):
        """Initialize ChatService with LLM List."""
        self.llm_list = llm_list
    
    async def stream_chat_response(
        self,
        user_message: str,
        model: str,
        request: Request,
        provider: str = None
    ):
        """Stream chat response in SSE format with client disconnect detection.
        
        Args:
            user_message: User's message content.
            model: Model name or profile name to use for the completion.
            request: FastAPI Request object for disconnect detection.
            provider: Optional provider name ('openai' or 'azureopenai'). 
                     If None, searches by model name only.
            
        Yields:
            SSE formatted strings for streaming response.
            
        Raises:
            HTTPException: If the specified provider/model is not found.
        """
        try:
            # Get client from LLM List
            # Always try to find by profile name first (name or model could be profile name)
            client = self.llm_list.get_client(profile_name=model)
            
            # If not found by profile name and provider is specified, try by provider and model
            if not client and provider:
                client = self.llm_list.get_client_by_provider_and_model(
                    provider=provider,
                    model=model
                )
            
            # If still not found, try to find by model name (search all providers)
            if not client:
                for client_candidate in self.llm_list.profiles.values():
                    if client_candidate.model == model:
                        client = client_candidate
                        break
            
            # If still not found, use default
            if not client:
                client = self.llm_list.get_default_client()
            
            if not client:
                error_msg = f"Model '{model}' not found"
                if provider:
                    error_msg += f" for provider '{provider}'"
                error_msg += ". Please check your LLM configuration in settings.yaml and ensure all required environment variables are set."
                yield "event: error\n"
                yield f"data: {json.dumps({'error': error_msg})}\n\n"
                return
            
            # Send start event
            yield "event: start\n"
            yield f"data: {json.dumps({'status': 'started'})}\n\n"
            
            # Create streaming completion using LangChain
            stream = client.stream(
                messages=[
                    {"role": "user", "content": user_message}
                ]
            )
            
            for chunk in stream:
                # Check if client disconnected
                if await request.is_disconnected():
                    break
                
                # LangChain returns chunks with content attribute
                if hasattr(chunk, 'content') and chunk.content:
                    # Send data in SSE format: data: {content}\n\n
                    # JSON-encode the content to handle special characters
                    content_json = json.dumps(chunk.content)
                    yield f"data: {content_json}\n\n"
            
            # Send end event only if not disconnected
            if not await request.is_disconnected():
                yield "event: end\n"
                yield f"data: {json.dumps({'status': 'completed'})}\n\n"
        except GeneratorExit:
            # Client disconnected - stop yielding
            return
        except Exception as e:
            # Send error event only if client is still connected
            if not await request.is_disconnected():
                error_msg = str(e)
                # Check if it's an authentication error
                if "401" in error_msg or "unauthorized" in error_msg.lower() or "authorization" in error_msg.lower():
                    error_msg = (
                        "Authentication failed. Please check your API key configuration. "
                        "Ensure that the LLM_API_KEY environment variable is set correctly in your settings.yaml file."
                    )
                error_data = json.dumps({"error": error_msg})
                yield f"event: error\n"
                yield f"data: {error_data}\n\n"


# Global service instance
chat_service = ChatService()
