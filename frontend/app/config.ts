/**
 * Chat configuration settings
 */

export interface ChatConfig {
  backendBaseUrl: string;
  chatEndpoint: string;
  timeout?: number;
}

/**
 * Agent type for selecting between basic LLM and LangGraph agents
 */
export type AgentType = 'basic' | 'langgraph' | 'plan-1';

/**
 * Agent type options for UI display
 */
export const AGENT_TYPES: { value: AgentType; label: string; description: string; hasGraph: boolean }[] = [
  { value: 'basic', label: 'Basic', description: 'Direct LLM chat', hasGraph: false },
  { value: 'langgraph', label: 'LangGraph', description: 'ReAct agent with tools', hasGraph: true },
  { value: 'plan-1', label: 'Plan-1', description: 'Planning agent with QUERY/MAIN/TOOL', hasGraph: true },
];

/**
 * Get backend URL from environment variables or use default value
 */
const getBackendBaseUrl = (): string => {
  // Use environment variable if available, otherwise use default development value
  if (typeof window !== 'undefined') {
    // Client-side: environment variable or default value
    return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
  }
  // Server-side: environment variable or default value
  return process.env.BACKEND_URL || 'http://127.0.0.1:8000';
};

/**
 * Chat API configuration
 */
export const chatConfig: ChatConfig = {
  backendBaseUrl: getBackendBaseUrl(),
  chatEndpoint: '/v2/chat',
  timeout: 30000, // 30 seconds
};

/**
 * Get full Chat API URL
 */
export const getChatApiUrl = (): string => {
  const baseUrl = chatConfig.backendBaseUrl.replace(/\/$/, ''); // Remove trailing slash
  const endpoint = chatConfig.chatEndpoint.startsWith('/')
    ? chatConfig.chatEndpoint
    : `/${chatConfig.chatEndpoint}`;
  return `${baseUrl}${endpoint}`;
};

/**
 * Get info API URL
 */
export const getInfoApiUrl = (): string => {
  const baseUrl = chatConfig.backendBaseUrl.replace(/\/$/, ''); // Remove trailing slash
  return `${baseUrl}/v2/info`;
};

/**
 * Model and agent information interface
 */
export interface ModelInfo {
  profile_name: string;
  provider: string;
  agent: string;
}

/**
 * Individual LLM profile information
 */
export interface LLMProfile {
  name: string;
  provider: string;
  model: string;
  base_url: string;
  default: boolean;
  available?: boolean; // Optional: whether this profile is available (initialized)
}

/**
 * Models list response interface
 */
export interface ModelsListResponse {
  models: Record<string, LLMProfile[]>;
  providers: string[];
}

/**
 * Fetch model and agent information from backend
 */
export const fetchModelInfo = async (): Promise<ModelInfo> => {
  const url = getInfoApiUrl();
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch model info: ${response.statusText}`);
  }
  return await response.json();
};

/**
 * Get models list API URL
 */
export const getModelsApiUrl = (): string => {
  const baseUrl = chatConfig.backendBaseUrl.replace(/\/$/, ''); // Remove trailing slash
  return `${baseUrl}/v2/models`;
};

/**
 * Get graph structure API URL
 */
export const getGraphApiUrl = (): string => {
  const baseUrl = chatConfig.backendBaseUrl.replace(/\/$/, ''); // Remove trailing slash
  return `${baseUrl}/v2/graph`;
};

/**
 * Graph node interface
 */
export interface GraphNode {
  id: string;
  type: 'start' | 'end' | 'node';
  label?: string;
}

/**
 * Graph edge interface
 */
export interface GraphEdge {
  source: string;
  target: string;
  conditional?: boolean;
  label?: string;
}

/**
 * Graph structure response interface
 */
export interface GraphStructureResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Fetch graph structure from backend
 * @param agentType - Optional agent type to get the graph for (default: 'langgraph')
 */
export const fetchGraphStructure = async (agentType: AgentType = 'langgraph'): Promise<GraphStructureResponse> => {
  const baseUrl = getGraphApiUrl();
  const url = `${baseUrl}?agent_type=${encodeURIComponent(agentType)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch graph structure: ${response.statusText}`);
  }
  return await response.json();
};

/**
 * Fetch available models list from backend
 */
export const fetchModelsList = async (): Promise<ModelsListResponse> => {
  const url = getModelsApiUrl();
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch models list: ${response.statusText}`);
  }
  return await response.json();
};

/**
 * Get default model profile from models list
 */
export const getDefaultModel = (modelsList: ModelsListResponse): LLMProfile | null => {
  for (const provider of modelsList.providers) {
    const profiles = modelsList.models[provider] || [];
    const defaultProfile = profiles.find((p) => p.default);
    if (defaultProfile) {
      return defaultProfile;
    }
  }
  // If no default found, return first profile from first provider
  const firstProvider = modelsList.providers[0];
  if (firstProvider && modelsList.models[firstProvider]?.length > 0) {
    return modelsList.models[firstProvider][0];
  }
  return null;
};

/**
 * Generate a UUID v4 for session ID
 */
export const generateSessionId = (): string => {
  // Use crypto.randomUUID if available, otherwise fallback to manual generation
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

