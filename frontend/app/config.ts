/**
 * Chat configuration settings
 */

export interface ChatConfig {
  backendBaseUrl: string;
  chatEndpoint: string;
  timeout?: number;
}

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

