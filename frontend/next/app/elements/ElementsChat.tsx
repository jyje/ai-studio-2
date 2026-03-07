'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getChatApiUrl, fetchModelsList, ModelsListResponse, LLMProfile, AGENT_TYPES, AgentType, generateSessionId } from '../config';
import { useTranslation } from '@/app/i18n/hooks/useTranslation';
import { useSettings, AgentGraphDisplayMode } from '@/app/settings/context/SettingsContext';

// AI SDK imports
import {
  Conversation,
  ConversationContent,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputProvider,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputButton,
  PromptInputFooter,
  PromptInputTools,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionAddAttachments,
  PromptInputSpeechButton,
  PromptInputSelect,
  PromptInputSelectTrigger,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectValue,
  usePromptInputController,
} from '@/components/ai-elements/prompt-input';
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from '@/components/ai-elements/tool';
import { Plan, PlanHeader, PlanContent, PlanTitle } from '@/components/ai-elements/plan';
import {
  Suggestions,
  Suggestion,
} from '@/components/ai-elements/suggestion';
import { Brain, Bot, Network } from 'lucide-react';
import AgentGraphPanel from '../chat/components/AgentGraphPanel';

// Inner component that uses PromptInputController
function ElementsChatInner() {
  const { t, locale } = useTranslation();
  const { settings, setAgentGraphDisplayMode } = useSettings();
  const promptController = usePromptInputController();
  
  // Model and agent selection state
  const [allProfiles, setAllProfiles] = useState<LLMProfile[]>([]);
  const [selectedLLM, setSelectedLLM] = useState<LLMProfile | null>(null);
  
  // Always start with default to avoid hydration mismatch
  const [selectedAgentType, setSelectedAgentType] = useState<AgentType>('langgraph');
  const [sessionId] = useState<string>(() => generateSessionId());
  const [isMounted, setIsMounted] = useState(false);
  
  // Load agent type from localStorage after mount (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem('ai-studio-agent-type');
      // Check if stored value is valid (not null, not empty string, and is a valid type)
      if (stored && stored.trim() !== '') {
        const validTypes: AgentType[] = ['basic', 'langgraph', 'plan-1'];
        if (validTypes.includes(stored as AgentType)) {
          setSelectedAgentType(stored as AgentType);
          console.log('Agent type loaded from localStorage:', stored);
        } else {
          // Invalid value in localStorage, remove it
          console.warn('Invalid agent type in localStorage, removing:', stored);
          localStorage.removeItem('ai-studio-agent-type');
        }
      } else if (stored === '') {
        // Empty string in localStorage, remove it
        console.warn('Empty agent type in localStorage, removing');
        localStorage.removeItem('ai-studio-agent-type');
      }
    } catch (error) {
      console.error('Failed to load agent type from localStorage:', error);
    }
    
    setIsMounted(true);
  }, []);

  // Fetch models list on mount
  useEffect(() => {
    fetchModelsList()
      .then((list) => {
        // Flatten all profiles from all providers
        const profiles: LLMProfile[] = [];
        for (const provider of list.providers) {
          profiles.push(...(list.models[provider] || []));
        }
        setAllProfiles(profiles);
        
        // Set default model
        const defaultProfile = profiles.find(p => p.default) || profiles[0];
        if (defaultProfile) {
          setSelectedLLM(defaultProfile);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch models list:', err);
      });
  }, []);

  // Tool call interface
  interface ToolCall {
    id: string;
    tool: string;
    input: Record<string, unknown>;
    output?: string;
    status: 'running' | 'completed' | 'error';
  }

  // Message state
  interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    toolCalls?: ToolCall[];
    toolCallPositions?: Record<string, number>; // Map tool call ID to position in content
    suggestions?: string[];
    currentStep?: string | null; // Current step/node name for multi-step agents (e.g., Plan-1)
    plan?: Array<{ step_number: number; description: string; status: string }>; // Plan steps for Plan-1 agent
  }

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [showAgentGraph, setShowAgentGraph] = useState(false);
  const [currentNode, setCurrentNode] = useState<string | null>(null);
  const shouldAutoScrollRef = useRef<boolean>(true);
  const [showAgentGraphMenu, setShowAgentGraphMenu] = useState(false);
  const agentGraphMenuRef = useRef<HTMLDivElement>(null);
  const [agentPanelHeight, setAgentPanelHeight] = useState<number>(0);
  const agentGraphButtonRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  
  // Session-level plan management - persists across multiple turns
  const [sessionPlan, setSessionPlan] = useState<Array<{ step_number: number; description: string; status: string }> | null>(null);
  
  // Determine if agent graph should be shown based on display mode
  const hasGraphSupport = AGENT_TYPES.find(a => a.value === selectedAgentType)?.hasGraph || false;
  
  // Only show floating panel when explicitly in floating mode and toggled on
  const shouldShowFloatingGraph = hasGraphSupport && 
    settings.agentGraphDisplayMode === 'floating' && 
    showAgentGraph;
  
  // Always show embedded panel when in embedded mode
  const shouldShowEmbeddedGraph = hasGraphSupport && 
    settings.agentGraphDisplayMode === 'embedded';
  
  // Calculate menu position when menu is shown - use useLayoutEffect for synchronous calculation
  useLayoutEffect(() => {
    if (showAgentGraphMenu && agentGraphButtonRef.current) {
      // Calculate position immediately
      const rect = agentGraphButtonRef.current.getBoundingClientRect();
      const menuWidth = 192; // w-48 = 192px
      const menuHeight = 120; // Approximate menu height (3 items)
      
      // Calculate position: show above button, aligned to right edge of button
      const top = Math.max(8, rect.top - menuHeight - 8);
      const right = Math.max(8, window.innerWidth - rect.right);
      
      // Check if menu would go off screen to the left
      const left = window.innerWidth - right - menuWidth;
      const adjustedRight = left < 8 ? window.innerWidth - menuWidth - 8 : right;
      
      setMenuPosition({
        top,
        right: adjustedRight,
      });
    } else {
      setMenuPosition(null);
    }
  }, [showAgentGraphMenu]);
  
  // Close agent graph menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        agentGraphButtonRef.current &&
        agentGraphMenuRef.current &&
        !agentGraphButtonRef.current.contains(event.target as Node) &&
        !agentGraphMenuRef.current.contains(event.target as Node)
      ) {
        setShowAgentGraphMenu(false);
        setMenuPosition(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showAgentGraphMenu) {
        setShowAgentGraphMenu(false);
        setMenuPosition(null);
      }
    };

    if (showAgentGraphMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [showAgentGraphMenu]);
  
  // Handle agent graph display mode change
  const handleDisplayModeChange = (mode: AgentGraphDisplayMode) => {
    setAgentGraphDisplayMode(mode);
    setShowAgentGraphMenu(false);
    
    // If switching to floating mode, show the graph
    if (mode === 'floating') {
      setShowAgentGraph(true);
    }
    // If switching to embedded mode, it's always visible when hasGraphSupport is true
  };

  // Generate unique message ID
  const generateMessageId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Send message to backend
  const sendMessage = async (content: string) => {
    if (!selectedLLM || !content.trim() || isLoading) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: content.trim(),
    };
    
    // Clear suggestions from all previous assistant messages when starting a new conversation turn
    setMessages((prev) => 
      prev.map((msg) => 
        msg.role === 'assistant'
          ? { ...msg, suggestions: undefined }
          : msg
      ).concat(userMessage)
    );
    setIsLoading(true);
    setError(null);

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Initialize assistant message
    const assistantMessageId = generateMessageId();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const response = await fetch(getChatApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content.trim(),
          model: selectedLLM.name || selectedLLM.model,
          ...(selectedLLM.provider ? { provider: selectedLLM.provider } : {}),
          agent_type: selectedAgentType,
          session_id: sessionId,
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
      
      // Track tool calls during streaming
      const toolCalls: ToolCall[] = [];
      const toolCallPositions: Record<string, number> = {}; // Track where each tool call should appear
      let toolCallIdCounter = 0;
      
      // Helper to generate tool call ID
      const generateToolCallId = (): string => {
        return `tool-${Date.now()}-${toolCallIdCounter++}`;
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
        
        // Record the position where this tool call should appear (current content length)
        toolCallPositions[toolCall.id] = accumulatedContent.length;
        
        // Update message with current tool calls and positions
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { 
                  ...msg, 
                  toolCalls: [...toolCalls],
                  toolCallPositions: { ...toolCallPositions }
                }
              : msg
          )
        );
      };
      
      // Helper to handle tool_end event
      const handleToolEnd = (toolName: string, toolOutput: string) => {
        // Find the most recent matching running tool call and update it
        // This handles cases where the same tool is called multiple times
        let toolCall = null;
        for (let i = toolCalls.length - 1; i >= 0; i--) {
          if (toolCalls[i].tool === toolName && toolCalls[i].status === 'running') {
            toolCall = toolCalls[i];
            break;
          }
        }
        
        if (toolCall) {
          toolCall.output = toolOutput;
          toolCall.status = 'completed';
          
          // Update message with updated tool calls
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { 
                    ...msg, 
                    toolCalls: [...toolCalls],
                    toolCallPositions: { ...toolCallPositions }
                  }
                : msg
            )
          );
        } else {
          // If no running tool call found, log for debugging
          console.warn(`No running tool call found for tool: ${toolName}`, toolCalls);
        }
      };

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

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

          // Handle different event types
          if (eventType === 'token') {
            // Handle token content
            if (data) {
              try {
                const parsed = JSON.parse(data);
                if (typeof parsed === 'string') {
                  accumulatedContent += parsed;
                } else if (parsed && typeof parsed === 'object' && parsed.content) {
                  accumulatedContent += parsed.content;
                }
              } catch (e) {
                // If parsing fails, treat as plain string
                accumulatedContent += data;
              }
              
              // Update assistant message with accumulated content
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: accumulatedContent }
                    : msg
                )
              );
            }
            continue;
          } else if (eventType === 'node_start') {
            try {
              const nodeData = JSON.parse(data);
              const nodeName = nodeData.node || null;
              setCurrentNode(nodeName);
              
              // Update current step in assistant message (exclude tool nodes)
              // Tool nodes: 'TOOL', 'tools' are excluded
              if (nodeName && nodeName !== 'TOOL' && nodeName !== 'tools' && nodeName.toLowerCase() !== 'tool') {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id === assistantMessageId) {
                      return { ...msg, currentStep: nodeName };
                    }
                    return msg;
                  })
                );
              }
            } catch (e) {
              console.error('Failed to parse node_start data:', e);
            }
            continue;
          } else if (eventType === 'node_end') {
            try {
              const nodeData = JSON.parse(data);
              // Node ended, might transition to next node
              // Keep current node until next node_start
            } catch (e) {
              console.error('Failed to parse node_end data:', e);
            }
            continue;
          } else if (eventType === 'tool_start') {
            try {
              const toolData = JSON.parse(data);
              handleToolStart(toolData.tool, toolData.input || {});
              // Set current node to TOOL/tools for graph visualization
              setCurrentNode(selectedAgentType === 'plan-1' ? 'TOOL' : 'tools');
            } catch (e) {
              console.error('Failed to parse tool_start data:', e);
            }
            continue;
          } else if (eventType === 'tool_end') {
            try {
              const toolData = JSON.parse(data);
              handleToolEnd(toolData.tool, toolData.output || '');
              // Tool finished, will go back to agent/MAIN node
              const nextNode = selectedAgentType === 'plan-1' ? 'MAIN' : 'agent';
              setCurrentNode(nextNode);
              // Update current step in assistant message (tool nodes are excluded, so update to next node)
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id === assistantMessageId) {
                    return { ...msg, currentStep: nextNode };
                  }
                  return msg;
                })
              );
            } catch (e) {
              console.error('Failed to parse tool_end data:', e);
            }
            continue;
          } else if (eventType === 'plan_created') {
            try {
              const planData = JSON.parse(data);
              const plan = planData.plan || [];
              // Update session-level plan (persists across multiple turns)
              setSessionPlan(plan);
              // Also update current assistant message with plan
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id === assistantMessageId) {
                    return { ...msg, plan: plan };
                  }
                  return msg;
                })
              );
            } catch (e) {
              console.error('Failed to parse plan_created data:', e);
            }
            continue;
          } else if (eventType === 'plan_updated') {
            try {
              const planData = JSON.parse(data);
              const plan = planData.plan || [];
              const currentStep = planData.current_step || 0;
              // Update session-level plan (persists across multiple turns)
              setSessionPlan(plan);
              // Also update current assistant message with updated plan
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id === assistantMessageId) {
                    return { ...msg, plan: plan };
                  }
                  return msg;
                })
              );
            } catch (e) {
              console.error('Failed to parse plan_updated data:', e);
            }
            continue;
          } else if (eventType === 'plan_step_completed') {
            try {
              const stepData = JSON.parse(data);
              const stepNumber = stepData.step_number || 0;
              const plan = stepData.plan || [];
              // Update session-level plan (persists across multiple turns)
              setSessionPlan(plan);
              // Also update current assistant message with updated plan
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id === assistantMessageId) {
                    return { ...msg, plan: plan };
                  }
                  return msg;
                })
              );
            } catch (e) {
              console.error('Failed to parse plan_step_completed data:', e);
            }
            continue;
          } else if (eventType === 'suggestions') {
            try {
              const suggestionsData = JSON.parse(data);
              const suggestions = suggestionsData.suggestions || [];
              // Update current message with suggestions and clear suggestions from other assistant messages
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id === assistantMessageId) {
                    return { ...msg, suggestions: suggestions };
                  } else if (msg.role === 'assistant') {
                    // Clear suggestions from other assistant messages
                    return { ...msg, suggestions: undefined };
                  }
                  return msg;
                })
              );
            } catch (e) {
              console.error('Failed to parse suggestions data:', e);
            }
            continue;
          } else if (eventType === 'error') {
            try {
              const errorData = JSON.parse(data);
              throw new Error(errorData.error || 'Unknown error');
            } catch (parseError) {
              throw new Error(data || 'Unknown error');
            }
          }

          // Handle content data (fallback for events without explicit type)
          if (!eventType || eventType === 'end') {
            if (data) {
              try {
                const parsed = JSON.parse(data);
                if (typeof parsed === 'string') {
                  accumulatedContent += parsed;
                } else if (parsed && typeof parsed === 'object' && parsed.content) {
                  accumulatedContent += parsed.content;
                }
              } catch {
                // If parsing fails, treat as plain string
                accumulatedContent += data;
              }
              
              // Update assistant message with accumulated content
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
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      // Clear current node highlight when response is complete
      setCurrentNode(null);
      // Keep current step in assistant message (don't clear it)
    }
  };

  // Scroll to bottom function - scrolls the window to bottom
  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth',
    });
  };

  // Check if user is near bottom of page
  const isAtBottom = (): boolean => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    // Allow 100px threshold for better UX
    return documentHeight - scrollTop - windowHeight < 100;
  };

  // Handle scroll event to detect if user scrolled up
  useEffect(() => {
    const handleScroll = () => {
      shouldAutoScrollRef.current = isAtBottom();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll when messages update (only if at bottom)
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [messages]);

  // Remove trailing empty spans from code blocks after rendering
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is fully rendered
    requestAnimationFrame(() => {
      // Find all code blocks rendered by streamdown
      const codeBlocks = document.querySelectorAll('pre code');
      codeBlocks.forEach((codeEl) => {
        const children = Array.from(codeEl.children);
        // Check if last child is an empty span
        const lastChild = children[children.length - 1];
        if (lastChild && 
            lastChild.tagName === 'SPAN' && 
            (!lastChild.textContent || lastChild.textContent.trim() === '')) {
          // Remove the empty span
          lastChild.remove();
        }
      });
    });
  }, [messages, isLoading]);

  // Reset auto-scroll when user sends a new message or loading starts
  useEffect(() => {
    if (isLoading) {
      shouldAutoScrollRef.current = true;
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [isLoading]);

  const stop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);

      // Add system message indicating user cancellation
      const systemMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'system',
        content: t('chatStream.userAborted') || 'User aborted the response',
      };
      setMessages((prev) => [...prev, systemMessage]);
    }
  };

  // Get random 3 examples from welcome examples
  const getRandomExamples = (): string[] => {
    const allExamples = t('welcome.examples');
    const shuffled = [...allExamples].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  };

  // Initialize random examples on client side only to avoid hydration mismatch
  const [randomExamples, setRandomExamples] = useState<string[]>([]);
  const hasMessages = messages.length > 0;
  
  // Reset session plan when starting a new conversation (no messages)
  useEffect(() => {
    if (messages.length === 0) {
      setSessionPlan(null);
    }
  }, [messages.length]);

  // Set random examples on client side and update when locale changes
  useEffect(() => {
    setRandomExamples(getRandomExamples());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const handlePromptSubmit = async (message: { text: string; files: any[] }, event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.text.trim() || isLoading) return;
    
    await sendMessage(message.text);
  };

  const handleExampleClick = (example: string) => {
    promptController.textInput.setInput(example);
    setTimeout(() => {
      const textarea = document.querySelector('textarea[name="message"]') as HTMLTextAreaElement;
      textarea?.focus();
    }, 0);
  };

  return (
    <>
      <style jsx global>{`
        /* Ensure CodeBlock within Tool components doesn't overflow */
        [data-tool-content] pre,
        [data-tool-content] code {
          max-width: 100%;
          width: 100%;
          box-sizing: border-box;
          overflow-x: auto;
          word-break: break-word;
          white-space: pre-wrap;
        }
        /* Ensure Tool components respect container width */
        [data-tool-wrapper] {
          max-width: 100%;
          width: 100%;
          overflow: hidden;
        }
        /* Ensure all code blocks have full width */
        pre,
        code {
          max-width: 100%;
          box-sizing: border-box;
        }
        pre {
          width: 100%;
        }
      `}</style>
      <div className="flex flex-col w-full max-w-full md:max-w-2xl lg:max-w-4xl py-24 mx-auto stretch px-4">
        {/* Agent Graph Panel - floating when in floating mode */}
        {/* Only show when explicitly in floating mode and toggled on */}
        {shouldShowFloatingGraph && (
          <AgentGraphPanel 
            currentNode={currentNode} 
            isLoading={isLoading} 
            onClose={() => setShowAgentGraph(false)}
            agentType={selectedAgentType}
            displayMode="floating"
          />
        )}

      {/* Agent Graph Panel - embedded mode, appears first before welcome screen */}
      {/* Sticky to stay fixed at top when scrolling, but takes up space in document flow */}
      {shouldShowEmbeddedGraph && (
        <div 
          className="sticky top-0 z-50 mb-0 transition-all duration-300 ease-in-out bg-background" 
          id="agent-graph-panel"
          ref={(el) => {
            if (el) {
              const updateHeight = () => {
                setAgentPanelHeight(el.offsetHeight);
              };
              updateHeight();
              // Use ResizeObserver to track height changes
              const resizeObserver = new ResizeObserver(updateHeight);
              resizeObserver.observe(el);
              return () => resizeObserver.disconnect();
            }
          }}
        >
          <AgentGraphPanel 
            currentNode={currentNode} 
            isLoading={isLoading} 
            agentType={selectedAgentType}
            displayMode="embedded"
          />
        </div>
      )}

        
      {/* Welcome screen - only show when no messages */}
      {/* Appears naturally below embedded panel, layout adjusts smoothly when panel is collapsed/expanded */}
      {!hasMessages && (
        <div className="flex flex-col items-center justify-center pb-4 transition-all duration-300 ease-in-out">
          <h1 className="text-5xl font-bold mt-12 mb-12 text-gray-900 dark:text-[#cccccc]">
            {t('welcome.title')}
          </h1>
          <div className="flex flex-col gap-3 w-full max-w-2xl">
            {randomExamples.map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                className="text-left p-4 rounded-xl border border-gray-300 dark:border-[#3e3e42] bg-white dark:bg-[#252526] hover:bg-gray-50 dark:hover:bg-[#2d2d30] transition-colors shadow-sm hover:shadow-md cursor-pointer"
              >
                <span className="text-gray-900 dark:text-[#cccccc]">{example}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Conversation>
        <ConversationContent className="pb-16">
          {messages.map((m) => {
            // System messages should be rendered separately with user alignment
            if (m.role === 'system') {
              return (
                <Message key={m.id} from="user">
                  <MessageContent className="bg-orange-500! text-white!">
                    {m.content}
                  </MessageContent>
                </Message>
              );
            }
            
            return (
              <Message key={m.id} from={m.role} className={m.role === 'assistant' ? '!max-w-full w-full' : ''}>
                <MessageContent className={m.role === 'assistant' ? '!max-w-full w-full' : ''} style={m.role === 'assistant' ? { maxWidth: '100%', width: '100%', overflow: 'hidden' } : undefined}>
                  {/* Message content with tool calls inserted at their call positions */}
                  {m.role === 'user' ? (
                    m.content
                  ) : (
                    <>
                      {/* Analysis Section - Always shown */}
                      <div className="w-full border-b border-gray-300 dark:border-[#3e3e42] mb-4 pb-4">
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
                          {t('agentGraph.nodes.QUERY') || '분석'}
                        </div>
                        {/* Plan display for Plan-1 agent - use session-level plan if available, otherwise message-level plan */}
                        {(() => {
                          // Prioritize session-level plan (persists across multiple turns)
                          const planToDisplay = sessionPlan || m.plan;
                          
                          if (planToDisplay && planToDisplay.length > 0) {
                            return (
                              <Plan defaultOpen={true} isStreaming={isLoading}>
                                <PlanHeader>
                                  <PlanTitle>{t('plan.title') || 'Execution Plan'}</PlanTitle>
                                </PlanHeader>
                                <PlanContent>
                                  {planToDisplay.map((step) => {
                                    const status = step.status || 'pending';
                                    const isCompleted = status === 'completed';
                                    const isInProgress = status === 'in_progress';
                                    
                                    // Remove "Step X:" prefix from description if it exists
                                    let description = step.description || '';
                                    const stepPrefix = new RegExp(`^Step\\s*${step.step_number}\\s*:\\s*`, 'i');
                                    description = description.replace(stepPrefix, '');
                                    
                                    return (
                                      <div
                                        key={step.step_number}
                                        className={`flex items-start gap-2 py-2 transition-all duration-300 ${
                                          isCompleted
                                            ? 'text-green-600 dark:text-green-400'
                                            : isInProgress
                                            ? 'text-blue-600 dark:text-blue-400 font-medium animate-pulse'
                                            : 'text-gray-500 dark:text-gray-500'
                                        }`}
                                      >
                                        <span className="mt-0.5 text-lg shrink-0">
                                          {isCompleted ? '✓' : isInProgress ? '→' : '○'}
                                        </span>
                                        <span className="flex-1">
                                          <span className="font-medium">Step {step.step_number}:</span> {description}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </PlanContent>
                              </Plan>
                            );
                          } else {
                            return (
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {t('plan.noPlanning') || 'No Planning'}
                              </div>
                            );
                          }
                        })()}
                      </div>
                      
                      {/* Main Section - Always shown */}
                      <div className="w-full">
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
                          {t('agentGraph.nodes.MAIN') || '메인'}
                        </div>
                        {(() => {
                        if (!m.content && isLoading) {
                          return t('chatStream.thinking') || 'Thinking...';
                        }
                        
                        // If no tool calls or no positions, render content normally
                        // Check both toolCalls array and toolCallPositions object
                        const hasToolCalls = m.toolCalls && m.toolCalls.length > 0;
                        const hasToolCallPositions = m.toolCallPositions && Object.keys(m.toolCallPositions).length > 0;
                        
                        if (!hasToolCalls || !hasToolCallPositions) {
                          return <MessageResponse>{m.content || ''}</MessageResponse>;
                        }
                        
                        // Sort tool calls by their position in content
                        const sortedToolCalls = [...(m.toolCalls || [])].sort((a, b) => {
                          const posA = m.toolCallPositions?.[a.id] ?? Infinity;
                          const posB = m.toolCallPositions?.[b.id] ?? Infinity;
                          return posA - posB;
                        });
                        
                        // Split content and insert tool calls at their positions
                        const parts: (string | ToolCall)[] = [];
                        let lastIndex = 0;
                        const contentLength = m.content?.length || 0;
                        
                        sortedToolCalls.forEach((toolCall) => {
                          const position = Math.min(Math.max(0, m.toolCallPositions?.[toolCall.id] ?? lastIndex), contentLength);
                          
                          // Add content before this tool call
                          if (position > lastIndex && m.content && position <= contentLength) {
                            const contentPart = m.content.substring(lastIndex, position);
                            if (contentPart) {
                              parts.push(contentPart);
                            }
                          }
                          
                          // Add tool call
                          parts.push(toolCall);
                          lastIndex = Math.max(lastIndex, position);
                        });
                        
                        // Add remaining content after all tool calls
                        // This is critical for displaying the final response after tool execution
                        if (m.content && lastIndex < contentLength) {
                          const remainingContent = m.content.substring(lastIndex);
                          if (remainingContent) {
                            parts.push(remainingContent);
                          }
                        }
                        
                        // If no content was added to parts (e.g., all tool calls are at position 0 or content is empty)
                        // but we have content, add it at the end
                        const hasContentInParts = parts.some(p => typeof p === 'string' && p.length > 0);
                        if (!hasContentInParts && m.content && m.content.trim() && sortedToolCalls.length > 0) {
                          // All parts are tool calls, so add content at the end
                          parts.push(m.content);
                        }
                        
                        // If no parts were created at all (no tool calls and no content added), show content
                        if (parts.length === 0 && m.content && m.content.trim()) {
                          parts.push(m.content);
                        }
                        
                        // If no parts were created, it means all tool calls are at position 0 or content is empty
                        // In this case, show tool calls first, then content
                        if (parts.length === 0 && sortedToolCalls.length > 0) {
                          return (
                            <>
                              {sortedToolCalls.map((toolCall) => {
                                const toolState = toolCall.status === 'completed' 
                                  ? 'output-available' 
                                  : toolCall.status === 'running' 
                                  ? 'input-available' 
                                  : 'input-streaming';
                                
                                return (
                                  <div key={toolCall.id} className="my-4 w-full" style={{ maxWidth: '100%', overflow: 'hidden' }}>
                                    <Tool 
                                      defaultOpen={false} 
                                      className="w-full" 
                                      style={{ maxWidth: '100%', overflow: 'hidden' }}
                                      data-tool-wrapper
                                    >
                                      <ToolHeader
                                        title={toolCall.tool}
                                        type="tool-function"
                                        state={toolState as any}
                                      />
                                      <ToolContent 
                                        className="w-full" 
                                        style={{ 
                                          maxWidth: '100%', 
                                          overflowX: 'auto', 
                                          overflowY: 'hidden',
                                          width: '100%'
                                        }}
                                        data-tool-content
                                      >
                                        <div style={{ maxWidth: '100%', width: '100%', overflow: 'hidden' }}>
                                          {toolCall.input && (
                                            <ToolInput 
                                              input={toolCall.input as any} 
                                              className="max-w-full w-full" 
                                              style={{ maxWidth: '100%', width: '100%', overflow: 'hidden' }} 
                                            />
                                          )}
                                          {toolCall.output && (
                                            <ToolOutput 
                                              output={toolCall.output as any} 
                                              errorText={toolCall.status === 'error' ? toolCall.output : undefined}
                                              className="max-w-full w-full" 
                                              style={{ maxWidth: '100%', width: '100%', overflow: 'hidden' }}
                                            />
                                          )}
                                        </div>
                                      </ToolContent>
                                    </Tool>
                                  </div>
                                );
                              })}
                              {/* Show content if it exists after tool calls */}
                              {m.content && m.content.trim() && (
                                <div className="mt-4">
                                  {m.content}
                                </div>
                              )}
                            </>
                          );
                        }
                        
                        // If no parts and no tool calls, return content
                        if (parts.length === 0) {
                          return <MessageResponse>{m.content || (isLoading ? (t('chatStream.thinking') || 'Thinking...') : '')}</MessageResponse>;
                        }
                        
                        
                        // Render parts in order: content segments wrapped in MessageResponse, tool calls as components
                        // Each string part gets its own MessageResponse for markdown processing
                        return (
                          <>
                            {parts.map((part, index) => {
                              if (typeof part === 'string') {
                                // Render string content with MessageResponse for markdown processing
                                return (
                                  <MessageResponse key={`content-${index}`}>
                                    {part}
                                  </MessageResponse>
                                );
                              } else {
                                // Render tool call
                                const toolCall = part as ToolCall;
                                const toolState = toolCall.status === 'completed' 
                                  ? 'output-available' 
                                  : toolCall.status === 'running' 
                                  ? 'input-available' 
                                  : 'input-streaming';
                                
                                return (
                                  <div key={toolCall.id} className="my-4 w-full" style={{ maxWidth: '100%', overflow: 'hidden' }}>
                                    <Tool 
                                      defaultOpen={false} 
                                      className="w-full" 
                                      style={{ maxWidth: '100%', overflow: 'hidden' }}
                                      data-tool-wrapper
                                    >
                                      <ToolHeader
                                        title={toolCall.tool}
                                        type="tool-function"
                                        state={toolState as any}
                                      />
                                      <ToolContent 
                                        className="w-full" 
                                        style={{ 
                                          maxWidth: '100%', 
                                          overflowX: 'auto', 
                                          overflowY: 'hidden',
                                          width: '100%'
                                        }}
                                        data-tool-content
                                      >
                                        <div style={{ maxWidth: '100%', width: '100%', overflow: 'hidden' }}>
                                          {toolCall.input && (
                                            <ToolInput 
                                              input={toolCall.input as any} 
                                              className="max-w-full w-full" 
                                              style={{ maxWidth: '100%', width: '100%', overflow: 'hidden' }} 
                                            />
                                          )}
                                          {toolCall.output && (
                                            <ToolOutput 
                                              output={toolCall.output as any} 
                                              errorText={toolCall.status === 'error' ? toolCall.output : undefined}
                                              className="max-w-full w-full" 
                                              style={{ maxWidth: '100%', width: '100%', overflow: 'hidden' }}
                                            />
                                          )}
                                        </div>
                                      </ToolContent>
                                    </Tool>
                                  </div>
                                );
                              }
                            })}
                          </>
                        );
                      })()}
                      </div>
                    </>
                  )}

                  {/* 4. Suggestions - 제안 표시 */}
                  {m.role === 'assistant' && m.suggestions && m.suggestions.length > 0 && (
                    <div className="mt-4 w-full">
                      <Suggestions>
                        {m.suggestions.map((suggestion, index) => (
                          <Suggestion
                            key={index}
                            suggestion={suggestion}
                            onClick={(s) => {
                              sendMessage(s);
                            }}
                          />
                        ))}
                      </Suggestions>
                    </div>
                  )}
                </MessageContent>
              </Message>
            );
          })}
        </ConversationContent>
      </Conversation>

      {/* Error display */}
      {error && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
          {error.message}
        </div>
      )}
      
      {/* AI SDK PromptInput - 기본 예제 스타일 */}
      <div className="fixed bottom-0 left-0 right-0 w-full max-w-full md:max-w-2xl lg:max-w-4xl mx-auto p-4">
        <PromptInput onSubmit={handlePromptSubmit} className="bg-background rounded-lg">
          <PromptInputBody>
            <PromptInputTextarea
              placeholder={isLoading ? t('chatInput.placeholder.waiting') : t('chatInput.placeholder.default') || 'What would you like to know?'}
              disabled={isLoading}
            />
          </PromptInputBody>
          
          <PromptInputFooter>
            <PromptInputTools>
              {/* Add attachments button */}
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              
              {/* Speech button */}
              <PromptInputSpeechButton />
            </PromptInputTools>
            
            <PromptInputTools>
              {/* Model Selector */}
              {allProfiles.length > 0 && (
                <PromptInputSelect
                  value={selectedLLM?.name || ''}
                  onValueChange={(value) => {
                    const profile = allProfiles.find(p => p.name === value);
                    if (profile) {
                      setSelectedLLM(profile);
                    }
                  }}
                >
                  <PromptInputSelectTrigger className="w-[180px] select-none">
                    <PromptInputSelectValue>
                      <div className="flex items-center gap-2 min-w-0">
                        <Brain className="size-4 text-muted-foreground shrink-0" />
                        <span className="whitespace-nowrap truncate">
                          {t('chatInput.info.model') || 'Model'}: {selectedLLM?.name || ''}
                        </span>
                      </div>
                    </PromptInputSelectValue>
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent>
                    {allProfiles.map((profile) => (
                      <PromptInputSelectItem 
                        key={profile.name} 
                        value={profile.name}
                        disabled={profile.available === false}
                      >
                        <div className="flex flex-col">
                          <span className={profile.default ? 'font-semibold' : ''}>
                            {profile.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {profile.provider} / {profile.model}
                          </span>
                        </div>
                      </PromptInputSelectItem>
                    ))}
                  </PromptInputSelectContent>
                </PromptInputSelect>
              )}
              
              {/* Agent Type Selector */}
              <PromptInputSelect
                value={selectedAgentType}
                onValueChange={(value) => {
                  // Ignore empty or invalid values
                  if (!value || value.trim() === '') {
                    return;
                  }
                  
                  const newAgentType = value as AgentType;
                  
                  // Validate agent type before setting
                  const validTypes: AgentType[] = ['basic', 'langgraph', 'plan-1'];
                  if (!validTypes.includes(newAgentType)) {
                    console.error('Invalid agent type:', newAgentType);
                    return;
                  }
                  
                  setSelectedAgentType(newAgentType);
                  
                  // Save to localStorage immediately when user changes it
                  if (typeof window !== 'undefined') {
                    try {
                      localStorage.setItem('ai-studio-agent-type', newAgentType);
                      console.log('Agent type saved to localStorage:', newAgentType);
                    } catch (error) {
                      console.error('Failed to save agent type to localStorage:', error);
                    }
                  }
                }}
              >
                <PromptInputSelectTrigger className="w-[200px] select-none">
                  <PromptInputSelectValue>
                    <div className="flex items-center gap-2 min-w-0">
                      <Bot className="size-4 text-muted-foreground shrink-0" />
                      <span className="whitespace-nowrap truncate">
                        {t('chatInput.info.agentType') || 'Agent'}: {
                          AGENT_TYPES.find(a => a.value === selectedAgentType) 
                            ? t(`chatInput.agentType.${selectedAgentType}`)
                            : ''
                        }
                      </span>
                    </div>
                  </PromptInputSelectValue>
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  {AGENT_TYPES.map((agent) => (
                    <PromptInputSelectItem key={agent.value} value={agent.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{t(`chatInput.agentType.${agent.value}`)}</span>
                        <span className="text-xs text-muted-foreground">
                          {t(`chatInput.agentType.${agent.value}Description`)}
                        </span>
                      </div>
                    </PromptInputSelectItem>
                  ))}
                </PromptInputSelectContent>
              </PromptInputSelect>
              
              {/* Agent Structure button with dropdown menu - for agents with graph support */}
              {hasGraphSupport && (
                <div className="relative" ref={agentGraphButtonRef}>
                  <PromptInputButton
                    type="button"
                    onClick={() => setShowAgentGraphMenu(!showAgentGraphMenu)}
                    variant={
                      settings.agentGraphDisplayMode === 'hidden' 
                        ? "ghost" 
                        : (settings.agentGraphDisplayMode === 'embedded' || showAgentGraph) 
                          ? "default" 
                          : "ghost"
                    }
                    size="icon-sm"
                    title={t('agentGraph.showGraph') || 'Show Agent Structure'}
                  >
                    <Network className="size-4" />
                  </PromptInputButton>
                  
                  {/* Dropdown menu for display mode selection - use portal to render in body */}
                  {showAgentGraphMenu && typeof window !== 'undefined' && menuPosition && createPortal(
                    <div
                      ref={agentGraphMenuRef}
                      className="fixed w-48 bg-white dark:bg-[#252526] rounded-lg shadow-xl dark:shadow-2xl border border-gray-300 dark:border-[#3e3e42] py-1"
                      style={{
                        top: `${menuPosition.top}px`,
                        right: `${menuPosition.right}px`,
                        zIndex: 10002,
                      }}
                    >
                      <button
                        onClick={() => handleDisplayModeChange('embedded')}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between cursor-pointer ${
                          settings.agentGraphDisplayMode === 'embedded'
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'text-gray-900 dark:text-[#cccccc] hover:bg-gray-100 dark:hover:bg-[#2d2d30]'
                        }`}
                      >
                        <span>{t('settings.agentGraphDisplayOptions.embedded')}</span>
                        {settings.agentGraphDisplayMode === 'embedded' && (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => handleDisplayModeChange('floating')}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between cursor-pointer ${
                          settings.agentGraphDisplayMode === 'floating'
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'text-gray-900 dark:text-[#cccccc] hover:bg-gray-100 dark:hover:bg-[#2d2d30]'
                        }`}
                      >
                        <span>{t('settings.agentGraphDisplayOptions.floating')}</span>
                        {settings.agentGraphDisplayMode === 'floating' && (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => handleDisplayModeChange('hidden')}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between cursor-pointer ${
                          settings.agentGraphDisplayMode === 'hidden'
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'text-gray-900 dark:text-[#cccccc] hover:bg-gray-100 dark:hover:bg-[#2d2d30]'
                        }`}
                      >
                        <span>{t('settings.agentGraphDisplayOptions.hidden')}</span>
                        {settings.agentGraphDisplayMode === 'hidden' && (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                    </div>,
                    document.body
                  )}
                </div>
              )}
              
              {/* Submit button */}
              <PromptInputSubmit 
                status={isLoading ? 'streaming' : undefined}
                disabled={false}
                onClick={(e) => {
                  if (isLoading) {
                    e.preventDefault();
                    stop();
                  }
                }}
              />
            </PromptInputTools>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
    </>
  );
}

// Main component with PromptInputProvider
export default function ElementsChat() {
  return (
    <PromptInputProvider>
      <ElementsChatInner />
    </PromptInputProvider>
  );
}

