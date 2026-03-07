'use client';

import { useTranslation } from '@/app/i18n/hooks/useTranslation';
import { useEffect, useRef, useState } from 'react';
import { fetchModelInfo, ModelInfo, LLMProfile, AgentType, AGENT_TYPES } from '@/app/config';

interface ChatInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onAbort?: () => void;
  selectedLLM?: LLMProfile | null;
  allProfiles?: LLMProfile[];
  onProfileChange?: (profile: LLMProfile | null) => void;
  selectedAgentType?: AgentType;
  onAgentTypeChange?: (agentType: AgentType) => void;
  showAgentGraph?: boolean;
  onToggleAgentGraph?: (show: boolean) => void;
}

export default function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  inputRef,
  onAbort,
  selectedLLM,
  allProfiles = [],
  onProfileChange,
  selectedAgentType = 'basic',
  onAgentTypeChange,
  showAgentGraph = false,
  onToggleAgentGraph,
}: ChatInputProps) {
  const { t } = useTranslation();
  const hasInput = value.trim().length > 0;
  const showSendButton = !isLoading && hasInput;
  const showAbortButton = isLoading && onAbort;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const agentDropdownRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const agentHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch model info on mount
  useEffect(() => {
    fetchModelInfo()
      .then(setModelInfo)
      .catch((err) => {
        console.error('Failed to fetch model info:', err);
      });
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(event.target as Node)) {
        setShowAgentDropdown(false);
      }
    };

    if (showProfileDropdown || showAgentDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showProfileDropdown, showAgentDropdown]);

  // Close dropdowns on ESC key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showProfileDropdown) setShowProfileDropdown(false);
        if (showAgentDropdown) setShowAgentDropdown(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showProfileDropdown, showAgentDropdown]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (agentHoverTimeoutRef.current) {
        clearTimeout(agentHoverTimeoutRef.current);
      }
    };
  }, []);

  const handleProfileSelect = (profile: LLMProfile) => {
    if (onProfileChange) {
      onProfileChange(profile);
    }
    setShowProfileDropdown(false);
  };

  const currentProfileName = selectedLLM?.name || modelInfo?.profile_name || '';

  // Auto-resize textarea based on content
  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 400);
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    resizeTextarea();
  }, [value]);

  // Handle input change with auto-resize
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e);
    // Resize after state update
    setTimeout(() => {
      resizeTextarea();
    }, 0);
  };

  // Handle Enter key: submit on Enter, newline on Shift+Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && hasInput) {
        onSubmit(e as any);
      }
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="fixed bottom-0 left-0 right-0 w-full max-w-full md:max-w-2xl lg:max-w-4xl mx-auto p-2 mb-8 bg-white dark:bg-[#252526]/95 backdrop-blur-sm border border-gray-300 dark:border-[#3e3e42] rounded-2xl shadow-xl dark:shadow-2xl"
    >
      <div className="flex items-end">
        <div className="flex-1 flex flex-col">
          <textarea
            ref={(node) => {
              textareaRef.current = node;
              if (inputRef) {
                (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
              }
            }}
            className="w-full p-2 rounded-xl resize-none overflow-y-auto min-h-[40px] max-h-[400px] bg-transparent text-gray-900 dark:text-[#d4d4d4] placeholder:text-gray-400 dark:placeholder:text-[#858585] focus:outline-none"
            style={{ height: 'auto' }}
            value={value}
            placeholder={isLoading ? t('chatInput.placeholder.waiting') : t('chatInput.placeholder.default')}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={1}
          />
          {/* Model and Agent Info */}
          {modelInfo && (
            <div className="flex items-center gap-3 mt-1 px-2 text-xs text-gray-500 dark:text-gray-400 h-5">
              <div className="relative" ref={dropdownRef}>
                <span
                  className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
                  onMouseEnter={() => {
                    if (hoverTimeoutRef.current) {
                      clearTimeout(hoverTimeoutRef.current);
                      hoverTimeoutRef.current = null;
                    }
                    setShowProfileDropdown(true);
                  }}
                  onMouseLeave={() => {
                    // Delay closing to allow moving to dropdown
                    hoverTimeoutRef.current = setTimeout(() => {
                      setShowProfileDropdown(false);
                      hoverTimeoutRef.current = null;
                    }, 200);
                  }}
                >
                  <svg className="w-3 h-3 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {t('chatInput.info.model')}: <span className="font-medium">{currentProfileName}</span>
                </span>
                {showProfileDropdown && allProfiles.length > 0 && (
                  <div
                    className="absolute bottom-full left-0 mb-2 bg-white dark:bg-[#252526] border border-gray-300 dark:border-[#3e3e42] rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto min-w-[200px]"
                    onMouseEnter={() => {
                      if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                        hoverTimeoutRef.current = null;
                      }
                      setShowProfileDropdown(true);
                    }}
                    onMouseLeave={() => {
                      hoverTimeoutRef.current = setTimeout(() => {
                        setShowProfileDropdown(false);
                        hoverTimeoutRef.current = null;
                      }, 200);
                    }}
                  >
                    {allProfiles.map((profile) => {
                      const isAvailable = profile.available !== false; // Default to true if not specified
                      const isSelected = selectedLLM?.name === profile.name;
                      
                      return (
                        <button
                          key={profile.name}
                          type="button"
                          onClick={() => {
                            if (isAvailable) {
                              handleProfileSelect(profile);
                            }
                          }}
                          disabled={!isAvailable}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                            !isAvailable
                              ? 'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-600'
                              : isSelected
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 cursor-pointer'
                              : 'hover:bg-gray-100 dark:hover:bg-[#2d2d30] text-gray-900 dark:text-[#cccccc] cursor-pointer'
                          } ${profile.default ? 'font-semibold' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{profile.name}</span>
                            <div className="flex items-center gap-2">
                              {!isAvailable && (
                                <span className="text-xs text-orange-500 dark:text-orange-400">
                                  {t('chatInput.profile.unavailable')}
                                </span>
                              )}
                              {profile.default && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {t('chatInput.profile.default')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {profile.provider} / {profile.model}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              {/* Agent Type Selector */}
              <div className="relative" ref={agentDropdownRef}>
                <span
                  className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
                  onMouseEnter={() => {
                    if (agentHoverTimeoutRef.current) {
                      clearTimeout(agentHoverTimeoutRef.current);
                      agentHoverTimeoutRef.current = null;
                    }
                    setShowAgentDropdown(true);
                  }}
                  onMouseLeave={() => {
                    agentHoverTimeoutRef.current = setTimeout(() => {
                      setShowAgentDropdown(false);
                      agentHoverTimeoutRef.current = null;
                    }, 200);
                  }}
                >
                  <svg className="w-3 h-3 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {t('chatInput.info.agentType')}: <span className="font-medium">{t(`chatInput.agentType.${selectedAgentType}`)}</span>
                </span>
                {showAgentDropdown && (
                  <div
                    className="absolute bottom-full left-0 mb-2 bg-white dark:bg-[#252526] border border-gray-300 dark:border-[#3e3e42] rounded-lg shadow-lg z-50 min-w-[200px]"
                    onMouseEnter={() => {
                      if (agentHoverTimeoutRef.current) {
                        clearTimeout(agentHoverTimeoutRef.current);
                        agentHoverTimeoutRef.current = null;
                      }
                      setShowAgentDropdown(true);
                    }}
                    onMouseLeave={() => {
                      agentHoverTimeoutRef.current = setTimeout(() => {
                        setShowAgentDropdown(false);
                        agentHoverTimeoutRef.current = null;
                      }, 200);
                    }}
                  >
                    {AGENT_TYPES.map((agent) => {
                      const isSelected = selectedAgentType === agent.value;
                      
                      return (
                        <button
                          key={agent.value}
                          type="button"
                          onClick={() => {
                            if (onAgentTypeChange) {
                              onAgentTypeChange(agent.value);
                            }
                            setShowAgentDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                              : 'hover:bg-gray-100 dark:hover:bg-[#2d2d30] text-gray-900 dark:text-[#cccccc]'
                          }`}
                        >
                          <div className="font-medium">{t(`chatInput.agentType.${agent.value}`)}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {t(`chatInput.agentType.${agent.value}Description`)}
                          </div>
                        </button>
                      );
                    })}
                    {/* Show Agent Graph checkbox - only for agents with graph support */}
                    {AGENT_TYPES.find(a => a.value === selectedAgentType)?.hasGraph && onToggleAgentGraph && (
                      <>
                        <div className="border-t border-gray-200 dark:border-[#3e3e42] my-1" />
                        <label
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#2d2d30] cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={showAgentGraph}
                            onChange={(e) => onToggleAgentGraph(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 dark:border-[#3e3e42] text-blue-500 focus:ring-blue-500 cursor-pointer"
                          />
                          <span className="text-gray-700 dark:text-[#cccccc]">
                            {t('agentGraph.showGraph')}
                          </span>
                        </label>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className={`relative overflow-hidden transition-all duration-200 ${
          showSendButton || showAbortButton
            ? 'opacity-100 scale-100 translate-x-0 ml-2 w-auto'
            : 'opacity-0 scale-95 translate-x-2 ml-0 w-0 pointer-events-none'
        } ${modelInfo ? 'mb-6' : ''}`}>
          {/* Send Button */}
          <button
            type="submit"
            className={`absolute inset-0 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl whitespace-nowrap transition-all duration-200 px-3 py-2 cursor-pointer ${
              showSendButton
                ? 'opacity-100 scale-100 translate-x-0 pointer-events-auto'
                : 'opacity-0 scale-95 translate-x-2 pointer-events-none'
            }`}
            title={t('chatInput.title.send')}
            disabled={!showSendButton}
          >
            {t('chatInput.button.send')}
          </button>
          {/* Abort Button */}
          <button
            type="button"
            onClick={onAbort}
            className={`absolute inset-0 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl whitespace-nowrap transition-all duration-200 px-3 py-2 cursor-pointer ${
              showAbortButton
                ? 'opacity-100 scale-100 translate-x-0 pointer-events-auto'
                : 'opacity-0 scale-95 -translate-x-2 pointer-events-none'
            }`}
            title={t('chatInput.title.abort')}
          >
            {t('chatInput.button.abort')}
          </button>
          {/* Spacer to maintain layout */}
          <div className="invisible px-3 py-2 text-sm whitespace-nowrap">
            {showAbortButton ? t('chatInput.button.abort') : t('chatInput.button.send')}
          </div>
        </div>
      </div>
    </form>
  );
}

