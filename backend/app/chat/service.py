"""Chat service layer for business logic."""

import uuid
from typing import Literal, Optional
from fastapi import Request, HTTPException
import json
from app.chat.llm_client import llm_list, LLMClient
from app.chat.langgraph_agent import create_react_agent
from app.chat.memory_store import session_store


class ChatService:
    """Service class for chat-related business logic."""
    
    def __init__(self):
        """Initialize ChatService with LLM List."""
        self.llm_list = llm_list
        self.session_store = session_store
    
    def _get_client(
        self,
        model: str,
        provider: Optional[str] = None
    ) -> Optional[LLMClient]:
        """Get LLM client from the pool.
        
        Args:
            model: Model name or profile name to use.
            provider: Optional provider name.
            
        Returns:
            LLMClient instance if found, None otherwise.
        """
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
        
        return client
    
    def _get_or_create_session_id(self, session_id: Optional[str]) -> str:
        """Get existing session ID or create a new one.
        
        Args:
            session_id: Optional session ID from request.
            
        Returns:
            Valid session ID (existing or newly created).
        """
        if session_id:
            return session_id
        return str(uuid.uuid4())
    
    async def stream_chat_response(
        self,
        user_message: str,
        model: str,
        request: Request,
        provider: str = None,
        agent_type: Literal["basic", "langgraph"] = "basic",
        session_id: Optional[str] = None
    ):
        """Stream chat response in SSE format with client disconnect detection.
        
        Args:
            user_message: User's message content.
            model: Model name or profile name to use for the completion.
            request: FastAPI Request object for disconnect detection.
            provider: Optional provider name ('openai' or 'azureopenai'). 
                     If None, searches by model name only.
            agent_type: Type of agent to use ('basic' or 'langgraph').
            session_id: Optional session ID for multi-turn conversation.
            
        Yields:
            SSE formatted strings for streaming response.
            
        Raises:
            HTTPException: If the specified provider/model is not found.
        """
        # Get the LLM client
        client = self._get_client(model, provider)
        
        if not client:
            error_msg = f"Model '{model}' not found"
            if provider:
                error_msg += f" for provider '{provider}'"
            error_msg += ". Please check your LLM configuration in settings.yaml and ensure all required environment variables are set."
            yield "event: error\n"
            yield f"data: {json.dumps({'error': error_msg})}\n\n"
            return
        
        # Get or create session ID
        actual_session_id = self._get_or_create_session_id(session_id)
        
        # Add user message to session history
        self.session_store.add_message(actual_session_id, 'user', user_message)
        
        # Route to appropriate agent handler
        if agent_type == "langgraph":
            async for chunk in self._stream_langgraph_response(client, user_message, request, actual_session_id):
                yield chunk
        else:
            async for chunk in self._stream_basic_response(client, user_message, request, actual_session_id):
                yield chunk
    
    async def _stream_basic_response(
        self,
        client: LLMClient,
        user_message: str,
        request: Request,
        session_id: str
    ):
        """Stream basic LLM response (direct chat) with multi-turn support.
        
        Args:
            client: LLMClient instance.
            user_message: User's message content.
            request: FastAPI Request object for disconnect detection.
            session_id: Session ID for conversation history.
            
        Yields:
            SSE formatted strings for streaming response.
        """
        accumulated_response = ""
        
        try:
            # Send start event with session_id
            yield "event: start\n"
            yield f"data: {json.dumps({'status': 'started', 'session_id': session_id})}\n\n"
            
            # Get conversation history from session (excluding the user message we just added)
            session = self.session_store.get_session(session_id)
            history_messages = session.get_dict_messages() if session else []
            
            # Create streaming completion using LangChain with full history
            stream = client.stream(messages=history_messages)
            
            for chunk in stream:
                # Check if client disconnected
                if await request.is_disconnected():
                    break
                
                # LangChain returns chunks with content attribute
                if hasattr(chunk, 'content') and chunk.content:
                    accumulated_response += chunk.content
                    # Send data in SSE format: data: {content}\n\n
                    # JSON-encode the content to handle special characters
                    content_json = json.dumps(chunk.content)
                    yield f"data: {content_json}\n\n"
            
            # Save assistant response to session history
            if accumulated_response:
                self.session_store.add_message(session_id, 'assistant', accumulated_response)
            
            # Send end event only if not disconnected
            if not await request.is_disconnected():
                yield "event: end\n"
                yield f"data: {json.dumps({'status': 'completed', 'session_id': session_id})}\n\n"
        except GeneratorExit:
            # Client disconnected - save partial response if any
            if accumulated_response:
                self.session_store.add_message(session_id, 'assistant', accumulated_response)
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
    
    async def _stream_langgraph_response(
        self,
        client: LLMClient,
        user_message: str,
        request: Request,
        session_id: str
    ):
        """Stream LangGraph ReAct agent response with multi-turn support.
        
        Args:
            client: LLMClient instance.
            user_message: User's message content.
            request: FastAPI Request object for disconnect detection.
            session_id: Session ID for conversation history.
            
        Yields:
            SSE formatted strings for streaming response.
        """
        accumulated_response = ""
        
        try:
            # Send start event with session_id
            yield "event: start\n"
            yield f"data: {json.dumps({'status': 'started', 'session_id': session_id})}\n\n"
            
            # Get conversation history from session
            history_messages = self.session_store.get_langchain_messages(session_id)
            
            # Create ReAct agent
            agent = create_react_agent(client)
            
            # Stream the agent response with history
            async for event in agent.astream_with_history(user_message, history_messages):
                # Check if client disconnected
                if await request.is_disconnected():
                    break
                
                event_type = event.get("type")
                
                if event_type == "token":
                    # Stream token content
                    content = event.get("content", "")
                    if content:
                        accumulated_response += content
                        content_json = json.dumps(content)
                        yield f"data: {content_json}\n\n"
                
                elif event_type == "node_start":
                    # Send node start event for graph visualization
                    node_name = event.get("node", "unknown")
                    yield "event: node_start\n"
                    yield f"data: {json.dumps({'node': node_name})}\n\n"
                
                elif event_type == "node_end":
                    # Send node end event for graph visualization
                    node_name = event.get("node", "unknown")
                    yield "event: node_end\n"
                    yield f"data: {json.dumps({'node': node_name})}\n\n"
                
                elif event_type == "tool_start":
                    # Send tool start event
                    tool_name = event.get("tool", "unknown")
                    tool_input = event.get("input", {})
                    yield "event: tool_start\n"
                    yield f"data: {json.dumps({'tool': tool_name, 'input': tool_input})}\n\n"
                
                elif event_type == "tool_end":
                    # Send tool end event
                    tool_name = event.get("tool", "unknown")
                    tool_output = event.get("output", "")
                    yield "event: tool_end\n"
                    yield f"data: {json.dumps({'tool': tool_name, 'output': tool_output})}\n\n"
            
            # Save assistant response to session history
            if accumulated_response:
                self.session_store.add_message(session_id, 'assistant', accumulated_response)
            
            # Send end event only if not disconnected
            if not await request.is_disconnected():
                yield "event: end\n"
                yield f"data: {json.dumps({'status': 'completed', 'session_id': session_id})}\n\n"
        
        except GeneratorExit:
            # Client disconnected - save partial response if any
            if accumulated_response:
                self.session_store.add_message(session_id, 'assistant', accumulated_response)
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
