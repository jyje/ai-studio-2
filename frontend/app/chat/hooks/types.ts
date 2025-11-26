import { ParsedFile } from '../utils/fileParser';
import { LLMProfile, AgentType } from '../../config';

/**
 * Metadata for assistant messages showing model/agent info
 */
export interface MessageMeta {
  modelName?: string;      // LLM profile name
  agentType?: AgentType;   // Agent type used (basic or langgraph)
}

/**
 * Tool call information from LangGraph agent
 */
export interface ToolCall {
  id: string;              // Unique identifier for this tool call
  tool: string;            // Tool name (e.g., 'get_current_time', 'get_weather')
  input: Record<string, unknown>;  // Tool input parameters
  output?: string;         // Tool output (available after tool_end)
  status: 'running' | 'completed' | 'error';
}

/**
 * Plan step from Plan-1 agent
 */
export interface PlanStep {
  step_number: number;     // Step number (1-indexed)
  description: string;     // Step description
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  attachedFiles?: ParsedFile[]; // For display purposes
  meta?: MessageMeta;           // Model/agent info for assistant messages
  toolCalls?: ToolCall[];       // Tool calls made by LangGraph agent
  plan?: PlanStep[];            // Execution plan from Plan-1 agent
}

export interface ChatStreamOptions {
  apiUrl: string;
  onError?: (error: Error) => void;
  t?: (key: string) => string;
  model?: string; // Optional: profile name or model name
  provider?: 'openai' | 'azureopenai'; // Optional: provider name
  agentType?: AgentType; // Optional: agent type (basic or langgraph)
}

export interface ChatStreamReturn {
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  sendMessage: (content: string, files?: ParsedFile[]) => Promise<void>;
  addMessage: (message: Message) => void;
  abort: () => void;
  clearError: () => void;
  selectedLLM: LLMProfile | null;
  setSelectedLLM: (profile: LLMProfile | null) => void;
  selectedAgentType: AgentType;
  setSelectedAgentType: (agentType: AgentType) => void;
  sessionId: string;
  resetSession: () => void; // Reset session and clear messages
  currentNode: string | null; // Currently active node in the agent graph
}

