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
    step_results: Dict[int, str]  # Store results of each completed step: {step_number: result}


class LangGraphPlanAgent:
    """Plan-1 agent implementation using LangGraph.
    
    This agent has three main nodes:
    - QUERY (Inference Planning): Analyzes user request and creates an inference plan
      that breaks down the reasoning process into logical steps
    - MAIN: Main reasoning node (ReAct pattern with TOOL)
    - TOOL: Executes tools
    
    The plan execution progress is visible to users via SSE events.
    """
    
    DEFAULT_SYSTEM_PROMPT = (
        "You are a helpful AI assistant with access to tools. "
        "When asked about the current time or weather, use the available tools to get accurate information. "
        "Always use tools when relevant to provide accurate and up-to-date information."
    )
    
    VERIFICATION_PROMPT = """You are a verification assistant. Your role is to evaluate whether a step in an execution plan has been completed successfully.

Evaluate the following:
1. Was the step's goal achieved?
2. Is the result correct and complete?
3. Can we proceed to the next step?

Respond in JSON format:
{
    "verified": true/false,
    "reason": "brief explanation",
    "next_action": "continue" | "retry" | "modify"
}

If verified is true, next_action should be "continue".
If verified is false, next_action should be "retry" or "modify" based on whether the step needs to be redone or the plan needs adjustment."""
    
    QUERY_SYSTEM_PROMPT = """You are an inference planning assistant. Your role is to analyze the user's request and ALWAYS create a detailed inference plan that breaks down the reasoning process into logical steps.

CRITICAL REQUIREMENT: You MUST ALWAYS create a plan. There are NO exceptions. Even for simple requests, you must break them down into at least 2-3 sequential steps.

Planning Principles:
- ALWAYS create a plan - this is mandatory, not optional
- Plans should be sequential, clear, and concise
- Each step should be simple and focused on a single objective
- Steps should follow a logical order that builds upon previous steps
- Avoid overly complex or vague step descriptions
- Even simple requests should have at least 2-3 steps

Inference Planning Process:
1. Analyze the user's request to understand the intent and requirements
2. Identify what information or reasoning steps are needed
3. Determine if tools are required and which ones
4. Create a structured, sequential plan that guides the reasoning process

REQUIRED RESPONSE FORMAT:
You MUST ALWAYS respond with this format (plan_needed is ALWAYS true):
{"plan_needed": true, "inference_plan": "Brief description of the inference approach", "steps": ["Step 1: Clear and concise reasoning/action description", "Step 2: Clear and concise reasoning/action description", ...]}

For simple requests, create a minimal plan with 2-3 steps:
- Step 1: Understand the request
- Step 2: Execute the action or provide the answer
- Step 3: Verify or summarize (if needed)

For complex requests, create a detailed plan with multiple steps covering all aspects of the task.

Plan Quality Guidelines:
- Each step should be sequential and build upon the previous one
- Steps should be simple and clear, avoiding unnecessary complexity
- Use concise language that clearly describes what needs to be done
- Ensure steps are actionable and specific
- The plan should guide the reasoning process logically from start to finish
- Minimum 2 steps, typically 3-10 steps depending on complexity

The inference plan should describe the logical reasoning process, not just actions. Each step should represent a reasoning milestone or inference step.

REMEMBER: You MUST ALWAYS return plan_needed: true and provide steps. Never return plan_needed: false.

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
        # For plan-based execution, we need to check:
        # 1. If tool calls exist -> TOOL
        # 2. If current step is complete and more steps remain -> MAIN (next step)
        # 3. Otherwise -> END
        workflow.add_conditional_edges(
            "MAIN",
            self._should_continue,
            {
                "continue": "TOOL",  # Continue to TOOL if tool calls exist
                "next_step": "MAIN",  # Continue to MAIN for next step if plan has more steps
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
            
            # Determine connection handles based on Plan-1 pattern
            source_handle = None
            target_handle = None
            
            source_upper = source.upper()
            target_upper = target.upper()
            
            # Start -> QUERY: Start right -> QUERY left
            if source == START_NODE:
                source_handle = "right-source"
                target_handle = "left-target"
            # QUERY -> MAIN: QUERY right -> MAIN left
            elif source_upper == "QUERY" and target_upper == "MAIN":
                source_handle = "right-source"
                target_handle = "left-target"
            # MAIN -> TOOL: MAIN bottom -> TOOL top (ReAct: Agent calls tool)
            elif source_upper == "MAIN" and target_upper == "TOOL":
                source_handle = "bottom-source"
                target_handle = "top-target"
            # TOOL -> MAIN: TOOL top -> MAIN bottom (ReAct: Tool returns result)
            elif source_upper == "TOOL" and target_upper == "MAIN":
                source_handle = "top-source"
                target_handle = "bottom-target"
            # MAIN -> End: MAIN right -> End left
            elif source_upper == "MAIN" and target == END_NODE:
                source_handle = "right-source"
                target_handle = "left-target"
            
            edges.append({
                "source": source,
                "target": target,
                "conditional": conditional,
                "label": label,
                "sourceHandle": source_handle,
                "targetHandle": target_handle
            })
        
        return {
            "nodes": nodes,
            "edges": edges
        }
    
    def _query_node(self, state: PlanAgentState) -> dict:
        """QUERY node: Inference Planning - Analyzes user request and creates an inference plan.
        
        This node performs inference planning by:
        1. Analyzing the user's request to understand intent and requirements
        2. Identifying necessary reasoning steps and information needs
        3. Determining tool requirements
        4. Creating a structured inference plan that guides the reasoning process
        
        Args:
            state: Current agent state.
            
        Returns:
            Updated state with inference plan information.
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
        plan_data = {}
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
        except (json.JSONDecodeError, TypeError):
            # If parsing fails, create a default plan
            pass
        
        # FORCE plan creation - always create a plan regardless of LLM response
        plan_needed = True  # Always true - mandatory
        
        # Extract steps from response, or create default plan
        if "steps" in plan_data and isinstance(plan_data["steps"], list) and len(plan_data["steps"]) > 0:
            # Use steps from LLM response
            plan = [
                PlanStep(
                    step_number=i + 1,
                    description=step,
                    status="pending"
                )
                for i, step in enumerate(plan_data["steps"])
            ]
        else:
            # Create a default plan if LLM didn't provide steps or parsing failed
            # Get the user's message for context
            user_message = ""
            for msg in reversed(messages):
                if isinstance(msg, HumanMessage):
                    user_message = str(msg.content)
                    break
            
            # Create a minimal 3-step plan
            plan = [
                PlanStep(
                    step_number=1,
                    description=f"Analyze and understand the user's request: {user_message[:100]}",
                    status="pending"
                ),
                PlanStep(
                    step_number=2,
                    description="Execute the main task or provide the answer",
                    status="pending"
                ),
                PlanStep(
                    step_number=3,
                    description="Verify and summarize the result",
                    status="pending"
                )
            ]
        
        return {
            "plan": plan,
            "current_step": 0,
            "plan_needed": True,  # Always true
            "messages": [],
            "step_results": {}
        }
    
    def _main_node(self, state: PlanAgentState) -> dict:
        """MAIN node: Main reasoning node that processes the request.
        
        Implements Cursor.ai style: Execute -> Verify -> Next Step
        
        Args:
            state: Current agent state.
            
        Returns:
            Updated state with new messages.
        """
        messages = list(state["messages"])
        plan = state.get("plan", [])
        current_step = state.get("current_step", 0)
        plan_needed = state.get("plan_needed", False)
        step_results = state.get("step_results", {})
        
        new_plan = plan.copy() if plan else []
        new_step = current_step
        new_step_results = step_results.copy() if step_results else {}
        
        # If we have a plan and there are remaining steps
        if plan_needed and plan and current_step < len(plan):
            step = plan[current_step]
            step_status = step.get("status", "pending")
            
            # Check if current step is already completed - move to next step
            if step_status == "completed":
                # Move to next step
                new_step = current_step + 1
                if new_step < len(new_plan):
                    # Update to next step
                    current_step = new_step
                    step = plan[current_step]
                    step_status = step.get("status", "pending")
                else:
                    # All steps completed
                    # Still process the response but don't update plan
                    pass
            
            # Step 1: Mark current step as in_progress (if not already completed)
            if new_plan and current_step < len(new_plan) and step_status != "completed":
                new_plan[current_step] = PlanStep(
                    step_number=new_plan[current_step]["step_number"],
                    description=new_plan[current_step]["description"],
                    status="in_progress"
                )
            
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
        
        # Step 2: Execute - Call the LLM with tools
        # For plan-based execution, focus only on the current step
        if plan_needed and plan and current_step < len(plan):
            # Add instruction to focus on current step only
            step = plan[current_step]
            
            # Build context from previous completed steps with their results
            previous_steps_context = ""
            if current_step > 0:
                completed_steps = []
                for i in range(current_step):
                    if i < len(plan):
                        step_num = plan[i]['step_number']
                        step_desc = plan[i]['description']
                        step_status = plan[i].get("status", "pending")
                        
                        if step_status == "completed":
                            # Include the result from previous step
                            step_result = new_step_results.get(step_num, "Completed")
                            completed_steps.append(f"Step {step_num}: {step_desc}\nResult: {step_result}")
                        elif step_status == "in_progress":
                            completed_steps.append(f"Step {step_num}: {step_desc} - In Progress")
                
                if completed_steps:
                    previous_steps_context = "\n\n=== Previous Steps and Their Results ===\n" + "\n\n".join(completed_steps) + "\n\n"
            
            step_focus = f"\n\nIMPORTANT: You are currently working on Step {step['step_number']} of {len(plan)}.\n\nTask: {step['description']}\n\nFocus ONLY on completing this step. Do not attempt to complete all steps at once. Use the results from previous steps to inform your work on this step.{previous_steps_context}"
            if messages:
                last_msg = messages[-1]
                if isinstance(last_msg, (SystemMessage, HumanMessage)):
                    modified_content = str(last_msg.content) + step_focus
                    if isinstance(last_msg, SystemMessage):
                        messages[-1] = SystemMessage(content=modified_content)
                    else:
                        messages[-1] = HumanMessage(content=modified_content)
        
        response = self.llm_with_tools.invoke(messages)
        
        # Step 3: Verify and mark complete if step is done (no more tool calls)
        if plan_needed and plan and current_step < len(plan):
            # Check if we need to continue with tools first
            has_tool_calls = hasattr(response, "tool_calls") and response.tool_calls
            
            if not has_tool_calls:
                # Step execution is complete (no more tools needed)
                # Automatically mark as completed and move to next step
                step = plan[current_step]
                step_number = step['step_number']
                current_step_status = step.get("status", "pending")
                
                # Mark step as completed if it's in_progress
                if current_step_status == "in_progress":
                    # Get the raw result first
                    raw_result = response.content if hasattr(response, 'content') else str(response)
                    
                    # Format step result with clear header and separator
                    STEP_SEPARATOR = "\n\n" + "─" * 80 + "\n\n"
                    formatted_step_result = f"\n\n{'='*80}\n## 📌 Step {step_number}: {step['description']}\n{'='*80}\n\n{raw_result}\n\n✅ **Step {step_number} 완료**"
                    
                    # Store formatted result
                    new_step_results[step_number] = formatted_step_result
                    
                    # Mark current step as completed
                    if new_plan and current_step < len(new_plan):
                        new_plan[current_step] = PlanStep(
                            step_number=new_plan[current_step]["step_number"],
                            description=new_plan[current_step]["description"],
                            status="completed"
                        )
                    
                    # Build cumulative content with all completed steps in order
                    cumulative_content = ""
                    
                    # Add all completed steps in order (now including the current step which is marked as completed)
                    is_first_step = True
                    for s in new_plan:
                        s_num = s['step_number']
                        s_status = s.get("status", "pending")
                        
                        if s_status == "completed" and s_num in new_step_results:
                            # Add separator between steps (not before first step)
                            if not is_first_step:
                                cumulative_content += STEP_SEPARATOR
                            is_first_step = False
                            
                            cumulative_content += new_step_results[s_num]
                    
                    # Create a message with cumulative step results
                    step_message = AIMessage(content=cumulative_content.strip())
                    
                    # Move to next step automatically
                    new_step = current_step + 1
                    if new_step < len(new_plan):
                        # Mark next step as in_progress for immediate execution
                        new_plan[new_step] = PlanStep(
                            step_number=new_plan[new_step]["step_number"],
                            description=new_plan[new_step]["description"],
                            status="in_progress"
                        )
                    else:
                        # All steps completed - generate final summary with all step results
                        # Build final content with all steps sequentially
                        final_content = ""
                        
                        # Separator for clear step distinction
                        STEP_SEPARATOR = "\n\n" + "─" * 80 + "\n\n"
                        
                        # Add all completed steps in order
                        is_first_step = True
                        for s in new_plan:
                            s_num = s['step_number']
                            if s_num in new_step_results:
                                # Add separator between steps (not before first step)
                                if not is_first_step:
                                    final_content += STEP_SEPARATOR
                                is_first_step = False
                                
                                # Step results already include header and completion marker
                                final_content += new_step_results[s_num]
                        
                        # Add final separator before summary
                        final_content += "\n\n" + "=" * 80 + "\n\n"
                        
                        # Generate final summary
                        summary_prompt = f"""All steps of the plan have been completed. Please provide a comprehensive summary of the entire process and results.

Plan Steps:
{chr(10).join([f"Step {s['step_number']}: {s['description']}" for s in new_plan])}

Step Results:
{chr(10).join([f"Step {num}: {result[:300]}..." if len(result) > 300 else f"Step {num}: {result}" for num, result in sorted(new_step_results.items())])}

Please provide a clear, concise summary that:
1. Summarizes what was accomplished
2. Highlights key findings or results
3. Provides any important conclusions or next steps"""
                        
                        summary_messages = [
                            SystemMessage(content="You are a helpful assistant that provides clear summaries."),
                            HumanMessage(content=summary_prompt)
                        ]
                        
                        try:
                            summary_response = self.llm.invoke(summary_messages)
                            summary_content = summary_response.content if hasattr(summary_response, 'content') else str(summary_response)
                            final_content += f"## 🎯 최종 요약\n\n{summary_content}"
                        except Exception:
                            # If summary generation fails, just add a simple summary header
                            final_content += "## 🎯 최종 요약\n\n모든 단계가 성공적으로 완료되었습니다."
                        
                        final_content += f"\n\n✨ **모든 {len(new_plan)}개 단계가 성공적으로 완료되었습니다!**"
                        
                        # Return final message with all steps and summary
                        final_message = AIMessage(content=final_content.strip())
                        return {
                            "messages": [final_message],
                            "plan": new_plan,
                            "current_step": new_step,
                            "step_results": new_step_results
                        }
                    
                    # Return step message for sequential display (not final step yet)
                    return {
                        "messages": [step_message],
                        "plan": new_plan,
                        "current_step": new_step,
                        "step_results": new_step_results
                    }
                elif current_step_status == "completed":
                    # Step already completed, just move to next
                    new_step = current_step + 1
                    if new_step < len(new_plan):
                        # Mark next step as in_progress if not already
                        next_step_status = new_plan[new_step].get("status", "pending")
                        if next_step_status != "in_progress" and next_step_status != "completed":
                            new_plan[new_step] = PlanStep(
                                step_number=new_plan[new_step]["step_number"],
                                description=new_plan[new_step]["description"],
                                status="in_progress"
                            )
        
        return {
            "messages": [response],
            "plan": new_plan,
            "current_step": new_step,
            "step_results": new_step_results
        }
    
    def _should_continue(self, state: PlanAgentState) -> str:
        """Determine whether to continue tool execution, move to next step, or end.
        
        For plan-based execution:
        - If there are tool calls, continue to TOOL node
        - If no tool calls and current step is complete, check if there are more steps
        - If more steps remain, continue to MAIN node for next step
        - Otherwise, end
        
        Args:
            state: Current agent state.
            
        Returns:
            "continue" if tools should be called, "next_step" if more steps remain, "end" otherwise.
        """
        messages = state["messages"]
        if not messages:
            return "end"
            
        last_message = messages[-1]
        plan = state.get("plan", [])
        current_step = state.get("current_step", 0)
        plan_needed = state.get("plan_needed", False)
        
        # If the last message has tool calls, continue to TOOL node
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "continue"
        
        # For plan-based execution, check if there are more steps
        if plan_needed and plan:
            # Count completed steps
            completed_count = sum(1 for s in plan if s.get("status") == "completed")
            total_steps = len(plan)
            
            # If all steps are completed, end
            if completed_count >= total_steps:
                return "end"
            
            # Check current step status
            if current_step < len(plan):
                step_status = plan[current_step].get("status", "pending")
                
                # If current step is completed and there are more steps, proceed to next
                if step_status == "completed":
                    if current_step + 1 < len(plan):
                        return "next_step"
                    else:
                        # All steps completed
                        return "end"
                
                # If step is in_progress but no tool calls, it's complete
                # Automatically proceed to next step or end
                elif step_status == "in_progress":
                    if current_step + 1 < len(plan):
                        # More steps remain - proceed to next step
                        return "next_step"
                    else:
                        # This is the last step - end after completion
                        return "end"
                else:
                    # Step not started or pending - start it
                    return "next_step"
            else:
                # current_step is beyond plan length - check if all done
                if completed_count >= total_steps:
                    return "end"
                else:
                    # There are still incomplete steps - something's wrong, but try to continue
                    return "next_step"
        
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
            "plan_needed": False,
            "step_results": {}
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
                            # Always send plan_created event if plan exists (even if plan_needed is False)
                            # This allows frontend to display the plan using AI Elements components
                            if plan:
                                last_plan = plan
                                yield {
                                    "type": "plan_created",
                                    "plan": plan
                                }
                            elif plan_needed:
                                # If plan_needed is True but plan is empty, create a default plan
                                # This ensures the frontend always has something to display
                                default_plan = [
                                    {
                                        "step_number": 1,
                                        "description": "Analyze user request",
                                        "status": "completed"
                                    },
                                    {
                                        "step_number": 2,
                                        "description": "Execute main reasoning",
                                        "status": "pending"
                                    }
                                ]
                                last_plan = default_plan
                                yield {
                                    "type": "plan_created",
                                    "plan": default_plan
                                }
                    
                    # After MAIN node, check for plan step completion and send plan updates
                    if node_name == "MAIN":
                        output = event.get("data", {}).get("output", {})
                        if isinstance(output, dict):
                            # Check for plan step completion
                            if last_plan:
                                new_plan = output.get("plan", [])
                                new_step = output.get("current_step", 0)
                                
                                # Send plan_updated event whenever plan changes
                                if new_plan != last_plan:
                                    yield {
                                        "type": "plan_updated",
                                        "plan": new_plan,
                                        "current_step": new_step
                                    }
                                
                                # Check if a step was completed
                                for i, step in enumerate(new_plan):
                                    if i < len(last_plan):
                                        if step.get("status") == "completed" and last_plan[i].get("status") != "completed":
                                            yield {
                                                "type": "plan_step_completed",
                                                "step_number": step.get("step_number"),
                                                "description": step.get("description"),
                                                "plan": new_plan,
                                                "current_step": new_step
                                            }
                                last_plan = new_plan
                            
                            # Note: We don't send token events here because on_chat_model_stream already handles streaming
                            # Sending here would cause duplicate content. Only send if on_chat_model_stream didn't fire
                            # (e.g., when using invoke() without streaming). But in our case, we use astream_events which
                            # always fires on_chat_model_stream, so we skip token events here to avoid duplication.
                            # The final response will be streamed via on_chat_model_stream events.
            
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

