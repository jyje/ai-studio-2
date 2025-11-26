import { useState, useRef, useEffect } from 'react';
import { Message, MessageMeta, ToolCall, ChatStreamOptions, ChatStreamReturn } from './types';
import { ParsedFile, formatFilesForPrompt } from '../utils/fileParser';
import { fetchModelsList, getDefaultModel, LLMProfile, AgentType, generateSessionId } from '../../config';

export function useChatStream(options: ChatStreamOptions): ChatStreamReturn {
  const { apiUrl, onError, t, model, provider, agentType } = options;
  const [selectedLLM, setSelectedLLM] = useState<LLMProfile | null>(null);
  const [selectedAgentType, setSelectedAgentType] = useState<AgentType>(agentType || 'langgraph');
  const [currentNode, setCurrentNode] = useState<string | null>(null);
  
  // Session ID for multi-turn conversation - generated once on mount
  const sessionIdRef = useRef<string>(generateSessionId());
  const [sessionId, setSessionId] = useState<string>(sessionIdRef.current);
  
  // Default translation function (returns key if no translation provided)
  const translate = (key: string): string => {
    return t ? t(key) : key;
  };
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Load default LLM on mount if not specified
  useEffect(() => {
    if (!model && !selectedLLM) {
      fetchModelsList()
        .then((modelsList) => {
          const defaultLLM = getDefaultModel(modelsList);
          if (defaultLLM) {
            setSelectedLLM(defaultLLM);
          }
        })
        .catch((err) => {
          console.error('Failed to load default LLM:', err);
        });
    } else if (model && !selectedLLM) {
      // If model is specified, try to find it from the list
      fetchModelsList()
        .then((modelsList) => {
          // Try to find by profile name first, then by model name
          for (const providerName of modelsList.providers) {
            const profiles = modelsList.models[providerName] || [];
            const foundProfile = profiles.find((p) => p.name === model || p.model === model);
            if (foundProfile) {
              setSelectedLLM(foundProfile);
              return;
            }
          }
          // If not found and model is specified, use default LLM as fallback
          const defaultLLM = getDefaultModel(modelsList);
          if (defaultLLM) {
            setSelectedLLM(defaultLLM);
          }
        })
        .catch((err) => {
          console.error('Failed to load model list:', err);
        });
    }
  }, [model, selectedLLM]);

  // Generate unique message ID
  const generateMessageId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const sendMessage = async (content: string, files?: ParsedFile[]) => {
    const hasContent = content.trim().length > 0;
    const hasFiles = files && files.length > 0;
    
    if ((!hasContent && !hasFiles) || isLoading) return;

    // Format the message content with attached files
    const filesPrefix = hasFiles ? formatFilesForPrompt(files) : '';
    const displayContent = content.trim();
    const augmentedContent = filesPrefix + displayContent;
    
    // Debug: Log the augmented content to verify files are included
    console.log('[ChatStream] Augmented prompt:', {
      hasFiles,
      fileCount: files?.length || 0,
      filesPrefixLength: filesPrefix.length,
      displayContentLength: displayContent.length,
      augmentedContentLength: augmentedContent.length,
      preview: augmentedContent.substring(0, 500),
    });

    const userMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content: displayContent, // Display only user's input
      timestamp: new Date(),
      attachedFiles: files, // Store attached files for reference
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
          message: augmentedContent, // Send augmented content with file data
          // Send profile name if available, otherwise send model name
          model: model || selectedLLM?.name || selectedLLM?.model || '',
          ...(provider || selectedLLM?.provider ? { provider: provider || selectedLLM?.provider } : {}),
          agent_type: selectedAgentType, // Include agent type in request
          session_id: sessionId, // Include session ID for multi-turn conversation
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
      let streamEnded = false; // Flag to track if stream has ended
      let chunkCount = 0; // Debug: count received chunks
      
      // Capture current model/agent info for meta
      const currentMeta: MessageMeta = {
        modelName: model || selectedLLM?.name || selectedLLM?.model || 'Unknown',
        agentType: selectedAgentType,
      };
      
      // Track tool calls during streaming
      const toolCalls: ToolCall[] = [];
      let toolCallIdCounter = 0;
      
      // Helper to generate tool call ID
      const generateToolCallId = (): string => {
        return `tool-${Date.now()}-${toolCallIdCounter++}`;
      };
      
      // Helper to add meta and toolCalls to assistant message when stream ends
      const finalizeMessage = (content: string) => {
        if (content && content !== thinkingText) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { 
                    ...msg, 
                    content, 
                    meta: currentMeta,
                    toolCalls: toolCalls.length > 0 ? [...toolCalls] : undefined
                  }
                : msg
            )
          );
        }
      };
      
      // Helper to handle tool_start event
      const handleToolStart = (toolName: string, toolInput: Record<string, unknown>) => {
        const toolCall: ToolCall = {
          id: generateToolCallId(),
          tool: toolName,
          input: toolInput,
          status: 'running',
        };
        toolCalls.push(toolCall);
        
        // Update message with current tool calls
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, toolCalls: [...toolCalls] }
              : msg
          )
        );
      };
      
      // Helper to handle tool_end event
      const handleToolEnd = (toolName: string, toolOutput: string) => {
        // Find the matching running tool call and update it
        const toolCall = toolCalls.find(tc => tc.tool === toolName && tc.status === 'running');
        if (toolCall) {
          toolCall.output = toolOutput;
          toolCall.status = 'completed';
          
          // Update message with updated tool calls
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, toolCalls: [...toolCalls] }
                : msg
            )
          );
        }
      };

      while (!streamEnded) {
        const { done, value } = await reader.read();

        if (done) {
          console.log(`[DEBUG] Reader done. Total chunks: ${chunkCount}, Content length: ${accumulatedContent.length}`);
          console.log(`[DEBUG] Content preview (last 500 chars):`, accumulatedContent.slice(-500));
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
                    chunkCount++;
                  }
                } catch {
                  if (isFirstToken) {
                    isFirstToken = false;
                    accumulatedContent = dataStr;
                  } else {
                    accumulatedContent += dataStr;
                  }
                  chunkCount++;
                }
              }
            }
          }
          // Finalize message with meta info when reader is done
          finalizeMessage(accumulatedContent);
          console.log(`[DEBUG] Final content length: ${accumulatedContent.length}`);
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
            // Stream completed - finalize message with meta and exit
            console.log(`[DEBUG] End event received. Total chunks: ${chunkCount}, Content length: ${accumulatedContent.length}`);
            console.log(`[DEBUG] Content preview (last 500 chars):`, accumulatedContent.slice(-500));
            finalizeMessage(accumulatedContent);
            streamEnded = true;
            break;
          } else if (eventType === 'node_start') {
            // Node started - update current node for graph visualization
            try {
              const nodeData = JSON.parse(data);
              console.log(`[DEBUG] Node start: ${nodeData.node}`);
              setCurrentNode(nodeData.node);
            } catch (e) {
              console.error('Failed to parse node_start data:', e);
            }
            continue;
          } else if (eventType === 'node_end') {
            // Node ended - clear current node if it matches
            try {
              const nodeData = JSON.parse(data);
              console.log(`[DEBUG] Node end: ${nodeData.node}`);
              // Don't clear immediately, let the next node_start update it
            } catch (e) {
              console.error('Failed to parse node_end data:', e);
            }
            continue;
          } else if (eventType === 'tool_start') {
            // Tool is starting - update graph visualization to show TOOL node active
            try {
              const toolData = JSON.parse(data);
              console.log(`[DEBUG] Tool start: ${toolData.tool}`, toolData.input);
              handleToolStart(toolData.tool, toolData.input || {});
              // Set current node to TOOL/tools for graph visualization
              // Use 'TOOL' for plan-1 agent, 'tools' for langgraph agent
              setCurrentNode(selectedAgentType === 'plan-1' ? 'TOOL' : 'tools');
            } catch (e) {
              console.error('Failed to parse tool_start data:', e);
            }
            continue;
          } else if (eventType === 'tool_end') {
            // Tool finished - update graph visualization back to agent node
            try {
              const toolData = JSON.parse(data);
              console.log(`[DEBUG] Tool end: ${toolData.tool}`, toolData.output);
              handleToolEnd(toolData.tool, toolData.output || '');
              // Tool finished, will go back to agent/MAIN node
              setCurrentNode(selectedAgentType === 'plan-1' ? 'MAIN' : 'agent');
            } catch (e) {
              console.error('Failed to parse tool_end data:', e);
            }
            continue;
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
            let processedData = '';
            try {
              // Try to parse as JSON
              const parsedData = JSON.parse(data);
              if (parsedData.error) {
                throw new Error(parsedData.error);
              } else if (typeof parsedData === 'string') {
                // String content - first token received
                processedData = parsedData;
                if (isFirstToken) {
                  isFirstToken = false;
                  accumulatedContent = processedData; // Replace thinking text with first token
                } else {
                  accumulatedContent += processedData;
                }
              } else if (parsedData.status === 'completed') {
                // Stream completed - finalize message with meta and exit
                finalizeMessage(accumulatedContent);
                streamEnded = true;
                break;
              }
            } catch (parseError) {
              // If not JSON, treat as plain text content
              processedData = data;
              if (isFirstToken) {
                isFirstToken = false;
                accumulatedContent = processedData; // Replace thinking text with first token
              } else {
                accumulatedContent += processedData;
              }
            }

            // Increment chunk count if we processed content
            if (processedData) {
              chunkCount++;
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
      setCurrentNode(null); // Clear current node when streaming ends
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
      
      // Capture current model/agent info for meta
      const currentMeta: MessageMeta = {
        modelName: selectedLLM?.name || selectedLLM?.model || 'Unknown',
        agentType: selectedAgentType,
      };
      
      // Update assistant message with meta info (if has content) and add system message
      setMessages((prev) => {
        const updated = prev.map((msg) => {
          // If assistant message with content (not just thinking), add meta
          if (msg.role === 'assistant' && msg.content && msg.content !== thinkingText) {
            return { ...msg, meta: currentMeta };
          }
          return msg;
        });
        
        // Remove thinking-only messages
        const filtered = updated.filter((msg) => !(msg.role === 'assistant' && msg.content === thinkingText));
        
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

  const addMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
  };

  // Reset session - generate new session ID and clear messages
  const resetSession = () => {
    const newSessionId = generateSessionId();
    sessionIdRef.current = newSessionId;
    setSessionId(newSessionId);
    setMessages([]);
    setError(null);
    console.log('[ChatStream] Session reset. New session ID:', newSessionId);
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
    addMessage,
    abort,
    clearError,
    selectedLLM,
    setSelectedLLM,
    selectedAgentType,
    setSelectedAgentType,
    sessionId,
    resetSession,
    currentNode,
  };
}

