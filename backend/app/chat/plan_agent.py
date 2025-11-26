"""Plan-1 agent implementation with QUERY, MAIN, and TOOL nodes."""

from typing import TypedDict, Annotated, Sequence, Optional, List, Any, Dict
import operator
import json

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode

from app.chat.tools import AVAILABLE_TOOLS
from app.chat.llm_client import LLMClient


# Constants for special node names in LangGraph
START_NODE = "__start__"
END_NODE = "__end__"


class PlanStep(TypedDict):
    """A single step in the execution plan."""
    step_number: int
    description: str
    status: str  # "pending", "in_progress", "completed", "skipped"


class PlanAgentState(TypedDict):
    """State schema for the Plan-1 agent graph."""
    messages: Annotated[Sequence[BaseMessage], operator.add]
    plan: List[PlanStep]
    current_step: int
    plan_needed: bool


class LangGraphPlanAgent:
    """Plan-1 agent implementation using LangGraph.
    
    This agent has three main nodes:
    - QUERY: Analyzes user request and creates a plan (or skips if simple)
    - MAIN: Main reasoning node (ReAct pattern with TOOL)
    - TOOL: Executes tools
    
    The plan execution progress is visible to users via SSE events.
    """
    
    DEFAULT_SYSTEM_PROMPT = (
        "You are a helpful AI assistant with access to tools. "
        "When asked about the current time or weather, use the available tools to get accurate information. "
        "Always use tools when relevant to provide accurate and up-to-date information."
    )
    
    QUERY_SYSTEM_PROMPT = """You are a planning assistant. Analyze the user's request and decide if a step-by-step plan is needed.

If the request is simple (single action, simple question), respond with:
{"plan_needed": false, "reason": "Simple request - direct response"}

If the request is complex (multiple steps, requires tools, needs research), create a plan:
{"plan_needed": true, "steps": ["Step 1 description", "Step 2 description", ...]}

Respond ONLY with valid JSON, no other text."""

    def __init__(self, llm_client: LLMClient):
        """Initialize the Plan-1 agent with a LangChain LLM.
        
        Args:
            llm_client: LLMClient instance containing the LangChain LLM.
        """
        self.llm_client = llm_client
        self.tools = AVAILABLE_TOOLS
        
        # Bind tools to the LLM for MAIN node
        self.llm_with_tools = llm_client.llm.bind_tools(self.tools)
        
        # LLM without tools for QUERY node
        self.llm = llm_client.llm
        
        # Build the agent graph
        self.graph = self._build_graph()
    
    def _build_graph(self) -> Any:
        """Build the LangGraph state graph for the Plan-1 agent.
        
        Graph structure:
        START -> QUERY -> MAIN <-> TOOL -> END
        
        Returns:
            Compiled StateGraph for the agent.
        """
        # Create the graph
        workflow = StateGraph(PlanAgentState)
        
        # Add nodes (uppercase names as requested)
        workflow.add_node("QUERY", self._query_node)
        workflow.add_node("MAIN", self._main_node)
        workflow.add_node("TOOL", ToolNode(self.tools))
        
        # Set entry point
        workflow.set_entry_point("QUERY")
        
        # Add edge from QUERY to MAIN
        workflow.add_edge("QUERY", "MAIN")
        
        # Add conditional edges from MAIN
        workflow.add_conditional_edges(
            "MAIN",
            self._should_continue,
            {
                "continue": "TOOL",
                "end": END,
            }
        )
        
        # Add edge from TOOL back to MAIN
        workflow.add_edge("TOOL", "MAIN")
        
        # Compile the graph
        return workflow.compile()
    
    def get_graph_structure(self) -> Dict[str, Any]:
        """Extract the graph structure for visualization.
        
        Returns:
            Dictionary with nodes and edges information.
        """
        graph = self.graph.get_graph()
        
        nodes = []
        edges = []
        
        # Extract nodes from the graph
        for node_id in graph.nodes:
            node_type = "node"
            if node_id == START_NODE:
                node_type = "start"
            elif node_id == END_NODE:
                node_type = "end"
            
            # Create a display label
            label = node_id
            if node_id not in (START_NODE, END_NODE):
                label = node_id  # Keep uppercase
            
            nodes.append({
                "id": node_id,
                "type": node_type,
                "label": label
            })
        
        # Extract edges from the graph
        for edge in graph.edges:
            source = edge.source
            target = edge.target
            
            # Check if this is a conditional edge
            conditional = edge.conditional
            label = None
            
            # For conditional edges, try to get a meaningful label
            if conditional and edge.data:
                label = str(edge.data) if edge.data else None
            
            edges.append({
                "source": source,
                "target": target,
                "conditional": conditional,
                "label": label
            })
        
        return {
            "nodes": nodes,
            "edges": edges
        }
    
    def _query_node(self, state: PlanAgentState) -> dict:
        """QUERY node: Analyzes user request and creates a plan if needed.
        
        Args:
            state: Current agent state.
            
        Returns:
            Updated state with plan information.
        """
        messages = state["messages"]
        
        # Get the user's message (last human message)
        user_message = ""
        for msg in reversed(messages):
            if isinstance(msg, HumanMessage):
                user_message = msg.content
                break
        
        # Ask LLM if planning is needed
        query_messages = [
            SystemMessage(content=self.QUERY_SYSTEM_PROMPT),
            HumanMessage(content=f"User request: {user_message}")
        ]
        
        response = self.llm.invoke(query_messages)
        
        # Parse the response
        try:
            # Try to extract JSON from the response
            content = response.content
            if isinstance(content, str):
                # Find JSON in the response
                json_start = content.find('{')
                json_end = content.rfind('}') + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = content[json_start:json_end]
                    plan_data = json.loads(json_str)
                else:
                    plan_data = {"plan_needed": False}
            else:
                plan_data = {"plan_needed": False}
        except (json.JSONDecodeError, TypeError):
            plan_data = {"plan_needed": False}
        
        plan_needed = plan_data.get("plan_needed", False)
        
        if plan_needed and "steps" in plan_data:
            # Create plan steps
            plan = [
                PlanStep(
                    step_number=i + 1,
                    description=step,
                    status="pending"
                )
                for i, step in enumerate(plan_data["steps"])
            ]
            return {
                "plan": plan,
                "current_step": 0,
                "plan_needed": True,
                "messages": []
            }
        else:
            # No plan needed - simple request
            return {
                "plan": [],
                "current_step": 0,
                "plan_needed": False,
                "messages": []
            }
    
    def _main_node(self, state: PlanAgentState) -> dict:
        """MAIN node: Main reasoning node that processes the request.
        
        Args:
            state: Current agent state.
            
        Returns:
            Updated state with new messages.
        """
        messages = list(state["messages"])
        plan = state.get("plan", [])
        current_step = state.get("current_step", 0)
        plan_needed = state.get("plan_needed", False)
        
        # If we have a plan and there are remaining steps, add context
        if plan_needed and plan and current_step < len(plan):
            step = plan[current_step]
            step_context = f"\n\n[Current task - Step {step['step_number']}/{len(plan)}]: {step['description']}"
            
            # Find the last message and append context if it's from the system or user
            if messages:
                last_msg = messages[-1]
                if isinstance(last_msg, (SystemMessage, HumanMessage)):
                    # Create a new message list with modified context
                    modified_content = str(last_msg.content) + step_context
                    if isinstance(last_msg, SystemMessage):
                        messages[-1] = SystemMessage(content=modified_content)
                    else:
                        messages[-1] = HumanMessage(content=modified_content)
        
        # Call the LLM with tools
        response = self.llm_with_tools.invoke(messages)
        
        # Update plan step status if completing
        new_plan = plan.copy() if plan else []
        new_step = current_step
        
        if plan_needed and plan and current_step < len(plan):
            # Check if this step is complete (no more tool calls)
            if not (hasattr(response, "tool_calls") and response.tool_calls):
                # Mark current step as completed
                if new_plan and current_step < len(new_plan):
                    new_plan[current_step] = PlanStep(
                        step_number=new_plan[current_step]["step_number"],
                        description=new_plan[current_step]["description"],
                        status="completed"
                    )
                new_step = current_step + 1
        
        return {
            "messages": [response],
            "plan": new_plan,
            "current_step": new_step
        }
    
    def _should_continue(self, state: PlanAgentState) -> str:
        """Determine whether to continue tool execution or end.
        
        Args:
            state: Current agent state.
            
        Returns:
            "continue" if tools should be called, "end" otherwise.
        """
        messages = state["messages"]
        last_message = messages[-1]
        
        # If the last message has tool calls, continue to TOOL node
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
            Chunks of the response as they are generated, including node transition events.
        """
        messages = self._prepare_messages(
            user_message,
            history_messages=history_messages,
            system_prompt=system_prompt
        )
        
        # Initial state
        initial_state = {
            "messages": messages,
            "plan": [],
            "current_step": 0,
            "plan_needed": False
        }
        
        # Track current node to avoid duplicate events
        current_node: Optional[str] = None
        last_plan: List[PlanStep] = []
        in_query_node = False  # Flag to suppress QUERY node token streaming
        
        # Stream the agent execution
        async for event in self.graph.astream_events(
            initial_state,
            version="v2"
        ):
            kind = event["event"]
            
            # Handle node transitions (on_chain_start for graph nodes)
            if kind == "on_chain_start":
                # Extract node name from the event
                node_name = event.get("name", "")
                # Check for our node names (uppercase)
                if node_name in ("QUERY", "MAIN", "TOOL") and node_name != current_node:
                    current_node = node_name
                    # Set flag for QUERY node to suppress token streaming
                    in_query_node = (node_name == "QUERY")
                    yield {
                        "type": "node_start",
                        "node": node_name
                    }
            
            elif kind == "on_chain_end":
                # Node finished execution
                node_name = event.get("name", "")
                if node_name in ("QUERY", "MAIN", "TOOL") and node_name == current_node:
                    yield {
                        "type": "node_end",
                        "node": node_name
                    }
                    
                    # Clear QUERY flag when QUERY node ends
                    if node_name == "QUERY":
                        in_query_node = False
                        # Try to get plan from output
                        output = event.get("data", {}).get("output", {})
                        if isinstance(output, dict):
                            plan = output.get("plan", [])
                            plan_needed = output.get("plan_needed", False)
                            if plan_needed and plan:
                                last_plan = plan
                                yield {
                                    "type": "plan_created",
                                    "plan": plan
                                }
                    
                    # After MAIN node, check for plan step completion
                    if node_name == "MAIN" and last_plan:
                        output = event.get("data", {}).get("output", {})
                        if isinstance(output, dict):
                            new_plan = output.get("plan", [])
                            new_step = output.get("current_step", 0)
                            
                            # Check if a step was completed
                            for i, step in enumerate(new_plan):
                                if i < len(last_plan):
                                    if step.get("status") == "completed" and last_plan[i].get("status") != "completed":
                                        yield {
                                            "type": "plan_step_completed",
                                            "step_number": step.get("step_number"),
                                            "description": step.get("description")
                                        }
                            last_plan = new_plan
            
            elif kind == "on_chat_model_stream":
                # Streaming tokens from the LLM
                # Skip streaming during QUERY node (planning phase)
                if in_query_node:
                    continue
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


def create_plan_agent(llm_client: LLMClient) -> LangGraphPlanAgent:
    """Factory function to create a Plan-1 agent.
    
    Args:
        llm_client: LLMClient instance to use for the agent.
        
    Returns:
        Configured LangGraphPlanAgent instance.
    """
    return LangGraphPlanAgent(llm_client)

