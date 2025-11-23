'use client';

import { useTranslation } from '@/app/i18n/hooks/useTranslation';
import { useEffect, useRef } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onAbort?: () => void;
}

export default function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  inputRef,
  onAbort,
}: ChatInputProps) {
  const { t } = useTranslation();
  const hasInput = value.trim().length > 0;
  const showSendButton = !isLoading && hasInput;
  const showAbortButton = isLoading && onAbort;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

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
      className="fixed bottom-0 left-0 right-0 w-full max-w-full md:max-w-2xl lg:max-w-4xl mx-auto p-2 mb-8 bg-white/90 backdrop-blur-sm border border-gray-300 rounded-2xl shadow-xl"
    >
      <div className="flex items-end">
        <textarea
          ref={(node) => {
            textareaRef.current = node;
            if (inputRef) {
              (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
            }
          }}
          className="flex-1 p-2 rounded-xl resize-none overflow-y-auto max-h-[200px]"
          value={value}
          placeholder={isLoading ? t('chatInput.placeholder.waiting') : t('chatInput.placeholder.default')}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          rows={1}
        />
        <div className={`relative overflow-hidden transition-all duration-200 ${
          showSendButton || showAbortButton
            ? 'opacity-100 scale-100 translate-x-0 ml-2 w-auto'
            : 'opacity-0 scale-95 translate-x-2 ml-0 w-0 pointer-events-none'
        }`}>
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

