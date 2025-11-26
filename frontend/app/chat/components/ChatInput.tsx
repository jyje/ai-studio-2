'use client';

import { useTranslation } from '@/app/i18n/hooks/useTranslation';
import { useEffect, useRef, useState } from 'react';
import { fetchModelInfo, ModelInfo, LLMProfile } from '@/app/config';

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
}: ChatInputProps) {
  const { t } = useTranslation();
  const hasInput = value.trim().length > 0;
  const showSendButton = !isLoading && hasInput;
  const showAbortButton = isLoading && onAbort;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch model info on mount
  useEffect(() => {
    fetchModelInfo()
      .then(setModelInfo)
      .catch((err) => {
        console.error('Failed to fetch model info:', err);
      });
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };

    if (showProfileDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showProfileDropdown]);

  // Close dropdown on ESC key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showProfileDropdown) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showProfileDropdown]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
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
              <span>
                {t('chatInput.info.agent')}: <span className="font-medium">{modelInfo.agent}</span>
              </span>
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

