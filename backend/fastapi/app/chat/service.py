"""Chat service layer for business logic."""

import uuid
from typing import Literal, Optional
from fastapi import Request, HTTPException
import json
from app.chat.llm_client import llm_list, LLMClient
from app.chat.langgraph_agent import create_react_agent
from app.chat.plan_agent import create_plan_agent
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
        agent_type: Literal["basic", "langgraph", "plan-1"] = "basic",
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
        elif agent_type == "plan-1":
            async for chunk in self._stream_plan_response(client, user_message, request, actual_session_id):
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
        tools_used = []
        
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
                        yield "event: token\n"
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
                    tools_used.append(tool_name)
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
            
            # Generate suggestions based on the response content
            if not await request.is_disconnected() and accumulated_response:
                # Get recent conversation history for context
                recent_messages = self.session_store.get_dict_messages(session_id)
                # Get last 4 messages (2 user + 2 assistant) for context
                context_messages = recent_messages[-4:] if len(recent_messages) > 4 else recent_messages
                suggestions = await self._generate_suggestions(
                    client, user_message, accumulated_response, tools_used, context_messages
                )
                yield "event: suggestions\n"
                yield f"data: {json.dumps({'suggestions': suggestions})}\n\n"
            
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
    
    async def _generate_suggestions(
        self, 
        client: LLMClient, 
        user_message: str, 
        response: str, 
        tools_used: list,
        context_messages: list = None
    ) -> list:
        """Generate intelligent suggestions based on conversation context using LLM.
        
        Args:
            client: LLMClient instance for generating suggestions.
            user_message: Original user message.
            response: Assistant's response.
            tools_used: List of tools that were used.
            context_messages: Recent conversation history for context.
            
        Returns:
            List of suggestion strings (max 3).
        """
        try:
            # Build context from recent messages
            context_text = ""
            if context_messages:
                context_parts = []
                for msg in context_messages:
                    role = "사용자" if msg.get("role") == "user" else "어시스턴트"
                    content = msg.get("content", "")
                    if content:
                        context_parts.append(f"{role}: {content}")
                if context_parts:
                    context_text = "\n".join(context_parts[-4:])  # Last 4 messages
            
            # Build prompt for suggestion generation
            tools_info = ""
            if tools_used:
                tools_info = f"사용된 도구: {', '.join(tools_used)}\n"
            
            prompt = f"""다음 대화를 분석하여 사용자가 직접 입력할 수 있는 구체적이고 창의적인 다음 질문/요청 3개를 생성해주세요.

대화 맥락:
{context_text}

사용자 질문: {user_message}
어시스턴트 답변: {response}
{tools_info}

중요 규칙:
1. 사용자가 직접 입력할 수 있는 구체적인 질문이나 요청이어야 합니다.
2. 에이전트가 사용자에게 물어보는 형식("무엇을 도와드릴까요?", "어떤 정보 필요하세요?" 등)은 절대 사용하지 마세요.
3. 각 질문/요청은 최대 20자 이내로 간결하게 작성하세요.
4. 답변의 내용을 확장하거나 심화할 수 있는 창의적인 질문을 우선적으로 생성하세요.
5. 사용된 도구가 있다면 관련된 구체적인 추가 질문을 포함하세요.
6. 각 질문은 사용자가 실제로 입력할 수 있는 자연스러운 형식이어야 합니다.
7. 정확히 3개의 질문만 생성하세요.
8. 한국어로 작성하세요.

좋은 예시 (사용자 입장):
- "파이썬으로 웹 크롤러 만들기"
- "더 자세한 예제 보여줘"
- "다른 방법도 알려줘"
- "코드 실행 결과 확인"
- "관련 개념 설명해줘"

나쁜 예시 (에이전트 입장 - 절대 사용 금지):
- "무엇을 도와드릴까요?"
- "어떤 정보 필요하세요?"
- "혹시 궁금한 점 있으세요?"

응답 형식 (각 줄에 하나씩, 번호나 기호 없이):
질문1
질문2
질문3

추천 질문:"""

            # Generate suggestions using LLM
            from langchain_core.messages import HumanMessage
            messages = [HumanMessage(content=prompt)]
            llm_response = client.llm.invoke(messages)
            suggestions_text = llm_response.content.strip()
            
            # Parse suggestions from LLM response
            suggestions = []
            for line in suggestions_text.split('\n'):
                line = line.strip()
                # Remove numbering if present (e.g., "1. ", "1)", "- ")
                for prefix in ['1.', '2.', '3.', '1)', '2)', '3)', '- ', '• ', '* ']:
                    if line.startswith(prefix):
                        line = line[len(prefix):].strip()
                        break
                # Filter out empty lines and ensure length is reasonable (5-30 characters)
                if line and 5 <= len(line) <= 30:
                    # Truncate if too long (shouldn't happen with good prompt, but safety check)
                    if len(line) > 30:
                        line = line[:27] + "..."
                    suggestions.append(line)
            
            # Return max 3 suggestions
            return suggestions[:3] if suggestions else self._get_fallback_suggestions(user_message, response, tools_used)
            
        except Exception as e:
            # Fallback to rule-based suggestions if LLM fails
            print(f"[WARNING] Failed to generate LLM suggestions: {e}")
            return self._get_fallback_suggestions(user_message, response, tools_used)
    
    def _get_fallback_suggestions(self, user_message: str, response: str, tools_used: list) -> list:
        """Fallback rule-based suggestions if LLM generation fails.
        
        Args:
            user_message: Original user message.
            response: Assistant's response.
            tools_used: List of tools that were used.
            
        Returns:
            List of suggestion strings.
        """
        suggestions = []
        
        # Analyze response length
        if len(response) < 100:
            suggestions.append("더 자세히 설명해줘")
        elif len(response) > 500:
            suggestions.append("요약해줘")
        
        # Analyze tools used
        if tools_used:
            if "get_current_time" in tools_used:
                suggestions.append("다른 시간대 확인")
            if "get_weather" in tools_used:
                suggestions.append("다른 지역 날씨 알려줘")
        
        # Analyze response content
        response_lower = response.lower()
        if "코드" in response or "code" in response_lower or "프로그램" in response:
            suggestions.append("실행 예제 보여줘")
        if "설명" in response or "explain" in response_lower:
            suggestions.append("다른 방식으로 설명해줘")
        if "방법" in response or "how" in response_lower:
            suggestions.append("단계별로 자세히 알려줘")
        
        # Default suggestions if not enough (사용자 입장의 구체적인 질문)
        default_suggestions = [
            "관련 예제 보여줘",
            "다른 방법 알려줘",
            "더 자세히 설명해줘",
        ]
        
        # Add default suggestions if we don't have enough
        for default_suggestion in default_suggestions:
            if default_suggestion not in suggestions and len(suggestions) < 3:
                suggestions.append(default_suggestion)
        
        return suggestions[:3]  # Return max 3 suggestions
    
    async def _stream_plan_response(
        self,
        client: LLMClient,
        user_message: str,
        request: Request,
        session_id: str
    ):
        """Stream Plan-1 agent response with planning and execution tracking.
        
        Args:
            client: LLMClient instance.
            user_message: User's message content.
            request: FastAPI Request object for disconnect detection.
            session_id: Session ID for conversation history.
            
        Yields:
            SSE formatted strings for streaming response.
        """
        accumulated_response = ""
        tools_used = []
        plan_created = False
        
        try:
            # Send start event with session_id
            yield "event: start\n"
            yield f"data: {json.dumps({'status': 'started', 'session_id': session_id})}\n\n"
            
            # Get conversation history from session
            history_messages = self.session_store.get_langchain_messages(session_id)
            
            # Create Plan-1 agent
            agent = create_plan_agent(client)
            
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
                        yield "event: token\n"
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
                    
                
                elif event_type == "plan_created":
                    # Send plan created event
                    plan = event.get("plan", [])
                    plan_created = True
                    
                    yield "event: plan_created\n"
                    yield f"data: {json.dumps({'plan': plan})}\n\n"
                
                elif event_type == "plan_updated":
                    # Send plan updated event with full plan state
                    plan = event.get("plan", [])
                    current_step = event.get("current_step", 0)
                    yield "event: plan_updated\n"
                    yield f"data: {json.dumps({'plan': plan, 'current_step': current_step})}\n\n"
                
                elif event_type == "plan_step_completed":
                    # Send plan step completed event
                    step_number = event.get("step_number", 0)
                    description = event.get("description", "")
                    plan = event.get("plan", [])
                    current_step = event.get("current_step", 0)
                    yield "event: plan_step_completed\n"
                    yield f"data: {json.dumps({'step_number': step_number, 'description': description, 'plan': plan, 'current_step': current_step})}\n\n"
                
                elif event_type == "tool_start":
                    # Send tool start event
                    tool_name = event.get("tool", "unknown")
                    tool_input = event.get("input", {})
                    tools_used.append(tool_name)
                    
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
            
            # Generate suggestions based on the response content
            if not await request.is_disconnected() and accumulated_response:
                # Get recent conversation history for context
                recent_messages = self.session_store.get_dict_messages(session_id)
                # Get last 4 messages (2 user + 2 assistant) for context
                context_messages = recent_messages[-4:] if len(recent_messages) > 4 else recent_messages
                suggestions = await self._generate_suggestions(
                    client, user_message, accumulated_response, tools_used, context_messages
                )
                yield "event: suggestions\n"
                yield f"data: {json.dumps({'suggestions': suggestions})}\n\n"
            
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
