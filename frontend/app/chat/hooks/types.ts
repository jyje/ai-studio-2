export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface ChatStreamOptions {
  apiUrl: string;
  onError?: (error: Error) => void;
  t?: (key: string) => string;
}

export interface ChatStreamReturn {
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  sendMessage: (content: string) => Promise<void>;
  addMessage: (message: Message) => void;
  abort: () => void;
  clearError: () => void;
}

