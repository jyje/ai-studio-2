import { ParsedFile } from '../utils/fileParser';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  attachedFiles?: ParsedFile[]; // For display purposes
}

export interface ChatStreamOptions {
  apiUrl: string;
  onError?: (error: Error) => void;
  t?: (key: string) => string;
  model?: string; // Optional: profile name or model name
  provider?: 'openai' | 'azureopenai'; // Optional: provider name
}

export interface ChatStreamReturn {
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  sendMessage: (content: string, files?: ParsedFile[]) => Promise<void>;
  addMessage: (message: Message) => void;
  abort: () => void;
  clearError: () => void;
}

