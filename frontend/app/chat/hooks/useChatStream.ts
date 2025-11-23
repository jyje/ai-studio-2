import { useState, useRef, useEffect } from 'react';
import { Message, ChatStreamOptions, ChatStreamReturn } from './types';

export function useChatStream(options: ChatStreamOptions): ChatStreamReturn {
  const { apiUrl, onError, t } = options;
  
  // Default translation function (returns key if no translation provided)
  const translate = (key: string): string => {
    return t ? t(key) : key;
  };
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Generate unique message ID
  const generateMessageId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Initialize assistant message with "thinking" placeholder
    const assistantMessageId = generateMessageId();
    const thinkingText = translate('chatStream.thinking');
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: thinkingText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // Read SSE streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';
      let currentEvent = '';
      let isFirstToken = true; // Track if we've received the first token

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Process remaining buffer
          if (buffer.trim()) {
            const lines = buffer.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.substring(6).trim();
                try {
                  const data = JSON.parse(dataStr);
                  if (typeof data === 'string') {
                    if (isFirstToken) {
                      isFirstToken = false;
                      accumulatedContent = data;
                    } else {
                      accumulatedContent += data;
                    }
                  }
                } catch {
                  if (isFirstToken) {
                    isFirstToken = false;
                    accumulatedContent = dataStr;
                  } else {
                    accumulatedContent += dataStr;
                  }
                }
              }
            }
            if (accumulatedContent && accumulatedContent !== thinkingText) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: accumulatedContent }
                    : msg
                )
              );
            }
          }
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages (ending with \n\n)
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || ''; // Keep incomplete message in buffer

        for (const message of parts) {
          if (!message.trim()) continue;

          const lines = message.split('\n');
          let eventType = '';
          let data = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.substring(7).trim();
            } else if (line.startsWith('data: ')) {
              data = line.substring(6).trim();
            }
          }

          // Handle events
          if (eventType === 'start') {
            // Stream started - can log or ignore
            continue;
          } else if (eventType === 'end') {
            // Stream completed
            break;
          } else if (eventType === 'error') {
            // Parse error data
            try {
              const errorData = JSON.parse(data);
              throw new Error(errorData.error || 'Unknown error');
            } catch (parseError) {
              throw new Error(data || 'Unknown error');
            }
          }

          // Handle data
          if (data) {
            try {
              // Try to parse as JSON
              const parsedData = JSON.parse(data);
              if (parsedData.error) {
                throw new Error(parsedData.error);
              } else if (typeof parsedData === 'string') {
                // String content - first token received
                if (isFirstToken) {
                  isFirstToken = false;
                  accumulatedContent = parsedData; // Replace thinking text with first token
                } else {
                  accumulatedContent += parsedData;
                }
              } else if (parsedData.status === 'completed') {
                // Stream completed
                break;
              }
            } catch (parseError) {
              // If not JSON, treat as plain text content
              if (isFirstToken) {
                isFirstToken = false;
                accumulatedContent = data; // Replace thinking text with first token
              } else {
                accumulatedContent += data;
              }
            }

            // Update message with accumulated content
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: accumulatedContent }
                  : msg
              )
            );
          }
        }
      }
      
      // If stream ended without receiving any tokens, remove thinking placeholder
      if (isFirstToken && accumulatedContent === thinkingText) {
        setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId));
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Request aborted');
        return;
      }
      console.error('Chat error:', err);
      const error = err instanceof Error ? err : new Error('Unknown error occurred');
      setError(error);
      
      // Remove assistant message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId));
      
      // Call error callback
      if (onError) {
        onError(error);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const abort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      
      const thinkingText = translate('chatStream.thinking');
      const userAbortedText = translate('chatStream.userAborted');
      
      // Remove thinking message if it exists and add system message
      setMessages((prev) => {
        const filtered = prev.filter((msg) => !(msg.role === 'assistant' && msg.content === thinkingText));
        
        // Add system message indicating user cancellation
        const systemMessage: Message = {
          id: generateMessageId(),
          role: 'system',
          content: userAbortedText,
          timestamp: new Date(),
        };
        
        return [...filtered, systemMessage];
      });
    }
  };

  const clearError = () => {
    setError(null);
  };

  // Cancel request on component unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    abort,
    clearError,
  };
}

