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

