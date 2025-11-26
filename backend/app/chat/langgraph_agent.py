"""LangGraph ReAct agent implementation."""

from typing import TypedDict, Annotated, Sequence, Optional, List, Any
import operator

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, ToolMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode

from app.chat.tools import AVAILABLE_TOOLS
from app.chat.llm_client import LLMClient


class AgentState(TypedDict):
    """State schema for the ReAct agent graph."""
    messages: Annotated[Sequence[BaseMessage], operator.add]


class LangGraphReActAgent:
    """ReAct agent implementation using LangGraph."""
    
    DEFAULT_SYSTEM_PROMPT = (
        "You are a helpful AI assistant with access to tools. "
        "When asked about the current time or weather, use the available tools to get accurate information. "
        "Always use tools when relevant to provide accurate and up-to-date information."
    )
    
    def __init__(self, llm_client: LLMClient):
        """Initialize the ReAct agent with a LangChain LLM.
        
        Args:
            llm_client: LLMClient instance containing the LangChain LLM.
        """
        self.llm_client = llm_client
        self.tools = AVAILABLE_TOOLS
        
        # Bind tools to the LLM
        self.llm_with_tools = llm_client.llm.bind_tools(self.tools)
        
        # Build the agent graph
        self.graph = self._build_graph()
    
    def _build_graph(self) -> Any:
        """Build the LangGraph state graph for the ReAct agent.
        
        Returns:
            Compiled StateGraph for the agent.
        """
        # Create the graph
        workflow = StateGraph(AgentState)
        
        # Add nodes
        workflow.add_node("agent", self._agent_node)
        workflow.add_node("tools", ToolNode(self.tools))
        
        # Set entry point
        workflow.set_entry_point("agent")
        
        # Add conditional edges
        workflow.add_conditional_edges(
            "agent",
            self._should_continue,
            {
                "continue": "tools",
                "end": END,
            }
        )
        
        # Add edge from tools back to agent
        workflow.add_edge("tools", "agent")
        
        # Compile the graph
        return workflow.compile()
    
    def _agent_node(self, state: AgentState) -> dict:
        """Agent node that calls the LLM with tools.
        
        Args:
            state: Current agent state.
            
        Returns:
            Updated state with new messages.
        """
        messages = state["messages"]
        response = self.llm_with_tools.invoke(messages)
        return {"messages": [response]}
    
    def _should_continue(self, state: AgentState) -> str:
        """Determine whether to continue tool execution or end.
        
        Args:
            state: Current agent state.
            
        Returns:
            "continue" if tools should be called, "end" otherwise.
        """
        messages = state["messages"]
        last_message = messages[-1]
        
        # If the last message has tool calls, continue to tools node
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "continue"
        
        # Otherwise, end the conversation
        return "end"
    
    def _prepare_messages(
        self,
        user_message: str,
        history_messages: Optional[List[BaseMessage]] = None,
        system_prompt: Optional[str] = None
    ) -> List[BaseMessage]:
        """Prepare messages for the agent, including history if provided.
        
        Args:
            user_message: The current user message.
            history_messages: Optional list of previous messages in the conversation.
            system_prompt: Optional system prompt to set agent behavior.
            
        Returns:
            List of messages ready for the agent.
        """
        messages: List[BaseMessage] = []
        
        # Add system prompt
        prompt = system_prompt or self.DEFAULT_SYSTEM_PROMPT
        messages.append(SystemMessage(content=prompt))
        
        # Add history messages (if any)
        if history_messages:
            # Filter out any system messages from history to avoid duplication
            for msg in history_messages:
                if not isinstance(msg, SystemMessage):
                    messages.append(msg)
        else:
            # If no history, just add the current user message
            messages.append(HumanMessage(content=user_message))
        
        return messages
    
    def invoke(self, user_message: str, system_prompt: Optional[str] = None) -> str:
        """Invoke the agent with a user message.
        
        Args:
            user_message: The user's input message.
            system_prompt: Optional system prompt to set agent behavior.
            
        Returns:
            The final response from the agent.
        """
        messages = self._prepare_messages(user_message, system_prompt=system_prompt)
        
        # Run the agent
        result = self.graph.invoke({"messages": messages})
        
        # Extract the final response
        final_messages = result["messages"]
        
        # Find the last AI message that is not a tool call
        for msg in reversed(final_messages):
            if isinstance(msg, AIMessage) and not (hasattr(msg, "tool_calls") and msg.tool_calls):
                content = msg.content
                return str(content) if content else ""
            elif isinstance(msg, AIMessage) and msg.content:
                # AI message with content (could be final response after tool use)
                content = msg.content
                return str(content) if content else ""
        
        return "I couldn't generate a response."
    
    async def astream(self, user_message: str, system_prompt: Optional[str] = None):
        """Asynchronously stream the agent response.
        
        This method streams events from the agent execution, yielding
        intermediate steps and the final response.
        
        Args:
            user_message: The user's input message.
            system_prompt: Optional system prompt to set agent behavior.
            
        Yields:
            Chunks of the response as they are generated.
        """
        messages = self._prepare_messages(user_message, system_prompt=system_prompt)
        
        # Stream the agent execution
        async for event in self.graph.astream_events(
            {"messages": messages},
            version="v2"
        ):
            kind = event["event"]
            
            if kind == "on_chat_model_stream":
                # Streaming tokens from the LLM
                content = event["data"]["chunk"].content
                if content:
                    yield {"type": "token", "content": content}
            
            elif kind == "on_tool_start":
                # Tool is starting
                tool_name = event.get("name", "unknown")
                tool_input = event["data"].get("input", {})
                yield {
                    "type": "tool_start",
                    "tool": tool_name,
                    "input": tool_input
                }
            
            elif kind == "on_tool_end":
                # Tool finished
                tool_name = event.get("name", "unknown")
                tool_output = event["data"].get("output", "")
                yield {
                    "type": "tool_end",
                    "tool": tool_name,
                    "output": str(tool_output)
                }
    
    async def astream_with_history(
        self,
        user_message: str,
        history_messages: Optional[List[BaseMessage]] = None,
        system_prompt: Optional[str] = None
    ):
        """Asynchronously stream the agent response with conversation history.
        
        This method streams events from the agent execution, yielding
        intermediate steps and the final response, while considering
        previous messages in the conversation.
        
        Args:
            user_message: The user's input message.
            history_messages: Optional list of previous messages in the conversation.
            system_prompt: Optional system prompt to set agent behavior.
            
        Yields:
            Chunks of the response as they are generated.
        """
        messages = self._prepare_messages(
            user_message,
            history_messages=history_messages,
            system_prompt=system_prompt
        )
        
        # Stream the agent execution
        async for event in self.graph.astream_events(
            {"messages": messages},
            version="v2"
        ):
            kind = event["event"]
            
            if kind == "on_chat_model_stream":
                # Streaming tokens from the LLM
                content = event["data"]["chunk"].content
                if content:
                    yield {"type": "token", "content": content}
            
            elif kind == "on_tool_start":
                # Tool is starting
                tool_name = event.get("name", "unknown")
                tool_input = event["data"].get("input", {})
                yield {
                    "type": "tool_start",
                    "tool": tool_name,
                    "input": tool_input
                }
            
            elif kind == "on_tool_end":
                # Tool finished
                tool_name = event.get("name", "unknown")
                tool_output = event["data"].get("output", "")
                yield {
                    "type": "tool_end",
                    "tool": tool_name,
                    "output": str(tool_output)
                }


def create_react_agent(llm_client: LLMClient) -> LangGraphReActAgent:
    """Factory function to create a ReAct agent.
    
    Args:
        llm_client: LLMClient instance to use for the agent.
        
    Returns:
        Configured LangGraphReActAgent instance.
    """
    return LangGraphReActAgent(llm_client)
